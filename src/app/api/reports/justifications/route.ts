import { createTranslator } from "next-intl";
import { redirect } from "next/navigation";

import { getUserLocale } from "@/i18n/locale";
import { loadMessages } from "@/i18n/messages";
import { requireRole } from "@/lib/auth/dal";
import { canViewReports } from "@/lib/auth/permissions";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { recordReportDownload } from "@/lib/data/report-reads";
import {
  listReportDocentes,
  listReportExport,
  type ReportRequestView,
} from "@/lib/data/report-requests";
import { resolveReportScope } from "@/lib/data/report-scope";
import { isCausa } from "@/lib/intake/causes";
import type { RawSearchParams } from "@/lib/list-params";
import { buildWorkbook, type WorkbookRow } from "@/lib/reports/build-workbook";
import { detailPeriod, parseReportParams } from "@/lib/reports/params";
import { rolesUsuario } from "@/lib/validations/auth";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const NO_STORE = { "Cache-Control": "private, no-store" };
const BUSINESS_TIME_ZONE = "America/Managua";

/** `YYYY-MM-DD` of an instant in the business time zone (as the screen shows it). */
function businessDay(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** A repeated parameter stays an array, so the parser rejects it like the page. */
function rawParams(search: URLSearchParams): RawSearchParams {
  const raw: RawSearchParams = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    raw[key] = values.length === 1 ? values[0] : values;
  }
  return raw;
}

// The proxy never sees `/api`, so this handler guards itself, in this order:
// authentication and the forced-change redirect (`requireRole`), the single
// report predicate, then the career scope. No read, byte or audit row exists
// before all three have passed. The audit row (CR-XLS-4) is written once the file
// is built and before the response: a failed insert or build sends no bytes.
export async function GET(request: Request): Promise<Response> {
  const session = await requireRole(...rolesUsuario);
  if (!canViewReports(session.rol)) redirect(ACCESS_DENIED_PATH);

  const actorId = Number(session.sub);
  const scope = await resolveReportScope(actorId, session.rol);
  if (scope.kind === "none") redirect(ACCESS_DENIED_PATH);

  // The same parser as the detail page; no hidden default: absent means all.
  const params = parseReportParams(
    rawParams(new URL(request.url).searchParams),
  );
  const period = detailPeriod(params.period);
  const periodValue = period.kind === "all" ? "all" : period.periodo;
  const { docenteId, causa, q } = params;

  try {
    const locale = await getUserLocale();
    const messages = await loadMessages(locale);
    const t = createTranslator({ locale, messages, namespace: "reports" });
    const tCause = createTranslator({
      locale,
      messages,
      namespace: "intake.causes",
    });
    const tState = createTranslator({
      locale,
      messages,
      namespace: "requests.states",
    });

    const [rows, docentes] = await Promise.all([
      listReportExport(scope, {
        periodo: period.kind === "all" ? null : period.periodo,
        docenteId,
        q,
        causa,
      }),
      // Only to name the teacher in the summary; a foreign id is not named.
      docenteId === null ? Promise.resolve([]) : listReportDocentes(scope),
    ]);

    const rowOf = (row: ReportRequestView): WorkbookRow => ({
      student: row.estudianteNombre ?? "",
      cif: row.estudianteCif ?? "",
      cause: isCausa(row.causa) ? tCause(row.causa) : "",
      state: tState(row.estado),
      absence:
        row.fechaInicio && row.fechaFin
          ? t("detail.dates", { start: row.fechaInicio, end: row.fechaFin })
          : "",
      submitted: row.presentadaEn ? businessDay(row.presentadaEn) : "",
      classes: row.classes.map((item) =>
        t("detail.classLine", {
          subject: item.asignatura,
          teacher: item.docente,
          period: item.periodo,
        }),
      ),
    });

    const bytes = await buildWorkbook({
      labels: {
        sheets: {
          requests: t("export.sheets.requests"),
          summary: t("export.sheets.summary"),
        },
        columns: {
          student: t("detail.columns.student"),
          cif: t("detail.columns.cif"),
          cause: t("detail.columns.cause"),
          state: t("detail.columns.state"),
          absence: t("detail.columns.absence"),
          submitted: t("detail.columns.submitted"),
          classes: t("detail.columns.classes"),
        },
        summary: {
          period: t("period.label"),
          teacher: t("detail.filters.teacher"),
          student: t("detail.filters.student"),
          cause: t("detail.filters.cause"),
          total: t("export.summary.total"),
        },
      },
      filters: {
        period: period.kind === "all" ? t("period.all") : period.periodo,
        teacher:
          docenteId === null
            ? t("detail.filters.allTeachers")
            : (docentes.find((item) => item.id === docenteId)?.name ??
              t("detail.filters.teacherOutside")),
        student: q === "" ? t("export.summary.allStudents") : q,
        cause: causa === null ? t("detail.filters.allCauses") : tCause(causa),
      },
      rows: rows.map(rowOf),
    });

    await recordReportDownload(
      actorId,
      scope.carreraId,
      periodValue,
      docenteId,
      causa,
      q !== "",
      rows.length,
    );

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${t("export.fileName")}.xlsx"`,
        ...NO_STORE,
      },
    });
  } catch (error) {
    // The name only: a database message can quote the typed search term.
    console.error(
      JSON.stringify({
        event: "reports.export.failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return Response.json(
      { error: "export_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
