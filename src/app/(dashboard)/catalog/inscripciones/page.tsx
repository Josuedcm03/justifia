import { getTranslations } from "next-intl/server";

import { DegradedAlert } from "@/components/degraded-alert";
import { PageFrame } from "@/components/page-frame";
import { PageHeader } from "@/components/page-header";
import type { InscripcionReadPayload } from "@/lib/audit/types";
import { requireEnrollmentAccess } from "@/lib/auth/enrollment-access";
import { parseInscripcionesListParams } from "@/lib/catalog/list-params";
import {
  listInscripcionPeriods,
  listInscripciones,
} from "@/lib/data/inscripciones";
import { recordEnrollmentListRead } from "@/lib/data/request-reads";

import { InscripcionesTable, type InscripcionRow } from "./inscripciones-table";

/**
 * The staff inscripciones list (RF-12 a, EA-LIST-1). The guard is the first
 * statement (EA-ACC-1) and the facultad scope comes from it, never from the
 * URL (EA-SCOPE-1). The audited read happens here, in the page body, after
 * authorisation and after the data loaded, and never in the degraded branch
 * (D10): one `inscripcion.lista.consultada` row per render, and a failed
 * insert throws to the error boundary so no data is shown without its row.
 * Every link of this page opts out of prefetch, since a prefetch must not
 * write an audit row; the table does the same for its page links.
 */
export default async function InscripcionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { actorId, scope } = await requireEnrollmentAccess();
  const t = await getTranslations("catalog.inscripciones");
  const header = <PageHeader title={t("title")} description={t("subtitle")} />;

  // A scope of kind `none` is a state of its own, not "no results": nothing is
  // read and nothing is audited (EA-SCOPE-1).
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

  const state = parseInscripcionesListParams(await searchParams);
  const [result, periods] = await Promise.all([
    listInscripciones({
      scope,
      q: state.q,
      asignatura: state.asignatura,
      grupo: state.grupo,
      periodo: state.periodo,
      status: state.status,
      page: state.page,
      pageSize: state.size,
      sort: state.sort,
    }),
    listInscripcionPeriods(scope),
  ]);

  // EA-DEG-1: the alert replaces the table, the counts and the empty states,
  // and a degraded read writes no audit row.
  if (result.degraded) {
    return (
      <PageFrame>
        {header}
        <DegradedAlert message={t("degraded")} />
      </PageFrame>
    );
  }

  // Built once per render (the audited helper dedupes by argument identity).
  // Closed values only: which filters are present, never their text; the period
  // is recorded only when it is a real in-scope period, so typed text never
  // reaches the row (`""` is the default, latest period).
  const payload: InscripcionReadPayload = {
    periodo: periods.includes(state.periodo) ? state.periodo : "",
    status: state.status,
    filters: {
      q: state.q !== "",
      asignatura: state.asignatura !== "",
      grupo: state.grupo !== "",
    },
    page: result.page,
    total: result.total,
  };
  await recordEnrollmentListRead(actorId, scope.facultadId, payload);

  // Picked field by field (EA-PII-1): the sibling flag, the request count, the
  // writable flag and the ids of the asignatura never reach the browser in S1.
  const rows: InscripcionRow[] = result.data.map((r) => ({
    estudianteId: r.estudianteId,
    grupoId: r.grupoId,
    estudianteNombre: r.estudianteNombre,
    estudianteCif: r.estudianteCif,
    asignaturaCodigo: r.asignaturaCodigo,
    asignaturaNombre: r.asignaturaNombre,
    periodo: r.periodo,
    numeroGrupo: r.numeroGrupo,
    activo: r.activo,
    effective: r.effective,
  }));

  return (
    <PageFrame>
      {header}
      <InscripcionesTable
        rows={rows}
        total={result.total}
        // The page the read clamped to, so the paging links never point past
        // the last page.
        state={{ ...state, page: result.page }}
        periods={periods}
      />
    </PageFrame>
  );
}
