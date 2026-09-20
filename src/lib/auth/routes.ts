/**
 * The permission-denied screen's route. Kept free of `server-only` so
 * `dal.ts`, the page itself and every test share exactly one copy of the
 * string (design.md decision 13).
 */
export const ACCESS_DENIED_PATH = "/denied";
