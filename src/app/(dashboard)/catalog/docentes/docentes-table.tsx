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
  catalogListHref,
  parseDocentesListParams,
  type CatalogListState,
  type DocentesSortKey,
} from "@/lib/catalog/list-params";
import type { DocenteListItem } from "@/lib/catalog/types";

const BASE = "/catalog/docentes";

/**
 * The only shape the table receives (DT-DATA-1): the four displayed fields.
 * The page builds it by picking each field explicitly, so a column added to
 * the read later (a hash, a CIF, a phone) never reaches the browser by
 * accident.
 */
export type DocenteRow = Pick<
  DocenteListItem,
  "id" | "nombreCompleto" | "correo" | "activo"
>;

/** The state with no search, the default filter and the default sort. */
const DEFAULT_STATE = parseDocentesListParams({});

/**
 * The docentes list as a client table. It has no create action (accounts are
 * created in Users and by the import) and, by default, no action column: the
 * page sets `canEdit` only for the role that may maintain docentes, and then a
 * fourth, last, non-sortable column holds an Edit link per row. The column ids
 * of the data columns are the URL sort keys (`name`, `email`, `status`; there
 * is no login column, FE-24). Columns carry function-valued renderers, so they
 * are built here and never cross a server boundary. Every URL is composed by
 * the pure `catalogListHref`, never here.
 */
export function DocentesTable({
  rows,
  total,
  state,
  canEdit = false,
}: {
  rows: readonly DocenteRow[];
  total: number;
  state: CatalogListState<DocentesSortKey>;
  /** Draws the actions column. The page decides it from the server-side
   *  predicate; the table never looks at a role. */
  canEdit?: boolean;
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
      ...(canEdit
        ? [
            {
              id: "actions",
              header: t("columns.actions"),
              // Active or inactive: the edit page shows an inactive docente
              // read-only with the reactivate action (DM-6).
              cell: ({ row }) => (
                <Link
                  href={`${BASE}/${row.original.id}/edit`}
                  aria-label={`${t("edit")} ${row.original.nombreCompleto}`}
                  className={buttonVariants({ variant: "ghost", size: "lg" })}
                >
                  {t("edit")}
                </Link>
              ),
              meta: { align: "end" },
            } satisfies ColumnDef<DocenteRow>,
          ]
        : []),
    ],
    [t, tStatus, canEdit],
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
