/**
 * The permission-denied screen's route. Kept free of `server-only` so
 * `dal.ts`, the page itself and every test share exactly one copy of the
 * string (design.md decision 13).
 */
export const ACCESS_DENIED_PATH = "/denied";

/**
 * The forced-password-change screen's route (FPC). Same rule as above: one
 * copy of the string for `dal.ts`, the page and every test (design.md D12).
 */
export const PASSWORD_CHANGE_PATH = "/change-password";
