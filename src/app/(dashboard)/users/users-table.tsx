"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { StatusPill } from "@/components/status-pill";
import { ListNavigationProvider } from "@/components/tables/list-navigation";
import { ListTable } from "@/components/tables/list-table";
import {
  parseUsersListParams,
  usersListHref,
  type UsersListState,
  type UsersSortKey,
} from "@/lib/users/list-params";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * The only shape the table receives (UL:fields, DT-DATA-1): the displayed
 * fields, the creation date already formatted on the server, and the `Id`.
 * The page builds it by picking each field explicitly, so a field added to
 * the read later never reaches the browser by accident.
 */
export type UserRow = {
  id: number;
  nombreCompleto: string;
  login: string;
  rol: RolUsuario;
  activo: boolean;
  creadoEnLabel: string;
};

/** The state with no search, the default filter and the default sort. */
const DEFAULT_STATE = parseUsersListParams({});

/**
 * The users list as a client table. Columns carry function-valued renderers,
 * so they are built here, next to the markup, and never cross a server
 * boundary (design decision 5). The sortable column ids are the URL sort keys
 * (`name`, `login`, `role`, `status`, `created`); there is no action column
 * today. Every URL is composed by the pure `usersListHref`, never here.
 */
export function UsersTable({
  rows,
  total,
  state,
}: {
  rows: readonly UserRow[];
  total: number;
  state: UsersListState;
}) {
  const t = useTranslations("users");

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: "name" satisfies UsersSortKey,
        header: t("columns.name"),
        enableSorting: true,
        cell: ({ row }) => row.original.nombreCompleto,
        meta: { className: "font-medium" },
      },
      {
        id: "login" satisfies UsersSortKey,
        header: t("columns.login"),
        enableSorting: true,
        cell: ({ row }) => row.original.login,
        meta: { className: "text-muted-foreground" },
      },
      {
        id: "role" satisfies UsersSortKey,
        header: t("columns.role"),
        enableSorting: true,
        cell: ({ row }) => row.original.rol,
        meta: { className: "capitalize" },
      },
      {
        id: "status" satisfies UsersSortKey,
        header: t("columns.status"),
        enableSorting: true,
        cell: ({ row }) => (
          <StatusPill
            active={row.original.activo}
            label={
              row.original.activo ? t("status.active") : t("status.inactive")
            }
          />
        ),
      },
      {
        id: "created" satisfies UsersSortKey,
        header: t("columns.createdAt"),
        enableSorting: true,
        cell: ({ row }) => row.original.creadoEnLabel,
        meta: { align: "end", className: "text-muted-foreground tabular-nums" },
      },
    ],
    [t],
  );

  return (
    <ListNavigationProvider>
      <ListTable<UserRow, UsersSortKey>
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.id)}
        caption={t("tableCaption")}
        state={state}
        defaultState={DEFAULT_STATE}
        total={total}
        hrefFor={usersListHref}
        search={{
          label: t("search.label"),
          placeholder: t("search.placeholder"),
        }}
        empty={{
          message: t("empty"),
          action: { href: "/users/new", label: t("newButton") },
        }}
        noResults={
          state.q !== ""
            ? {
                title: t("noResults.title", { q: state.q }),
                hint: t("noResults.hint"),
              }
            : {
                title: t("noResults.titleStatus"),
                hint: t("noResults.hintStatus"),
              }
        }
      />
    </ListNavigationProvider>
  );
}
