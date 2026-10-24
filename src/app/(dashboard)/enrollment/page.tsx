import { getTranslations } from "next-intl/server";

import { MyEnrollments } from "@/app/(dashboard)/enrollment/my-enrollments";
import { DegradedAlert } from "@/components/degraded-alert";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { loadEnrollmentPage } from "@/lib/data/enrollment-picker";

const POSITIVE_INTEGER = /^[1-9]\d*$/;

/** `?asignatura=` as a positive safe integer, else null (SE-6): a repeated,
 *  malformed or out-of-range value reads as no selection. */
function parseAsignaturaId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || !POSITIVE_INTEGER.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * The student's own enrollment (RF-16, RF-04). The student comes from the
 * session only (RNF-01); the single query parameter is a guarded asignatura id
 * and the read is fail-soft (a failure shows the shared alert and no action).
 * Only the fields the UI shows are handed to the client components, so a docente
 * email or phone can never reach the browser even if a read ever returned one
 * (RNF-01, RNF-02).
 */
export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(...rolesSolicitantes);
  const t = await getTranslations("enrollment");
  const query = await searchParams;
  const { data, degraded } = await loadEnrollmentPage(
    Number(session.sub),
    parseAsignaturaId(query.asignatura),
  );

  const enrollments = data.enrollments.map((e) => ({
    grupoId: e.grupoId,
    asignaturaId: e.asignaturaId,
    asignaturaCodigo: e.asignaturaCodigo,
    asignaturaNombre: e.asignaturaNombre,
    periodo: e.periodo,
    numeroGrupo: e.numeroGrupo,
    docenteNombre: e.docenteNombre,
    inOpenRequest: e.inOpenRequest,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("description")} />
      {degraded ? (
        <DegradedAlert message={t("degraded")} />
      ) : (
        <>
          <MyEnrollments enrollments={enrollments} />
          {data.periodo === null ? (
            <EmptyState variant="empty" message={t("noOffering")} />
          ) : null}
        </>
      )}
    </div>
  );
}
