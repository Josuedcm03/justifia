import Link from "next/link";

import { DiasCell } from "@/app/(dashboard)/catalog/dias-cell";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import type { DiaSemana } from "@/lib/catalog/dias";
import type {
  AsignaturaGruposResult,
  GrupoListItem,
} from "@/lib/catalog/types";

/** Already-translated copy; the section never calls a translator itself. */
export type AsignaturaGruposLabels = {
  title: string;
  add: string;
  empty: string;
  inactiveHint: string;
  tableCaption: string;
  truncated: string;
  degraded: string;
  edit: string;
  editLabel: (grupo: GrupoListItem) => string;
  columns: {
    periodo: string;
    numeroGrupo: string;
    docente: string;
    dias: string;
    status: string;
    actions: string;
  };
  statusActive: string;
  statusInactive: string;
  diasNotSet: string;
};

const TITLE_ID = "asignatura-grupos-title";

/**
 * The Grupos of one Asignatura on its edit page (CM-ASG-7): synchronous,
 * links only. One "Add group" link while the Asignatura is active, else none.
 */
export function AsignaturaGruposSection({
  result,
  asignaturaId,
  activo,
  labels,
  diaShort,
  diaLong,
}: {
  result: AsignaturaGruposResult;
  asignaturaId: number;
  activo: boolean;
  labels: AsignaturaGruposLabels;
  diaShort: (dia: DiaSemana) => string;
  diaLong: (dia: DiaSemana) => string;
}) {
  const hasRows = result.data.length > 0;
  // Built from the numeric id only; the code never reaches this URL.
  const addHref = `/catalog/asignaturas/${asignaturaId}/grupos/new`;
  // The empty state carries the action when the header does not.
  const headerAdd = activo && (hasRows || result.degraded);

  const columns: readonly DataTableColumn<GrupoListItem>[] = [
    { key: "periodo", header: labels.columns.periodo, cell: (g) => g.periodo },
    {
      key: "numeroGrupo",
      header: labels.columns.numeroGrupo,
      cell: (g) => g.numeroGrupo,
    },
    {
      key: "docente",
      header: labels.columns.docente,
      cell: (g) => g.docenteNombre,
      className: "text-muted-foreground",
    },
    {
      key: "dias",
      header: labels.columns.dias,
      cell: (g) => (
        <DiasCell
          dias={g.dias}
          short={diaShort}
          long={diaLong}
          notSet={labels.diasNotSet}
        />
      ),
    },
    {
      key: "status",
      header: labels.columns.status,
      cell: (g) => (
        <StatusPill
          active={g.activo}
          label={g.activo ? labels.statusActive : labels.statusInactive}
        />
      ),
    },
    {
      key: "actions",
      header: labels.columns.actions,
      align: "end",
      cell: (g) => (
        <Link
          // Built from the numeric ids of the page and of the row only.
          href={`/catalog/asignaturas/${asignaturaId}/grupos/${g.id}/edit`}
          // The name tells two groups of one subject apart.
          aria-label={labels.editLabel(g)}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {labels.edit}
        </Link>
      ),
    },
  ];

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
        <p
          role="status"
          className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
        >
          {labels.degraded}
        </p>
      ) : hasRows ? (
        <>
          <div className="border-border bg-card shadow-soft overflow-hidden rounded-xl border">
            <DataTable
              columns={columns}
              rows={result.data}
              getRowKey={(g) => g.id}
              caption={labels.tableCaption}
              empty={null}
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
