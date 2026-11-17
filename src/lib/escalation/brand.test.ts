import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BRAND,
  BRAND_LOGO_CONTENT_ID,
  brandLogoAttachment,
  contrastRatio,
} from "./brand";

describe("brand of the coordination notice (E18)", () => {
  it("embeds exactly the logo that the app serves from public/brand", () => {
    const file = readFileSync(
      resolve(process.cwd(), "public/brand/uam-fia-logo.png"),
    );
    const [logo] = [brandLogoAttachment()];
    expect(Buffer.from(logo.content).equals(file)).toBe(true);
  });

  it("is an inline PNG image under a content id, never a document", () => {
    const logo = brandLogoAttachment();
    expect(logo.contentId).toBe(BRAND_LOGO_CONTENT_ID);
    expect(logo.contentType).toBe("image/png");
    expect(logo.filename).toBe("uam-fia-logo.png");
    expect(logo.content.byteLength).toBeLessThan(50 * 1024);
  });

  it("uses the teal and the orange sampled from the official lockup", () => {
    expect(BRAND.teal).toBe("#0098a7");
    expect(BRAND.orange).toBe("#ee7601");
  });

  it("measures the WCAG contrast ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("keeps readable text on every brand surface", () => {
    // Title bar: bold text of 20 px or more is large text (3:1).
    expect(contrastRatio(BRAND.onTeal, BRAND.teal)).toBeGreaterThanOrEqual(3);
    // Button: 16 px bold is not large text (4.5:1).
    expect(contrastRatio(BRAND.onOrange, BRAND.orange)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(BRAND.text, BRAND.surface)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(BRAND.muted, BRAND.surface)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
