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

function disposition(
  kind: "inline" | "attachment",
  nombreOriginal: string,
  tipo: TipoDetectado,
): string {
  return `${kind}; filename="documento.${tipo}"; filename*=UTF-8''${encodeRfc5987(nombreOriginal)}`;
}

export function inlineDisposition(
  nombreOriginal: string,
  tipo: TipoDetectado,
): string {
  return disposition("inline", nombreOriginal, tipo);
}

/** The explicit download mode (`descarga`): same names, saved instead of shown. */
export function attachmentDisposition(
  nombreOriginal: string,
  tipo: TipoDetectado,
): string {
  return disposition("attachment", nombreOriginal, tipo);
}
