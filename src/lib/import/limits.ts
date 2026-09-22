// Pure caps for the catalog Excel import. NO imports: next.config.ts reads
// this file directly to derive experimental.serverActions.bodySizeLimit
// (decision D1), so it must stay dependency-free.

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB
export const MAX_ROWS_PER_SHEET = 10_000;
export const MAX_ROWS_TOTAL = 30_000;
export const MAX_NEW_ACCOUNTS_PER_APPLY = 250;
/** Bounds the audit rows one apply may write: 1 import row + N account rows
 *  (decision 21). Creations are already capped at 250; UPDATES are not, and
 *  they are personal-data modifications too, so they need their own bound. */
export const MAX_ACCOUNT_EVENTS_PER_APPLY = 2_000;
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024; // F3
export const SERVER_ACTION_BODY_LIMIT =
  MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES;
export const WRITE_CHUNK_ROWS = 500; // <= 65 535 bind params per statement
