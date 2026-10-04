import { describe, expect, it } from "vitest";

import { MAX_FILE_BYTES } from "./limits";
import { checkUploadedFile } from "./guards";

// CEI: File guards — pure, Uint8Array + filename in, typed result out. The
// xlsx library is never called here (decision 2: ordered guards run before
// any untrusted-archive parsing).
const PK_HEADER = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function bytesOfSize(size: number, header: Uint8Array = PK_HEADER): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(header.subarray(0, Math.min(header.length, size)));
  return bytes;
}

describe("checkUploadedFile (CEI: Rejected uploads, table-driven)", () => {
  it("rejects when no file is provided", () => {
    const result = checkUploadedFile(undefined, undefined);
    expect(result).toEqual({ ok: false, reason: "noFile" });
  });

  it("rejects an empty file", () => {
    const result = checkUploadedFile(new Uint8Array(0), "catalog.xlsx");
    expect(result).toEqual({ ok: false, reason: "noFile" });
  });

  it.each([
    ["catalog.xls", "wrongExtension"],
    ["catalog.csv", "wrongExtension"],
    ["catalog", "wrongExtension"],
  ])("rejects wrong extension %s", (name, reason) => {
    const result = checkUploadedFile(bytesOfSize(8), name);
    expect(result).toEqual({ ok: false, reason });
  });

  it("rejects .xlsx bytes that are not a ZIP archive (text-as-xlsx)", () => {
    const textBytes = new TextEncoder().encode("hello, this is not a zip");
    const result = checkUploadedFile(textBytes, "catalog.xlsx");
    expect(result).toEqual({ ok: false, reason: "notAZip" });
  });

  it("rejects a file larger than MAX_FILE_BYTES", () => {
    const result = checkUploadedFile(
      bytesOfSize(MAX_FILE_BYTES + 1),
      "catalog.xlsx",
    );
    expect(result).toEqual({ ok: false, reason: "tooLarge" });
  });

  it("accepts a file of exactly MAX_FILE_BYTES", () => {
    const result = checkUploadedFile(
      bytesOfSize(MAX_FILE_BYTES),
      "catalog.xlsx",
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts a case-insensitive .XLSX extension", () => {
    const result = checkUploadedFile(bytesOfSize(8), "CATALOG.XLSX");
    expect(result).toEqual({ ok: true });
  });

  it("checks in a fixed order: file present -> extension -> PK -> size, reporting the earliest failure", () => {
    // Fails BOTH the extension check (.csv) and the PK check (plain text
    // bytes): the extension failure must win because it runs first.
    const textBytes = new TextEncoder().encode("not a zip, not xlsx either");
    const result = checkUploadedFile(textBytes, "catalog.csv");
    expect(result).toEqual({ ok: false, reason: "wrongExtension" });
  });
});
