"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DiasCell } from "@/app/(dashboard)/catalog/dias-cell";
import { StatusPill } from "@/components/status-pill";
import { DataTable } from "@/components/tables/data-table";
import { buttonVariants } from "@/components/ui/button";
import type { DiaSemana } from "@/lib/catalog/dias";
import type { GrupoListItem } from "@/lib/catalog/types";

/**
 * The only shape the table receives (DT-DATA-1): the displayed fields and the
 * `Id`. The section builds it by picking each field, so a field added to the
 * read later never reaches the browser by accident.
 */
export type GrupoRow = Pick<
  GrupoListItem,
  "id" | "periodo" | "numeroGrupo" | "docenteNombre" | "activo" | "dias"
>;

/**
 * The Grupos of one Asignatura as a bounded table (DT-MODE-1): no sorting, no
 * toolbar, no pagination and no URL state; the rows are shown in the order
 * the read answered them (CM-ASG-7). The headers, status labels, edit label
 * and day names come from the catalog here, so no function prop crosses the
 * server boundary (design decision 5).
 */
export function AsignaturaGruposTable({
  rows,
  asignaturaId,
  caption,
}: {
  rows: readonly GrupoRow[];
  asignaturaId: number;
  caption: string;
}) {
  const t = useTranslations("catalog.asignaturas.grupos");
  const tStatus = useTranslations("catalog.shared.status");
  const tDias = useTranslations("catalog.shared.dias");

  const columns = useMemo<ColumnDef<GrupoRow>[]>(() => {
    const short = (dia: DiaSemana) => tDias(`short.${dia}`);
    const long = (dia: DiaSemana) => tDias(`long.${dia}`);
    return [
      {
        id: "periodo",
        header: t("columns.periodo"),
        cell: ({ row }) => row.original.periodo,
      },
      {
        id: "numeroGrupo",
        header: t("columns.numeroGrupo"),
        cell: ({ row }) => row.original.numeroGrupo,
      },
      {
        id: "docente",
        header: t("columns.docente"),
        cell: ({ row }) => row.original.docenteNombre,
        meta: { className: "text-muted-foreground" },
      },
      {
        id: "dias",
        header: t("columns.dias"),
        cell: ({ row }) => (
          <DiasCell
            dias={row.original.dias}
            short={short}
            long={long}
            notSet={tDias("notSet")}
          />
        ),
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <StatusPill
            active={row.original.activo}
            label={
              row.original.activo ? tStatus("active") : tStatus("inactive")
            }
          />
        ),
      },
      {
        id: "actions",
        header: t("columns.actions"),
        cell: ({ row }) => (
          <Link
            // Built from the numeric ids of the page and of the row only.
            href={`/catalog/asignaturas/${asignaturaId}/grupos/${row.original.id}/edit`}
            // The name tells two groups of one subject apart.
            aria-label={t("editLabel", {
              periodo: row.original.periodo,
              numeroGrupo: row.original.numeroGrupo,
            })}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t("edit")}
          </Link>
        ),
        meta: { align: "end" },
      },
    ];
  }, [t, tStatus, tDias, asignaturaId]);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.id)}
      caption={caption}
    />
  );
}
