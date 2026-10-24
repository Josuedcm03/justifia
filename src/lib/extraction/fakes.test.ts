// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createFakeFieldExtractor,
  createFakePreparer,
  createRecordingQueue,
} from "./fakes";
import type { PreparedDocument } from "./ports";

const PAGE_ONE = new Uint8Array([1, 2, 3]);
const PAGE_TWO = new Uint8Array([4, 5]);

const prepared: PreparedDocument = {
  kind: "images",
  images: [PAGE_ONE, PAGE_TWO],
};

describe("createFakePreparer", () => {
  it("returns the scripted document and records the bytes and kind it was given", async () => {
    const preparer = createFakePreparer({ ok: true, prepared });
    const bytes = new Uint8Array([9, 9]);

    const result = await preparer.prepare(bytes, "pdf");

    expect(result).toEqual({ ok: true, prepared });
    expect(preparer.calls).toEqual([{ bytes, kind: "pdf" }]);
  });

  it("returns a scripted error code instead of a document", async () => {
    const preparer = createFakePreparer({
      ok: false,
      code: "unreadable_document",
    });

    expect(await preparer.prepare(new Uint8Array(), "png")).toEqual({
      ok: false,
      code: "unreadable_document",
    });
  });

  it("changes its answer when re-scripted", async () => {
    const preparer = createFakePreparer({ ok: true, prepared });
    preparer.respondWith({ ok: false, code: "render_unavailable" });

    expect(await preparer.prepare(new Uint8Array(), "pdf")).toEqual({
      ok: false,
      code: "render_unavailable",
    });
  });

  it("has a default single-page answer when none is scripted", async () => {
    const result = await createFakePreparer().prepare(new Uint8Array(), "jpeg");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.prepared.images).toHaveLength(1);
  });
});

describe("createFakeFieldExtractor", () => {
  const answer = { ok: true, raw: { issuer: "Clinica Central" } } as const;

  it("yields the queued answers and errors in order", async () => {
    const extractor = createFakeFieldExtractor();
    extractor.queue(answer, { ok: false, code: "timeout" }, answer);

    const first = await extractor.extract(prepared, { timeoutMs: 1000 });
    const second = await extractor.extract(prepared, { timeoutMs: 1000 });
    const third = await extractor.extract(prepared, { timeoutMs: 1000 });

    expect(first).toEqual(answer);
    expect(second).toEqual({ ok: false, code: "timeout" });
    expect(third).toEqual(answer);
  });

  it("records every call with the document and the timeout", async () => {
    const extractor = createFakeFieldExtractor();
    extractor.queue(answer, answer);

    await extractor.extract(prepared, { timeoutMs: 120_000 });
    await extractor.extract(prepared, { timeoutMs: 45_000 });

    expect(extractor.calls).toEqual([
      { prepared, timeoutMs: 120_000 },
      { prepared, timeoutMs: 45_000 },
    ]);
  });

  it("fails loudly when called with nothing queued", async () => {
    const extractor = createFakeFieldExtractor();

    await expect(
      extractor.extract(prepared, { timeoutMs: 1000 }),
    ).rejects.toThrow("fake_extractor_queue_empty");
  });

  it("is configured by default and can be switched", () => {
    const extractor = createFakeFieldExtractor();
    expect(extractor.isConfigured()).toBe(true);

    extractor.setConfigured(false);
    expect(extractor.isConfigured()).toBe(false);
    expect(createFakeFieldExtractor({ configured: false }).isConfigured()).toBe(
      false,
    );
  });

  it("counts how often it was asked whether it is configured", () => {
    const extractor = createFakeFieldExtractor();

    extractor.isConfigured();
    extractor.isConfigured();

    expect(extractor.configuredChecks).toBe(2);
  });
});

describe("createRecordingQueue", () => {
  it("stores each enqueue call with its request id and start instant", () => {
    const queue = createRecordingQueue();
    const first = new Date("2026-10-22T15:00:00.000Z");
    const second = new Date("2026-10-22T16:00:00.000Z");

    queue.enqueue(7, first);
    queue.enqueue(9, second);

    expect(queue.calls).toEqual([
      { solicitudId: 7, startedAt: first },
      { solicitudId: 9, startedAt: second },
    ]);
  });
});
