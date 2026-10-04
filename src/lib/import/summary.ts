import type { ImportSummary } from "@/lib/import/types";

/**
 * Builds the post-apply summary from explicit fields only: whatever else the
 * caller holds (credentials, hashes) cannot ride along, and the type has no
 * credential key either (decision 16).
 */
export function buildImportSummary(input: ImportSummary): ImportSummary {
  return {
    actor: input.actor,
    at: input.at,
    fileSha256: input.fileSha256,
    counts: input.counts,
    accountsCreated: input.accountsCreated,
    accountsUpdated: input.accountsUpdated,
  };
}

export type SummaryLogger = (line: string) => void;

/** One structured line per apply; no credential field exists to be logged. */
export function logImportSummary(
  summary: ImportSummary,
  logger: SummaryLogger = console.info,
): void {
  logger(JSON.stringify({ event: "catalog.import.applied", ...summary }));
}

export type ImportFailure = {
  actor: string;
  fileSha256: string;
  error: unknown;
};

function stringCode(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * One sanitized line for a failed apply, so the failure leaves an operational
 * trace. The raw error is never logged: driver errors embed their bound
 * parameters (password hashes). Only the error's name and, when it is a
 * string, its code are read; Drizzle keeps the PostgreSQL SQLSTATE on `cause`,
 * so that one field is read from there too. No message, stack, detail, query
 * or parameters ever reach the line.
 */
export function logImportFailure(
  { actor, fileSha256, error }: ImportFailure,
  logger: SummaryLogger = console.error,
): void {
  const errorCode =
    stringCode(error) ??
    stringCode((error as { cause?: unknown } | null)?.cause);
  logger(
    JSON.stringify({
      event: "catalog.import.failed",
      actor,
      fileSha256,
      errorName: error instanceof Error ? error.name : typeof error,
      ...(errorCode === undefined ? {} : { errorCode }),
    }),
  );
}
