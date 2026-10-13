"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { TableCard } from "@/components/table-card";
import { DataTable } from "@/components/tables/data-table";
import { useListNavigation } from "@/components/tables/list-navigation";
import { TablePagination } from "@/components/tables/table-pagination";
import { TableToolbar } from "@/components/tables/table-toolbar";
import {
  PAGE_SIZE_OPTIONS,
  applyListChange,
  nextSort,
  type ListSort,
  type PageSize,
  type StatusFilterValue,
} from "@/lib/list-params";

/** The view of a server-driven list, as the page parsed it from the URL. */
export type ListTableState<K extends string> = {
  page: number;
  q: string;
  sort: ListSort<K>;
  size: PageSize;
  /** Present only for the lists that have a status filter. */
  status?: StatusFilterValue;
};

type ListTableProps<T, K extends string> = {
  columns: ColumnDef<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  /** Visually hidden accessible name of the table. */
  caption: string;
  state: ListTableState<K>;
  /** The state with no search, the default filter and the default sort. */
  defaultState: ListTableState<K>;
  /** Total of the current view (search and filter included). */
  total: number;
  /** The caller's pure href builder; no URL is composed in this module. */
  hrefFor: (state: ListTableState<K>) => string;
  search: { label: string; placeholder?: string };
  /** Nothing exists yet: one sentence and, optionally, the create action. */
  empty: { message: string; action?: { href: string; label: string } };
  /** Copy for a search or filter that matched nothing; the clear link is ours. */
  noResults: { title: string; hint: string };
};

/** The form of a submit before hydration: the path and the other parameters. */
function formTarget(href: string) {
  const [action, query = ""] = href.split("?");
  const hidden: Record<string, string> = {};
  for (const [name, value] of new URLSearchParams(query)) {
    if (name !== "q" && name !== "page") hidden[name] = value;
  }
  return { action, hidden };
}

/**
 * One server-driven list: the card with its toolbar, the table and the footer,
 * or the empty or no-results state when there are no rows (DT-STATE-1). The
 * decision between table and state is made here, never by a caller slot, so a
 * table with no rows is never rendered. A degraded read is not handled here:
 * the page shows `DegradedAlert` instead of this component (BS-STATE-2).
 *
 * Every control asks `applyListChange` for the next state and the caller's
 * `hrefFor` for its URL, so the reset-to-page-1 rule (DT-URL-2) and the URL
 * shape each live in one place. Pending feedback comes from the shared list
 * transition (DT-PEND-1); the previous rows stay until the new ones arrive.
 * Columns are built by client modules, so they never cross a server boundary.
 */
export function ListTable<T, K extends string>({
  columns,
  rows,
  getRowId,
  caption,
  state,
  defaultState,
  total,
  hrefFor,
  search,
  empty,
  noResults,
}: ListTableProps<T, K>) {
  const t = useTranslations("tables");
  const { navigate, pending } = useListNavigation();

  const hasStatus = state.status !== undefined;
  const toolbar = (
    <TableToolbar
      q={state.q}
      searchLabel={search.label}
      searchPlaceholder={search.placeholder}
      {...formTarget(hrefFor(applyListChange(state, { q: "" })))}
      hrefFor={(q) => hrefFor(applyListChange(state, { q }))}
      total={total}
      status={
        hasStatus
          ? {
              selected: state.status as StatusFilterValue,
              hrefFor: (status) => hrefFor(applyListChange(state, { status })),
            }
          : undefined
      }
    />
  );

  if (rows.length === 0) {
    const filtered =
      state.q !== "" || (hasStatus && state.status !== defaultState.status);

    if (!filtered) {
      return (
        <EmptyState
          variant="empty"
          message={empty.message}
          action={empty.action}
        />
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <TableCard pending={pending}>
          <div className="px-6 py-4">{toolbar}</div>
        </TableCard>
        <EmptyState
          variant="no-results"
          title={noResults.title}
          hint={noResults.hint}
          clear={{ href: hrefFor(defaultState), label: t("clear") }}
        />
      </div>
    );
  }

  const fitsSmallestPage = total <= PAGE_SIZE_OPTIONS[0];

  return (
    <TableCard
      pending={pending}
      toolbar={toolbar}
      footer={
        fitsSmallestPage ? undefined : (
          <TablePagination
            page={state.page}
            pageSize={state.size}
            total={total}
            hrefFor={(page) => hrefFor(applyListChange(state, { page }))}
            sizeHrefFor={(size) => hrefFor(applyListChange(state, { size }))}
          />
        )
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={getRowId}
        caption={caption}
        sorting={{
          sort: state.sort,
          onSort: (key) =>
            navigate(
              hrefFor(
                applyListChange(state, {
                  sort: nextSort(state.sort, key as K),
                }),
              ),
              "replace",
            ),
        }}
      />
    </TableCard>
  );
}
