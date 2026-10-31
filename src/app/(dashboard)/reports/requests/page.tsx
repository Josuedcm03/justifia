import { getFormatter, getTranslations } from "next-intl/server";

import { RequestFilters } from "@/app/(dashboard)/reports/requests/request-filters";
import {
  RequestsPagination,
  RequestsTable,
  type RequestsTableRow,
} from "@/app/(dashboard)/reports/requests/requests-table";
import { DegradedAlert } from "@/components/degraded-alert";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TableCard } from "@/components/table-card";
import { requireRole } from "@/lib/auth/dal";
import { rolesQueVenReportes } from "@/lib/auth/permissions";
import { recordReportRequestsRead } from "@/lib/data/report-reads";
import {
  loadReportRequests,
  type ReportRequestView,
} from "@/lib/data/report-requests";
import { resolveReportScope } from "@/lib/data/report-scope";
import { CAUSAS, isCausa } from "@/lib/intake/causes";
import {
  detailPeriod,
  parseReportParams,
  requestsReportHref,
} from "@/lib/reports/params";

const BASE = "/reports/requests";
const BUSINESS_TIME_ZONE = "America/Managua";
const ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

/**
 * The request detail of the coordination reports (RF-13 b, d, CR-DET-1..4). The
 * audited read happens here, in the page body, after authorisation and after the
 * data loaded (CR-DET-4): never in a layout or a loading file, and every link to
 * this route opts out of prefetch. The typed search term is never audited, only
 * whether one was typed (RNF-06).
 */
export default async function ReportRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(...rolesQueVenReportes);
  const t = await getTranslations("reports");
  const tCause = await getTranslations("intake.causes");
  const tState = await getTranslations("requests.states");
  const tPaging = await getTranslations("tables.pagination");
  const format = await getFormatter();
  const actorId = Number(user.sub);

  const header = (
    <PageHeader
      title={t("detail.title")}
      description={t("detail.description")}
    />
  );

  const scope = await resolveReportScope(actorId, user.rol);
  if (scope.kind === "none") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <div role="alert" className={`${ALERT} flex flex-col gap-1`}>
          <p className="font-medium">{t("noCareer.title")}</p>
          <p>{t("noCareer.message")}</p>
        </div>
      </div>
    );
  }

  const params = parseReportParams(await searchParams);
  // The detail has no hidden default: an absent period means every period.
  const period = detailPeriod(params.period);
  const periodValue = period.kind === "all" ? "all" : period.periodo;
  const { docenteId, causa, q } = params;

  const view = await loadReportRequests(
    scope,
    {
      periodo: period.kind === "all" ? null : period.periodo,
      docenteId,
      q,
      causa,
    },
    params.page,
  );

  if (view.degraded) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <DegradedAlert message={t("detail.degraded")} />
      </div>
    );
  }

  await recordReportRequestsRead(
    actorId,
    scope.carreraId,
    periodValue,
    docenteId,
    causa,
    q !== "",
    view.total,
  );

  const query = { period, docenteId, causa, q };
  const pages = Math.max(1, Math.ceil(view.total / view.pageSize));

  const calendarDate = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  const rowOf = (row: ReportRequestView): RequestsTableRow => ({
    id: row.id,
    student: row.estudianteNombre ?? "",
    cif: row.estudianteCif ?? "",
    cause: isCausa(row.causa) ? tCause(row.causa) : "",
    state: tState(row.estado),
    absence:
      row.fechaInicio && row.fechaFin
        ? t("detail.dates", {
            start: calendarDate(row.fechaInicio),
            end: calendarDate(row.fechaFin),
          })
        : "",
    submitted: row.presentadaEn
      ? format.dateTime(row.presentadaEn, {
          dateStyle: "medium",
          timeZone: BUSINESS_TIME_ZONE,
        })
      : "",
    classes: row.classes.map((item) =>
      t("detail.classLine", {
        subject: item.asignatura,
        teacher: item.docente,
        period: item.periodo,
      }),
    ),
  });

  const filters = (
    <RequestFilters
      labels={{
        region: t("detail.filters.label"),
        period: t("period.label"),
        allPeriods: t("period.all"),
        teacher: t("detail.filters.teacher"),
        allTeachers: t("detail.filters.allTeachers"),
        teacherOutside: t("detail.filters.teacherOutside"),
        student: t("detail.filters.student"),
        studentHint: t("detail.filters.studentHint"),
        cause: t("detail.filters.cause"),
        allCauses: t("detail.filters.allCauses"),
        apply: t("detail.filters.apply"),
        clear: t("detail.filters.clear"),
      }}
      periods={view.periods}
      docentes={view.docentes}
      causes={CAUSAS.map((value) => ({ value, label: tCause(value) }))}
      selected={{ period: periodValue, docenteId, causa, q }}
      clearHref={BASE}
    />
  );

  if (view.total === 0) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        {filters}
        <EmptyState
          variant="no-results"
          title={t("detail.noResults.title")}
          hint={t("detail.noResults.hint")}
          clear={{
            href: BASE,
            label: t("detail.filters.clear"),
            prefetch: false,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {header}
      {filters}
      <TableCard
        toolbar={
          <p role="status" className="text-muted-foreground text-sm">
            {t("requestsCount", { count: view.total })}
          </p>
        }
        footer={
          pages > 1 ? (
            <RequestsPagination
              page={view.page}
              pages={pages}
              labels={{
                region: tPaging("region"),
                previous: tPaging("previous"),
                next: tPaging("next"),
                status: tPaging("status", { page: view.page, pages }),
              }}
              hrefFor={(page) => requestsReportHref(query, page)}
            />
          ) : undefined
        }
      >
        <RequestsTable
          caption={t("detail.caption")}
          columns={{
            student: t("detail.columns.student"),
            cif: t("detail.columns.cif"),
            cause: t("detail.columns.cause"),
            state: t("detail.columns.state"),
            absence: t("detail.columns.absence"),
            submitted: t("detail.columns.submitted"),
            classes: t("detail.columns.classes"),
          }}
          rows={view.rows.map(rowOf)}
        />
      </TableCard>
    </div>
  );
}
