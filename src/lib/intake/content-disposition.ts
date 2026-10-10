import type { TipoDetectado } from "./signature";

// `Content-Disposition` for a supporting document, shown inline (C17). The student's original
// name only travels in the RFC 5987 `filename*` parameter, fully
// percent-encoded; the quoted fallback is generic and built from the detected
// type, so no stored name can inject a header or a quote.

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function inlineDisposition(
  nombreOriginal: string,
  tipo: TipoDetectado,
): string {
  return `inline; filename="documento.${tipo}"; filename*=UTF-8''${encodeRfc5987(nombreOriginal)}`;
}
