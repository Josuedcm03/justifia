import { describe, expect, it } from "vitest";

import { contentTypeFor, detectSignature } from "./signature";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe("detectSignature (RN-04, D3)", () => {
  it("detects a PDF from %PDF-", () => {
    expect(detectSignature(ascii("%PDF-1.7\n"))).toBe("pdf");
  });

  it("detects a PNG from the full 8-byte signature", () => {
    expect(
      detectSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("png");
  });

  it("detects a JPEG from FF D8 FF", () => {
    expect(detectSignature(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(detectSignature(bytes(0xff, 0xd8, 0xff))).toBe("jpeg");
  });

  it("rejects an executable renamed scan.pdf", () => {
    expect(detectSignature(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03))).toBeNull();
  });

  it("rejects a truncated PNG signature and a truncated PDF marker", () => {
    expect(detectSignature(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(detectSignature(ascii("%PDF"))).toBeNull();
  });

  it("rejects an empty head and a PNG-like head with a wrong tail", () => {
    expect(detectSignature(new Uint8Array(0))).toBeNull();
    expect(
      detectSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b)),
    ).toBeNull();
  });

  it("rejects HTML", () => {
    expect(detectSignature(ascii("<html><body>"))).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("maps each detected type to its MIME type", () => {
    expect(contentTypeFor("pdf")).toBe("application/pdf");
    expect(contentTypeFor("png")).toBe("image/png");
    expect(contentTypeFor("jpeg")).toBe("image/jpeg");
  });
});
