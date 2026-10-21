import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import en from "../../../i18n/en.json";
import es from "../../../i18n/es.json";
import { CONSENT_LABEL_KEY, CONSENT_VERSION } from "./consent";

// RC-3, RF-01 (d), RN-25. The Spanish text is the legal text: its hash is
// pinned to the version, so editing it without a new version (or bumping the
// version without a new text) turns this test red. Old pins stay so the
// history is reviewable. The English text is a translation and is not pinned.

/** SHA-256 of the raw es message (tags included), by consent version. */
const PINNED: Record<string, string> = {
  "2026-10-20":
    "34017ff7d7a760ae5828451eafb8c2415e0f4ec93f91eb43c0450384eea2fd90",
};

/**
 * SHA-256 of the es `privacy` subtree (sorted-key JSON), by consent version.
 * The notice and the checkbox text share one version (RC-3, D9).
 */
const PINNED_NOTICE: Record<string, string> = {
  "2026-10-20":
    "0d17917555920ecf851a0393c52332155437382f166f7622c8f16d6ccedec335",
};

const APPROVED_ES =
  "Acepto que la UAM use los datos de esta solicitud y de mis documentos, incluidos los datos de salud que contengan, solo para tramitarla, y que se envíen a los docentes de las asignaturas afectadas. Ver aviso de privacidad";
const APPROVED_EN =
  "I agree that UAM may use the data in this request and in my documents, including any health data they contain, only to process it, and that they be sent to the teachers of the affected subjects. View privacy notice";

/** Resolve a dotted key such as `intake.review.consent.label` in a catalog. */
function message(catalog: unknown, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)?.[part],
      catalog,
    );
  expect(typeof value, `${key} missing`).toBe("string");
  return value as string;
}

function stripTags(text: string): string {
  return text.replace(/<\/?link>/g, "");
}

/** Stable serialisation: keys sorted at every level, no whitespace. */
function canonical(value: unknown): string {
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`);
  return `{${entries.join(",")}}`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("consent version and key", () => {
  it("is the ISO date of the owner's approval", () => {
    expect(CONSENT_VERSION).toBe("2026-10-20");
  });

  it("fits the ConsentimientoVersion varchar(20) column", () => {
    expect(CONSENT_VERSION.length).toBeLessThanOrEqual(20);
  });

  it("names the label key under the review step", () => {
    expect(CONSENT_LABEL_KEY).toBe("intake.review.consent.label");
  });
});

describe("consent text (RF-01 d)", () => {
  it("is the approved es text once the link tags are stripped", () => {
    expect(stripTags(message(es, CONSENT_LABEL_KEY))).toBe(APPROVED_ES);
  });

  it("is the approved en translation once the link tags are stripped", () => {
    expect(stripTags(message(en, CONSENT_LABEL_KEY))).toBe(APPROVED_EN);
  });

  it("wraps only the notice phrase in the link tag, in both locales", () => {
    expect(message(es, CONSENT_LABEL_KEY)).toMatch(
      /\. <link>Ver aviso de privacidad<\/link>$/,
    );
    expect(message(en, CONSENT_LABEL_KEY)).toMatch(
      /\. <link>View privacy notice<\/link>$/,
    );
  });
});

describe("consent text pin (RC-3)", () => {
  it("hashes the raw es message to the pin of the current version", () => {
    expect(sha256(message(es, CONSENT_LABEL_KEY))).toBe(
      PINNED[CONSENT_VERSION],
    );
  });

  it("detects a text change that keeps the version", () => {
    const edited = message(es, CONSENT_LABEL_KEY).replace(
      "solo para tramitarla",
      "para cualquier fin",
    );
    expect(sha256(edited)).not.toBe(PINNED[CONSENT_VERSION]);
  });

  it("keeps the pinned hashes distinct, the current version last", () => {
    const versions = Object.keys(PINNED);
    const hashes = Object.values(PINNED);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(versions.at(-1)).toBe(CONSENT_VERSION);
  });
});

describe("privacy notice pin (RC-3, RF-01 d)", () => {
  const notice = () => (es as Record<string, unknown>).privacy;

  it("hashes the es privacy subtree to the pin of the current version", () => {
    expect(sha256(canonical(notice()))).toBe(PINNED_NOTICE[CONSENT_VERSION]);
  });

  it("detects a notice edit that keeps the version", () => {
    const edited = JSON.parse(JSON.stringify(notice())) as {
      retention: { body: string };
    };
    edited.retention.body = edited.retention.body.replace("cinco", "diez");
    expect(edited.retention.body).not.toBe(
      (notice() as typeof edited).retention.body,
    );
    expect(sha256(canonical(edited))).not.toBe(PINNED_NOTICE[CONSENT_VERSION]);
  });

  it("ignores key order but not content (sorted-key serialisation)", () => {
    expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonical({ a: { c: 3, d: 2 }, b: 1 }),
    );
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }));
  });

  it("keeps the notice pins distinct, the current version last", () => {
    const versions = Object.keys(PINNED_NOTICE);
    const hashes = Object.values(PINNED_NOTICE);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(versions.at(-1)).toBe(CONSENT_VERSION);
    expect(versions).toEqual(Object.keys(PINNED));
  });
});
