import { MAX_FILE_BYTES } from "./limits";

// Pure file guards (decision 2): Uint8Array + filename in, typed result out.
// These run BEFORE any untrusted-archive parsing (exceljs is never invoked
// here). Order is fixed and load-bearing: file present -> extension ->
// ZIP signature ("PK") -> size. Each guard returns as soon as it fails so an
// input that fails several checks always reports the earliest one.

export type UploadGuardResult =
  | { ok: true }
  | {
      ok: false;
      reason: "noFile" | "wrongExtension" | "notAZip" | "tooLarge";
    };

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const; // "PK\x03\x04"

function hasXlsxExtension(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".xlsx");
}

function hasZipSignature(bytes: Uint8Array): boolean {
  if (bytes.length < ZIP_SIGNATURE.length) return false;
  return ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export function checkUploadedFile(
  bytes: Uint8Array | undefined,
  fileName: string | undefined,
): UploadGuardResult {
  if (!bytes || !fileName || bytes.length === 0) {
    return { ok: false, reason: "noFile" };
  }
  if (!hasXlsxExtension(fileName)) {
    return { ok: false, reason: "wrongExtension" };
  }
  if (!hasZipSignature(bytes)) {
    return { ok: false, reason: "notAZip" };
  }
  if (bytes.length > MAX_FILE_BYTES) {
    return { ok: false, reason: "tooLarge" };
  }
  return { ok: true };
}
