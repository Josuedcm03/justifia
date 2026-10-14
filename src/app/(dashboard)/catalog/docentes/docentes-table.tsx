"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { StatusPill } from "@/components/status-pill";
import { ListNavigationProvider } from "@/components/tables/list-navigation";
import { ListTable } from "@/components/tables/list-table";
import {
  catalogListHref,
  parseDocentesListParams,
  type CatalogListState,
  type DocentesSortKey,
} from "@/lib/catalog/list-params";
import type { DocenteListItem } from "@/lib/catalog/types";

const BASE = "/catalog/docentes";

/**
 * The only shape the table receives (DT-DATA-1): the five displayed fields.
 * The page builds it by picking each field explicitly, so a column added to
 * the read later (a hash, a CIF, a phone) never reaches the browser by
 * accident.
 */
export type DocenteRow = Pick<
  DocenteListItem,
  "id" | "nombreCompleto" | "login" | "correo" | "activo"
>;

/** The state with no search, the default filter and the default sort. */
const DEFAULT_STATE = parseDocentesListParams({});

/**
 * The docentes list as a client table. It is read-only: no action column and
 * no create action; accounts are managed in Users. The column ids are the URL
 * sort keys (`name`, `login`, `email`, `status`). Columns carry function-valued
 * renderers, so they are built here and never cross a server boundary. Every
 * URL is composed by the pure `catalogListHref`, never here.
 */
export function DocentesTable({
  rows,
  total,
  state,
}: {
  rows: readonly DocenteRow[];
  total: number;
  state: CatalogListState<DocentesSortKey>;
}) {
  const t = useTranslations("catalog.docentes");
  const tStatus = useTranslations("catalog.shared.status");

  const columns = useMemo<ColumnDef<DocenteRow>[]>(
    () => [
      {
        id: "name" satisfies DocentesSortKey,
        header: t("columns.name"),
        enableSorting: true,
        cell: ({ row }) => row.original.nombreCompleto,
        meta: { className: "font-medium" },
      },
      {
        id: "login" satisfies DocentesSortKey,
        header: t("columns.login"),
        enableSorting: true,
        cell: ({ row }) => row.original.login,
      },
      {
        id: "email" satisfies DocentesSortKey,
        header: t("columns.email"),
        enableSorting: true,
        // A docente without a Correo reads as words, not as an empty cell.
        cell: ({ row }) =>
          row.original.correo ? (
            row.original.correo
          ) : (
            <span className="text-muted-foreground">{t("noEmail")}</span>
          ),
        meta: { className: "text-muted-foreground" },
      },
      {
        id: "status" satisfies DocentesSortKey,
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
    ],
    [t, tStatus],
  );

  return (
    <ListNavigationProvider>
      <ListTable<DocenteRow, DocentesSortKey>
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
        empty={{ message: t("empty") }}
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
