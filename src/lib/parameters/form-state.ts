// src/lib/parameters/form-state.ts — PURE. Types only. What each parameter
// Server Action answers with (NP-7, NP-9). A "use server" module may export
// nothing but async functions, so the shared type lives here.

/**
 * `invalid` keeps what was submitted (`values`, one text per field) and one
 * message per field, already translated, each stating the allowed range.
 * `saved`, `unchanged` and `busy` are outcomes the screen words itself;
 * `error` carries the generic message, already translated.
 */
export type ParameterFormState =
  | { kind: "idle" }
  | {
      kind: "invalid";
      fieldErrors: Readonly<Record<string, string>>;
      values: Readonly<Record<string, string>>;
    }
  | { kind: "saved" }
  | { kind: "unchanged" }
  | { kind: "busy" }
  | { kind: "error"; message: string };
