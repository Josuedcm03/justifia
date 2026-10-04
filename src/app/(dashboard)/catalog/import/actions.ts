"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { requireRole } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { canImportCatalog } from "@/lib/auth/permissions";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { loadCatalogSnapshot } from "@/lib/data/catalog";
import {
  type ApplyResult,
  ImportRejectedError,
  runImportApply,
} from "@/lib/import/apply";
import { checkUploadedFile, type UploadGuardResult } from "@/lib/import/guards";
import { parseWorkbook } from "@/lib/import/parse";
import { planImport } from "@/lib/import/plan";
import { logImportFailure, logImportSummary } from "@/lib/import/summary";
import { generateTemporaryPassword } from "@/lib/import/temp-password";
import type {
  EntityCounts,
  EntityName,
  ImportSummary,
  ParsedWorkbook,
  RowError,
  TemporaryCredential,
} from "@/lib/import/types";
import { rolesUsuario } from "@/lib/validations/auth";

export type PreviewState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "preview";
      counts: Record<EntityName, EntityCounts>;
      accountsToCreate: number;
      errors: RowError[];
      /** Digest of the bytes just received; echoed back by the confirm form. */
      fileSha256: string;
    };

export type ApplyState =
  | PreviewState // a hash mismatch or a rejected apply re-previews
  | {
      kind: "applied";
      summary: ImportSummary;
      credentials: TemporaryCredential[];
    };

type Translate = Awaited<ReturnType<typeof getTranslations>>;

type Upload =
  { ok: true; workbook: ParsedWorkbook } | { ok: false; state: PreviewState };

const GUARD_MESSAGES = {
  noFile: "errors.noFile",
  wrongExtension: "errors.wrongExtension",
  notAZip: "errors.invalidWorkbook",
  tooLarge: "errors.tooLarge",
} as const satisfies Record<
  Exclude<UploadGuardResult, { ok: true }>["reason"],
  string
>;

/** Authentication, the forced-change redirect and the single import predicate,
 *  in that order. Must be the first statement of every action: nothing of the
 *  request body is read before it returns (CEI: authorization precedes body). */
async function authorize() {
  const session = await requireRole(...rolesUsuario);
  if (!canImportCatalog(session.rol)) redirect(ACCESS_DENIED_PATH);
  return session;
}

function parseFailureMessage(t: Translate, error: RowError): string {
  switch (error.reason) {
    case "sheet.missing":
      return t("errors.sheetMissing", { sheet: error.sheet });
    case "column.missing":
      return t("errors.columnMissing", {
        sheet: error.sheet,
        column: error.value ?? "",
      });
    case "sheet.tooManyRows":
    case "workbook.tooManyRows":
      return t("errors.tooManyRows");
    default:
      return t("errors.invalidWorkbook");
  }
}

/** File guards first, then the parser: an upload that fails a guard never
 *  reaches the zip reader. */
async function readUpload(formData: FormData, t: Translate): Promise<Upload> {
  const fail = (message: string): Upload => ({
    ok: false,
    state: { kind: "error", message },
  });

  const file = formData.get("file");
  if (!(file instanceof File)) return fail(t(GUARD_MESSAGES.noFile));
  const bytes = new Uint8Array(await file.arrayBuffer());

  const guard = checkUploadedFile(bytes, file.name);
  if (!guard.ok) return fail(t(GUARD_MESSAGES[guard.reason]));

  const parsed = await parseWorkbook(bytes);
  if (!parsed.ok) return fail(parseFailureMessage(t, parsed.error));
  return { ok: true, workbook: parsed.workbook };
}

/** Plans against a fresh snapshot and persists nothing. */
async function buildPreview(workbook: ParsedWorkbook): Promise<PreviewState> {
  const plan = planImport(workbook, await loadCatalogSnapshot(db));
  return {
    kind: "preview",
    counts: plan.counts,
    accountsToCreate: plan.accountsToCreate,
    errors: plan.errors,
    fileSha256: workbook.fileSha256,
  };
}

export async function previewAction(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  await authorize();
  const t = await getTranslations("catalog.import");

  const upload = await readUpload(formData, t);
  if (!upload.ok) return upload.state;
  return buildPreview(upload.workbook);
}

/**
 * Stateless confirm: the upload is guarded, parsed and planned again; nothing
 * from the preview survives except the hidden digest, which is only compared,
 * never trusted (decision 15). The credentials live in this return value and
 * nowhere else: no cookie, file, log or module variable ever holds them.
 */
export async function applyAction(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const session = await authorize();
  const t = await getTranslations("catalog.import");

  const upload = await readUpload(formData, t);
  if (!upload.ok) return upload.state;
  const { workbook } = upload;

  // A different file than the one previewed, or a tampered field: show what
  // THIS file would do and apply nothing.
  if (formData.get("fileSha256") !== workbook.fileSha256) {
    return buildPreview(workbook);
  }

  let result: ApplyResult;
  try {
    result = await runImportApply({
      db,
      parsed: workbook,
      sha256: workbook.fileSha256,
      actor: { id: Number(session.sub), login: session.login },
      hash: hashPassword,
      generate: generateTemporaryPassword,
    });
  } catch (error) {
    // The workbook no longer plans cleanly: report the errors from a fresh
    // plan. Any other failure is traced by a sanitized line only: the raw
    // error is never logged because driver errors can embed bound parameters,
    // i.e. password hashes.
    if (error instanceof ImportRejectedError) return buildPreview(workbook);
    try {
      logImportFailure({
        actor: session.login,
        fileSha256: workbook.fileSha256,
        error,
      });
    } catch {
      // Intentionally ignored: the trace must not change the outcome.
    }
    return { kind: "error", message: t("errors.applyFailed") };
  }

  // The transaction has committed and the credentials exist only in `result`,
  // so a failing log sink must never cost the caller their one delivery.
  try {
    logImportSummary(result.summary);
  } catch {
    // Intentionally ignored.
  }
  return { kind: "applied", ...result };
}
