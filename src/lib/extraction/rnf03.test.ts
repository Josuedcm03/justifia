// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNuExtractHttpExtractor } from "./adapters/nuextract-http-extractor";
import { createSharpUnpdfPreparer } from "./adapters/sharp-unpdf-preparer";
import { buildPdf } from "./adapters/test-support/pdf";
import type { DocumentKind, ExtractResult } from "./ports";

// RNF-03 / FA-04: document content leaves the process only toward the one
// configured host, and no hosted OCR or inference SDK is a dependency. The real
// preparer and the real HTTP adapter run; only the network edge is replaced, so
// no model container and no real document is involved (RNF-04).

const CONFIGURED_HOST = "127.0.0.1:8080";
const CONFIGURED_URL = `http://${CONFIGURED_HOST}`;

const ANSWER = {
  student_name: null,
  issuer: null,
  issue_date: null,
  rest_from: null,
  rest_to: null,
  rest_days: null,
};

async function image(
  kind: "jpeg" | "png",
  width: number,
  height: number,
  shade: number,
): Promise<Uint8Array> {
  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: shade, g: shade, b: shade },
    },
  });
  return new Uint8Array(
    await (kind === "jpeg" ? base.jpeg() : base.png()).toBuffer(),
  );
}

interface Sample {
  kind: DocumentKind;
  bytes: Uint8Array;
  pages: number;
}

/** 7 images and 3 PDFs (every PDF takes the render path: DE-14 failed). */
async function tenDocuments(): Promise<Sample[]> {
  const images: Sample[] = [];
  for (let i = 0; i < 7; i++) {
    const kind = i % 2 === 0 ? "jpeg" : "png";
    images.push({
      kind,
      bytes: await image(kind, 400 + i * 700, 300 + i * 100, 40 + i * 25),
      pages: 1,
    });
  }
  return [
    ...images,
    { kind: "pdf", bytes: buildPdf([{ gray: 0.9 }]), pages: 1 },
    {
      kind: "pdf",
      bytes: buildPdf([{ text: "Constancia" }, { gray: 0.8 }]),
      pages: 2,
    },
    {
      kind: "pdf",
      bytes: buildPdf(Array.from({ length: 8 }, () => ({ gray: 0.7 }))),
      pages: 5,
    },
  ];
}

interface Outbound {
  url: URL;
  imageParts: number;
}

function stubNetwork(): Outbound[] {
  const outbound: Outbound[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: { content?: unknown[] }[];
      };
      outbound.push({
        url: new URL(String(input)),
        imageParts: body.messages?.[0]?.content?.length ?? 0,
      });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(ANSWER) } }],
        }),
        { status: 200 },
      );
    }),
  );
  return outbound;
}

async function extractAll(
  samples: Sample[],
  env: { EXTRACTION_API_URL?: string },
): Promise<ExtractResult[]> {
  const preparer = createSharpUnpdfPreparer();
  const extractor = createNuExtractHttpExtractor({ env: () => env });
  const results: ExtractResult[] = [];
  for (const sample of samples) {
    const prepared = await preparer.prepare(sample.bytes, sample.kind);
    if (!prepared.ok) throw new Error(`not prepared: ${prepared.code}`);
    results.push(
      await extractor.extract(prepared.prepared, { timeoutMs: 60_000 }),
    );
  }
  return results;
}

