import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DegradedAlert } from "@/components/degraded-alert";
import { EmptyState } from "@/components/empty-state";
import { PageFrame } from "@/components/page-frame";
import { PageHeader } from "@/components/page-header";
import type { InscripcionReadPayload } from "@/lib/audit/types";
import { requireEnrollmentAccess } from "@/lib/auth/enrollment-access";
import { loadAssignPage, searchStudents } from "@/lib/data/inscripciones";
import { recordEnrollmentStudentSearch } from "@/lib/data/request-reads";

import { AssignForm } from "./assign-form";
import { parseAssignParams } from "./assign-params";
import { AsignaturaPicker } from "./asignatura-picker";
import { StudentResults, StudentSearchForm } from "./student-search";

/**
 * The staff assign page (EA-CRE-1, EA-CHG-1): the student search, the chosen
 * student, the subject choice and the offered groups with the student's current
 * group named. The page itself only reads; the confirmed form (a client
 * component) is the one place that writes. The guard is the first statement
 * (EA-ACC-1) and the facultad scope comes from it, never from the URL
 * (EA-SCOPE-1): a malformed, unknown or out-of-scope `estudiante` is not found,
 * alike, before any group is read.
 * Each successful search writes one audit row after its results loaded, never
 * in the degraded branch (D10); a failed insert throws to the error boundary,
 * so no result is shown without its row. No link of this page prefetches it.
 */
export default async function AssignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { actorId, scope } = await requireEnrollmentAccess();
  const t = await getTranslations("catalog.inscripciones");
  const header = (
    <PageHeader title={t("assign.title")} description={t("assign.subtitle")} />
  );
  const degraded = (
    <PageFrame>
      {header}
      <DegradedAlert message={t("assign.degraded")} />
    </PageFrame>
  );

  // A scope of kind `none` is a state of its own: nothing is read or audited.
  if (scope.kind === "none") {
    return (
      <PageFrame>
        {header}
        <section className="border-border bg-card flex flex-col gap-2 rounded-xl border px-6 py-8">
          <h2 className="text-foreground font-medium">
            {t("noFacultad.title")}
          </h2>
          <p className="text-muted-foreground max-w-prose">
            {t("noFacultad.message")}
          </p>
        </section>
      </PageFrame>
    );
  }

  const params = parseAssignParams(await searchParams);
  if (params.estudiante.kind === "invalid") notFound();

  if (params.estudiante.kind === "id") {
    const result = await loadAssignPage(
      scope,
      params.estudiante.id,
      params.asignatura,
    );
    if (result.kind === "not_found") notFound();
    if (result.kind === "degraded") return degraded;

    const { data } = result;
    // Picked field by field (EA-PII-1): a column a read gains later never
    // reaches the components, which are the confirmed form's props.
    const student = {
      id: data.student.id,
      nombreCompleto: data.student.nombreCompleto,
      cif: data.student.cif,
    };
    const picked =
      data.asignaturas.find((a) => a.id === params.asignatura) ?? null;

    return (
      <PageFrame>
        {header}
        <StudentSearchForm q={params.q} />
        <section
          aria-labelledby="assign-student-title"
          className="flex flex-col gap-1"
        >
          <h2 id="assign-student-title" className="text-headline">
            {t("assign.student.title")}
          </h2>
          <p className="font-medium break-words">{student.nombreCompleto}</p>
          {student.cif ? (
            <p className="text-muted-foreground text-sm">
              {t("assign.student.cif", { cif: student.cif })}
            </p>
          ) : null}
        </section>
        {data.periodo === null ? (
          <EmptyState variant="empty" message={t("assign.noOffering")} />
        ) : (
          <>
            <AsignaturaPicker
              studentId={student.id}
              asignaturas={data.asignaturas.map((a) => ({
                id: a.id,
                codigo: a.codigo,
                nombre: a.nombre,
                carreraNombre: a.carreraNombre,
                ownCarrera: a.ownCarrera,
              }))}
              truncated={data.truncated}
              selectedId={params.asignatura}
            />
            {params.asignatura === null ? null : picked &&
              data.groups.length > 0 ? (
              <AssignForm
                student={student}
                asignatura={{
                  id: picked.id,
                  codigo: picked.codigo,
                  nombre: picked.nombre,
                }}
                periodo={data.periodo}
                groups={data.groups.map((g) => ({
                  grupoId: g.grupoId,
                  numeroGrupo: g.numeroGrupo,
                  docenteNombre: g.docenteNombre,
                  dias: g.dias,
                  current: g.current,
                }))}
                currentGroup={
                  data.currentGroup && {
                    grupoId: data.currentGroup.grupoId,
                    numeroGrupo: data.currentGroup.numeroGrupo,
                  }
                }
              />
            ) : (
              <EmptyState variant="empty" message={t("assign.groups.empty")} />
            )}
          </>
        )}
      </PageFrame>
    );
  }

  // No student chosen: the search. A blank term reads and audits nothing, so a
  // missing `?q=` can never list a facultad.
  if (params.q === "") {
    return (
      <PageFrame>
        {header}
        <StudentSearchForm q="" />
      </PageFrame>
    );
  }

  const found = await searchStudents(scope, params.q);
  if (found.degraded) return degraded;

  // Built once per render (the audited helper dedupes by argument identity).
  // Closed values only: that a term was used, never its text. The search is not
  // bound to a period, so the period is empty, and every searched student is
  // active, so the status is `active`.
  const payload: InscripcionReadPayload = {
    periodo: "",
    status: "active",
    filters: { q: true, asignatura: false, grupo: false },
    page: 1,
    total: found.data.length,
  };
  await recordEnrollmentStudentSearch(actorId, scope.facultadId, payload);

  return (
    <PageFrame>
      {header}
      <StudentSearchForm q={params.q} />
      <StudentResults
        q={params.q}
        students={found.data.map((s) => ({
          id: s.id,
          nombreCompleto: s.nombreCompleto,
          cif: s.cif,
        }))}
      />
    </PageFrame>
  );
}
