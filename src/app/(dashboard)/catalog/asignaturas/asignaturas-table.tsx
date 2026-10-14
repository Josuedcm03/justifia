"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { StatusPill } from "@/components/status-pill";
import { ListNavigationProvider } from "@/components/tables/list-navigation";
import { ListTable } from "@/components/tables/list-table";
import { buttonVariants } from "@/components/ui/button";
import {
  ASIGNATURA_MATCHES_MAX,
  catalogListHref,
  parseAsignaturasListParams,
  type AsignaturasSortKey,
  type CatalogListState,
} from "@/lib/catalog/list-params";
import type { AsignaturaListItem } from "@/lib/catalog/types";

const BASE = "/catalog/asignaturas";

/**
 * The only shape the table receives (DT-DATA-1): the displayed fields and the
 * `Id`. The page builds it by picking each field explicitly, so a field added
 * to the read later (`carreraId` included) never reaches the browser by
 * accident.
 */
export type AsignaturaRow = Pick<
  AsignaturaListItem,
  | "id"
  | "codigo"
  | "nombre"
  | "carreraNombre"
  | "horasTotales"
  | "activo"
  | "grupos"
  | "gruposCoincidentes"
  | "gruposCoincidentesTotal"
>;

/** The state with no search, the default filter and the default sort. */
const DEFAULT_STATE = parseAsignaturasListParams({});

/**
 * The asignaturas list as a client table. Columns carry function-valued
 * renderers, so they are built here, next to the markup, and never cross a
 * server boundary (design decision 5). The sortable column ids are the URL
 * sort keys (`code`, `name`, `hours`, `status`); Career, Groups and the action
 * column are deliberately not sortable (CM-LST-1). Every URL is composed by
 * the pure `catalogListHref`, never here.
 */
export function AsignaturasTable({
  rows,
  total,
  state,
}: {
  rows: readonly AsignaturaRow[];
  total: number;
  state: CatalogListState<AsignaturasSortKey>;
}) {
  const t = useTranslations("catalog.asignaturas");
  const tStatus = useTranslations("catalog.shared.status");

  const columns = useMemo<ColumnDef<AsignaturaRow>[]>(
    () => [
      {
        id: "code" satisfies AsignaturasSortKey,
        header: t("columns.code"),
        enableSorting: true,
        cell: ({ row }) => row.original.codigo,
        meta: { className: "font-medium" },
      },
      {
        id: "name" satisfies AsignaturasSortKey,
        header: t("columns.name"),
        enableSorting: true,
        cell: ({ row }) => {
          const a = row.original;
          if (a.gruposCoincidentes.length === 0) return a.nombre;
          return (
            <div className="flex flex-col gap-1">
              <span>{a.nombre}</span>
              {/* Text only (UG-6): the row's Edit link opens the Asignatura,
                  whose section lists its groups. */}
              <ul
                aria-label={t("matches.label")}
                className="text-label text-muted-foreground flex flex-col gap-1"
              >
                {a.gruposCoincidentes.map((g) => (
                  <li key={g.id}>
                    {t(g.activo ? "matches.item" : "matches.itemInactive", {
                      periodo: g.periodo,
                      numeroGrupo: g.numeroGrupo,
                      docente: g.docenteNombre,
                    })}
                  </li>
                ))}
                {a.gruposCoincidentesTotal > ASIGNATURA_MATCHES_MAX ? (
                  <li>
                    {t("matches.more", {
                      count: a.gruposCoincidentesTotal - ASIGNATURA_MATCHES_MAX,
                    })}
                  </li>
                ) : null}
              </ul>
            </div>
          );
        },
      },
      {
        id: "career",
        header: t("columns.career"),
        cell: ({ row }) => row.original.carreraNombre,
        meta: { className: "text-muted-foreground" },
      },
      {
        id: "hours" satisfies AsignaturasSortKey,
        header: t("columns.hours"),
        enableSorting: true,
        cell: ({ row }) => row.original.horasTotales,
        meta: { align: "end", className: "tabular-nums" },
      },
      {
        id: "groups",
        header: t("columns.groups"),
        // Null (no active group) and an empty string both read as a hyphen.
        cell: ({ row }) => row.original.grupos || "-",
      },
      {
        id: "status" satisfies AsignaturasSortKey,
        header: t("columns.status"),
        enableSorting: true,
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
            href={`${BASE}/${row.original.id}/edit`}
            aria-label={`${t("edit")} ${row.original.codigo}`}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t("edit")}
          </Link>
        ),
        meta: { align: "end" },
      },
    ],
    [t, tStatus],
  );

  return (
    <ListNavigationProvider>
      <ListTable<AsignaturaRow, AsignaturasSortKey>
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        caption={t("tableCaption")}
        state={state}
        defaultState={DEFAULT_STATE}
        total={total}
        hrefFor={(next) => catalogListHref(BASE, next)}
        search={{
          label: t("search.label"),
          placeholder: t("search.placeholder"),
        }}
        empty={{
          message: t("empty"),
          action: { href: `${BASE}/new`, label: t("newButton") },
        }}
        noResults={
          state.q !== ""
            ? {
                title: t("noResults.title", { q: state.q }),
                hint: t("noResults.hint"),
              }
            : {
                title: t("noResults.titleStatus"),
                hint: t("noResults.hint"),
              }
        }
      />
    </ListNavigationProvider>
  );
}
