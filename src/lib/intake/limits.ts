// Intake constants (D4, D8, D12). Pure: no imports, so the database schema and
// route handlers can both read them.

/** RN-04: largest supporting document, in bytes (10 MiB). */
export const MAX_DOCUMENT_BYTES = 10_485_760;

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

/** RN-23: the end date may not be earlier than this many days before submission. */
export const LATE_WINDOW_DAYS = 30;

/** D2: lifetime of a client upload token. */
export const UPLOAD_TOKEN_TTL_MINUTES = 10;
