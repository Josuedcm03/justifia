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
