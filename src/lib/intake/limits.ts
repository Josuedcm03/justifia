// Intake constants (D4, D8, D12). Pure: no imports, so route handlers and
// client components can read them. The largest supporting document is not here:
// it is the `tamano_maximo_mib` parameter (RN-04, RNF-14), up to the 10 MiB of
// the database check `CK_Documento_Tamano`.

/** Content types an upload token may allow (RN-04). */
export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

/** D12: documents per draft, counting `pendiente` and `valido`. */
export const MAX_DOCUMENTS_PER_DRAFT = 5;

/** D8: days of inactivity after which a draft expires. */
export const DRAFT_TTL_DAYS = 30;

/** D8: unreferenced blobs younger than this are kept (a finalize may be pending). */
export const ORPHAN_GRACE_HOURS = 24;

/** A `pendiente` document older than this is a failed finalize and is swept. */
export const PENDING_GRACE_HOURS = 1;

/** D2: lifetime of a client upload token. */
export const UPLOAD_TOKEN_TTL_MINUTES = 10;
