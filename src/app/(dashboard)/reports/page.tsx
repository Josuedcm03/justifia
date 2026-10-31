import { getTranslations } from "next-intl/server";

import { PeriodFilter } from "@/app/(dashboard)/reports/period-filter";
import {
  RankingCard,
  type RankingRow,
} from "@/app/(dashboard)/reports/ranking-card";
import { DegradedAlert } from "@/components/degraded-alert";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { rolesQueVenReportes } from "@/lib/auth/permissions";
import { loadReportDashboard } from "@/lib/data/report-rankings";
import { recordReportDashboardRead } from "@/lib/data/report-reads";
import { resolveReportScope } from "@/lib/data/report-scope";
import { parseReportParams } from "@/lib/reports/params";

const ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

/**
 * The coordination dashboard (RF-17, CR-DASH-1). The audited read happens here,
 * in the page body, after authorisation and after the data loaded (CR-AUDIT-1):
 * never in a layout or a loading file, and every link to this route opts out of
 * prefetch. No cause, date or state of any request is shown (RNF-06).
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(...rolesQueVenReportes);
  const t = await getTranslations("reports");
  const actorId = Number(user.sub);

  const header = (
    <PageHeader title={t("title")} description={t("description")} />
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

  const { period } = parseReportParams(await searchParams);
  const dashboard = await loadReportDashboard(scope, period);

  if (dashboard.degraded) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <DegradedAlert message={t("degraded")} />
      </div>
    );
  }

  const { periodo, rankings } = dashboard;
  const selected =
    periodo === null ? null : periodo.kind === "all" ? "all" : periodo.periodo;

  await recordReportDashboardRead(
    actorId,
    scope.carreraId,
    selected,
    rankings.estudiantes.length,
    rankings.docentes.length,
    rankings.asignaturas.length,
  );

  if (selected === null) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState variant="empty" message={t("empty")} />
      </div>
    );
  }

  const requests = (count: number) => t("requestsCount", { count });
  const classes = (count: number) => t("classesCount", { count });

  // The cards receive plain display rows, picked field by field: never the
  // data-layer row, so nothing beyond name, CIF or code and count can leak.
  const students: RankingRow[] = rankings.estudiantes.map((row) => ({
    key: String(row.id),
    label: row.name,
    secondary: row.cif ?? undefined,
    totalText: requests(row.total),
  }));
  const teachers: RankingRow[] = rankings.docentes.map((row) => ({
    key: String(row.id),
    label: row.name,
    totalText: classes(row.total),
  }));
  const subjects: RankingRow[] = rankings.asignaturas.map((row) => ({
    key: String(row.id),
    label: row.name,
    secondary: row.codigo,
    totalText: classes(row.total),
  }));

  return (
    <div className="flex flex-col gap-8">
      {header}

      <PeriodFilter
        label={t("period.label")}
        allLabel={t("period.all")}
        applyLabel={t("period.apply")}
        periods={dashboard.periods}
        selected={selected}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <RankingCard
          title={t("students.title")}
          description={t("students.description")}
          rows={students}
          emptyText={t("students.empty")}
        />
        <RankingCard
          title={t("teachers.title")}
          description={t("teachers.description")}
          rows={teachers}
          emptyText={t("teachers.empty")}
        />
        <RankingCard
          title={t("classes.title")}
          description={t("classes.description")}
          rows={subjects}
          emptyText={t("classes.empty")}
        />
      </div>
    </div>
  );
}
