import Link from "next/link";

import { AsignaturaGruposTable } from "@/app/(dashboard)/catalog/asignaturas/asignatura-grupos-table";
import { DegradedAlert } from "@/components/degraded-alert";
import { buttonVariants } from "@/components/ui/button";
import type { AsignaturaGruposResult } from "@/lib/catalog/types";

/**
 * Already-translated copy for the strings this server part renders. The
 * table's own copy (headers, status labels, edit label, day names) is read by
 * the client table from the catalog, so none of it travels here.
 */
export type AsignaturaGruposLabels = {
  title: string;
  add: string;
  empty: string;
  inactiveHint: string;
  tableCaption: string;
  truncated: string;
  degraded: string;
};

const TITLE_ID = "asignatura-grupos-title";

/**
 * The Grupos of one Asignatura on its edit page (CM-ASG-7): a server
 * component with the heading, the add link, the hints, the degraded alert, the
 * empty state and the cap note. The rows go to a bounded client table as plain
 * data, picked field by field. One "Add group" link while the Asignatura is
 * active, else none.
 */
export function AsignaturaGruposSection({
  result,
  asignaturaId,
  activo,
  labels,
}: {
  result: AsignaturaGruposResult;
  asignaturaId: number;
  activo: boolean;
  labels: AsignaturaGruposLabels;
}) {
  const hasRows = result.data.length > 0;
  // Built from the numeric id only; the code never reaches this URL.
  const addHref = `/catalog/asignaturas/${asignaturaId}/grupos/new`;
  // The empty state carries the action when the header does not.
  const headerAdd = activo && (hasRows || result.degraded);

  return (
    <section aria-labelledby={TITLE_ID} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id={TITLE_ID} className="text-foreground font-medium">
          {labels.title}
        </h2>
        {headerAdd ? (
          <Link
            href={addHref}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {labels.add}
          </Link>
        ) : null}
      </div>

      {activo ? null : (
        <p className="text-muted-foreground text-sm">{labels.inactiveHint}</p>
      )}

      {result.degraded ? (
        <DegradedAlert message={labels.degraded} />
      ) : hasRows ? (
        <>
          <div className="border-border bg-card shadow-soft overflow-hidden rounded-xl border">
            <AsignaturaGruposTable
              // Only the displayed fields and the id reach the browser.
              rows={result.data.map((g) => ({
                id: g.id,
                periodo: g.periodo,
                numeroGrupo: g.numeroGrupo,
                docenteNombre: g.docenteNombre,
                activo: g.activo,
                dias: g.dias,
              }))}
              asignaturaId={asignaturaId}
              caption={labels.tableCaption}
            />
          </div>
          {result.truncated ? (
            <p className="text-muted-foreground text-sm">{labels.truncated}</p>
          ) : null}
        </>
      ) : (
        <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-8">
          <p className="text-muted-foreground max-w-prose">{labels.empty}</p>
          {activo ? (
            <Link href={addHref} className={buttonVariants()}>
              {labels.add}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
