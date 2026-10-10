// Magic-byte detection (RN-04, D3). Pure: the finalize action reads the first
// bytes of the stored file and this decides the real format, never trusting the
// client type or file extension. Mirrors src/lib/import/guards.ts.

export type TipoDetectado = "pdf" | "png" | "jpeg";

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // "%PDF-"
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;

/** Bytes a caller must read to decide every supported type. */
export const SIGNATURE_HEAD_BYTES = PNG_SIGNATURE.length;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

export function detectSignature(head: Uint8Array): TipoDetectado | null {
  if (startsWith(head, PDF_SIGNATURE)) return "pdf";
  if (startsWith(head, PNG_SIGNATURE)) return "png";
  if (startsWith(head, JPEG_SIGNATURE)) return "jpeg";
  return null;
}

const CONTENT_TYPES: Record<TipoDetectado, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
};

export function contentTypeFor(tipo: TipoDetectado): string {
  return CONTENT_TYPES[tipo];
}