describe("RNF-03 local-execution boundary (FA-04)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends 10 extractions (7 images, 3 PDFs) to the configured host and nowhere else", async () => {
    const outbound = stubNetwork();
    const samples = await tenDocuments();
    expect(samples).toHaveLength(10);

    const results = await extractAll(samples, {
      EXTRACTION_API_URL: CONFIGURED_URL,
    });

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.ok)).toBe(true);
    // One model call per document, and nothing else went out while the real
    // preparer ran (no font, no resource fetched over the network).
    expect(outbound).toHaveLength(10);
    for (const request of outbound) {
      expect(request.url.host).toBe(CONFIGURED_HOST);
      expect(request.url.pathname).toBe("/v1/chat/completions");
    }
    // Every page of every document went in a request: 7 + (1 + 2 + 5).
    expect(outbound.map((r) => r.imageParts)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 2, 5,
    ]);
  });

  it("keeps to the configured host when it is a remote https host", async () => {
    const outbound = stubNetwork();
    const samples = (await tenDocuments()).slice(0, 3);

    await extractAll(samples, {
      EXTRACTION_API_URL: "https://model.example.test",
    });

    expect(outbound).toHaveLength(3);
    for (const request of outbound) {
      expect(request.url.host).toBe("model.example.test");
    }
  });

  it("makes no request at all when no address is configured", async () => {
    const outbound = stubNetwork();
    const samples = (await tenDocuments()).slice(0, 3);
    const preparer = createSharpUnpdfPreparer();
    const extractor = createNuExtractHttpExtractor({ env: () => ({}) });

    for (const sample of samples) {
      const prepared = await preparer.prepare(sample.bytes, sample.kind);
      if (!prepared.ok) throw new Error("not prepared");
      const result = await extractor.extract(prepared.prepared, {
        timeoutMs: 60_000,
      });
      expect(result).toEqual({ ok: false, code: "model_error" });
    }

    expect(extractor.isConfigured()).toBe(false);
    expect(outbound).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("makes no request when the address is plain http to a remote host", async () => {
    const outbound = stubNetwork();
    const extractor = createNuExtractHttpExtractor({
      env: () => ({ EXTRACTION_API_URL: "http://models.example.com" }),
    });

    const result = await extractor.extract(
      { kind: "images", images: [new Uint8Array([1, 2, 3])] },
      { timeoutMs: 60_000 },
    );

    expect(result).toEqual({ ok: false, code: "model_error" });
    expect(outbound).toEqual([]);
  });
});

// A hosted OCR or inference service would send documents to a third party.
const FORBIDDEN_SDKS = [
  "@google-cloud/vision",
  "@google-cloud/documentai",
  "@aws-sdk/client-textract",
  "@aws-sdk/client-rekognition",
  "@azure/ai-form-recognizer",
  "@azure/cognitiveservices-computervision",
  "@google/generative-ai",
  "@google/genai",
  "@mistralai/mistralai",
  "@huggingface/inference",
  "@anthropic-ai/sdk",
  "openai",
  "cohere-ai",
  "replicate",
  "groq-sdk",
];

function isForbidden(specifier: string): boolean {
  return FORBIDDEN_SDKS.some(
    (name) => specifier === name || specifier.startsWith(`${name}/`),
  );
}

const IMPORT_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

function forbiddenImports(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)]
    .map((match) => match[1])
    .filter(isForbidden);
}

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const SELF = fileURLToPath(import.meta.url);

function sourceFiles(): string[] {
  return readdirSync(path.join(ROOT, "src"), { recursive: true })
    .map((entry) => path.join(ROOT, "src", String(entry)))
    .filter((file) => /\.(ts|tsx)$/.test(file) && file !== SELF);
}

describe("RNF-03 dependency guard (FA-04)", () => {
  it("detects an import of a hosted OCR or inference SDK", () => {
    expect(forbiddenImports('import OpenAI from "openai";')).toEqual([
      "openai",
    ]);
    expect(
      forbiddenImports(
        'import { TextractClient } from "@aws-sdk/client-textract";\nconst a = await import("@google-cloud/vision");',
      ),
    ).toEqual(["@aws-sdk/client-textract", "@google-cloud/vision"]);
    expect(forbiddenImports('const c = require("cohere-ai/dist");')).toEqual([
      "cohere-ai/dist",
    ]);
  });

  it("lets the dependencies this change uses through", () => {
    expect(
      forbiddenImports(
        'import sharp from "sharp";\nimport { z } from "zod";\nimport x from "openai-compatible-thing";\nimport "@napi-rs/canvas";',
      ),
    ).toEqual([]);
  });

  it("finds no such SDK in package.json", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    const names = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ].flatMap((section) => Object.keys(manifest[section] ?? {}));

    expect(names).toContain("sharp");
    expect(names.filter(isForbidden)).toEqual([]);
  });

  it("finds no such SDK imported anywhere under src", () => {
    const files = sourceFiles();
    // A scan that read nothing would pass for the wrong reason.
    expect(files.length).toBeGreaterThan(100);

    const offenders = files.filter(
      (file) => forbiddenImports(readFileSync(file, "utf8")).length > 0,
    );

    expect(offenders).toEqual([]);
  });
});
