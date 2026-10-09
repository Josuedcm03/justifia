import Link from "next/link";

import { DiasCell } from "@/app/(dashboard)/catalog/dias-cell";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import type { DiaSemana } from "@/lib/catalog/dias";
import { catalogListHref } from "@/lib/catalog/list-params";
import type {
  AsignaturaGruposResult,
  GrupoListItem,
} from "@/lib/catalog/types";

export type AsignaturaGruposText = {
  title: string;
  add: string;
  empty: string;
  inactiveHint: string;
  /** Already formatted with the Asignatura code. */
  tableCaption: string;
  /** Already formatted with `ASIGNATURA_GRUPOS_MAX`. */
  truncated: string;
  viewAll: string;
  degraded: string;
  edit: string;
  editLabel: (g: GrupoListItem) => string;
  columns: {
    periodo: string;
    numeroGrupo: string;
    docente: string;
    dias: string;
    status: string;
    actions: string;
  };
  status: { active: string; inactive: string };
  dias: {
    short: (dia: DiaSemana) => string;
    long: (dia: DiaSemana) => string;
    notSet: string;
  };
};

/**
 * The Grupos of one Asignatura on its edit page (CM-ASG-7, design A-AGS-2).
 * Presentational and synchronous: the page reads the groups and translates
 * every string. Links only, no form or action. While the Asignatura is active
 * exactly one "Add group" link is shown; while inactive, a hint replaces it. A
 * failed read shows a notice and never the empty state.
 */
export function AsignaturaGruposSection({
  asignaturaId,
  codigo,
  activo,
  result,
  text,
}: {
  asignaturaId: number;
  codigo: string;
  activo: boolean;
  result: AsignaturaGruposResult;
  text: AsignaturaGruposText;
}) {
  const titleId = "asignatura-grupos-title";
  // Built from the numeric id only (threat matrix E, link injection).
  const addHref = `/catalog/grupos/new?asignaturaId=${asignaturaId}`;
  const hasRows = result.data.length > 0;
  const showEmpty = !result.degraded && !hasRows;

  const columns: readonly DataTableColumn<GrupoListItem>[] = [
    {
      key: "periodo",
      header: text.columns.periodo,
      cell: (g) => g.periodo,
      className: "font-medium",
    },
    {
      key: "numeroGrupo",
      header: text.columns.numeroGrupo,
      cell: (g) => g.numeroGrupo,
    },
    {
      key: "docente",
      header: text.columns.docente,
      cell: (g) => g.docenteNombre,
      className: "text-muted-foreground",
    },
    {
      key: "dias",
      header: text.columns.dias,
      cell: (g) => (
        <DiasCell
          dias={g.dias}
          short={text.dias.short}
          long={text.dias.long}
          notSet={text.dias.notSet}
        />
      ),
    },
    {
      key: "status",
      header: text.columns.status,
      cell: (g) => (
        <StatusPill
          active={g.activo}
          label={g.activo ? text.status.active : text.status.inactive}
        />
      ),
    },
    {
      key: "actions",
      header: text.columns.actions,
      align: "end",
      cell: (g) => (
        <Link
          href={`/catalog/grupos/${g.id}/edit`}
          aria-label={text.editLabel(g)}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {text.edit}
        </Link>
      ),
    },
  ];

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id={titleId} className="text-foreground font-medium">
          {text.title}
        </h2>
        {activo && !showEmpty ? (
          <Link
            href={addHref}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {text.add}
          </Link>
        ) : null}
      </div>

      {activo ? null : (
        <p className="text-muted-foreground text-sm">{text.inactiveHint}</p>
      )}

      {result.degraded ? (
        <p
          role="status"
          className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
        >
          {text.degraded}
        </p>
      ) : showEmpty ? (
        <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
          <p className="text-muted-foreground max-w-prose">{text.empty}</p>
          {activo ? (
            <Link href={addHref} className={buttonVariants()}>
              {text.add}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="border-border bg-card shadow-soft overflow-hidden rounded-xl border">
            <DataTable
              columns={columns}
              rows={result.data}
              getRowKey={(g) => g.id}
              caption={text.tableCaption}
              empty={null}
            />
          </div>
          {result.truncated ? (
            <p className="text-muted-foreground text-sm">
              {text.truncated}{" "}
              <Link
                href={catalogListHref("/catalog/grupos", {
                  status: "all",
                  q: codigo,
                })}
                className="text-foreground underline underline-offset-4"
              >
                {text.viewAll}
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
