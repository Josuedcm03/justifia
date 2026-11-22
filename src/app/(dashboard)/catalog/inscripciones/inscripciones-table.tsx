"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useId, useMemo, type FormEvent } from "react";

import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { TableCard } from "@/components/table-card";
import { DataTable } from "@/components/tables/data-table";
import {
  ListNavigationProvider,
  sortControlId,
  useListNavigation,
} from "@/components/tables/list-navigation";
import { TablePagination } from "@/components/tables/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  catalogListHref,
  parseInscripcionesListParams,
  type InscripcionesListState,
  type InscripcionesSortKey,
} from "@/lib/catalog/list-params";
import type { InscripcionListItem } from "@/lib/catalog/types";
import {
  PAGE_SIZE_OPTIONS,
  applyListChange,
  nextSort,
} from "@/lib/list-params";

const BASE = "/catalog/inscripciones";

/**
 * The only shape the table receives (EA-PII-1): the displayed fields. The page
 * builds it by picking each field explicitly, so a column added to the read
 * later (a request count, a sibling flag) never reaches the browser by accident.
 */
export type InscripcionRow = Pick<
  InscripcionListItem,
  | "estudianteId"
  | "grupoId"
  | "estudianteNombre"
  | "estudianteCif"
  | "asignaturaCodigo"
  | "asignaturaNombre"
  | "periodo"
  | "numeroGrupo"
  | "activo"
  | "effective"
>;

const DEFAULT_STATE = parseInscripcionesListParams({});
/** What "clear filters" restores: no term, no filter, the default status. */
const CLEARED_FILTERS = {
  q: "",
  asignatura: "",
  grupo: "",
  periodo: "",
  status: DEFAULT_STATE.status,
} satisfies Partial<InscripcionesListState>;

const hrefOf = (state: InscripcionesListState) => catalogListHref(BASE, state);

const SELECT =
  "border-input bg-card text-foreground h-11 w-full rounded-lg border px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-ring/40 focus-visible:ring-3";

/**
 * The filter bar (EA-FILT-1): one plain GET form, so a submit before hydration
 * works and carries the sort and the page size as hidden fields. With
 * JavaScript the submit goes through the shared list transition; the values are
 * re-parsed by the pure list parser (whitelist and caps) and the URL comes from
 * `catalogListHref`, never from here.
 */
function FilterBar({
  state,
  periods,
  total,
}: {
  state: InscripcionesListState;
  periods: readonly string[];
  total: number;
}) {
  const t = useTranslations("catalog.inscripciones");
  const tTables = useTranslations("tables");
  const { navigate, pending } = useListNavigation();
  const id = useId();

  const hidden = new URLSearchParams(
    hrefOf(applyListChange(state, CLEARED_FILTERS)).split("?")[1] ?? "",
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields: Record<string, string> = {};
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") fields[name] = value;
    }
    const { q, asignatura, grupo, periodo, status } =
      parseInscripcionesListParams(fields);
    navigate(
      hrefOf(applyListChange(state, { q, asignatura, grupo, periodo, status })),
      "push",
    );
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <form
        // Keyed by the URL filters so the uncontrolled fields follow a clear
        // link or the back button without a state mirror.
        key={[
          state.q,
          state.asignatura,
          state.grupo,
          state.periodo,
          state.status,
        ].join("\u0000")}
        method="get"
        action={BASE}
        role="search"
        aria-label={t("filters.label")}
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3"
      >
        {[...hidden].map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <Label htmlFor={`${id}-q`}>{t("filters.student.label")}</Label>
          <Input
            id={`${id}-q`}
            name="q"
            type="search"
            defaultValue={state.q}
            placeholder={t("filters.student.placeholder")}
            maxLength={100}
            className="h-11"
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <Label htmlFor={`${id}-asignatura`}>
            {t("filters.asignatura.label")}
          </Label>
          <Input
            id={`${id}-asignatura`}
            name="asignatura"
            type="search"
            defaultValue={state.asignatura}
            placeholder={t("filters.asignatura.placeholder")}
            maxLength={100}
            className="h-11"
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-28">
          <Label htmlFor={`${id}-grupo`}>{t("filters.grupo.label")}</Label>
          <Input
            id={`${id}-grupo`}
            name="grupo"
            type="search"
            defaultValue={state.grupo}
            placeholder={t("filters.grupo.placeholder")}
            maxLength={12}
            className="h-11"
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <Label htmlFor={`${id}-periodo`}>{t("filters.periodo.label")}</Label>
          <select
            id={`${id}-periodo`}
            name="periodo"
            defaultValue={state.periodo}
            className={SELECT}
          >
            <option value="">{t("filters.periodo.latest")}</option>
            {periods.map((periodo) => (
              <option key={periodo} value={periodo}>
                {periodo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <Label htmlFor={`${id}-status`}>{t("filters.status.label")}</Label>
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={state.status}
            className={SELECT}
          >
            <option value="active">{t("filters.status.active")}</option>
            <option value="inactive">{t("filters.status.inactive")}</option>
          </select>
        </div>
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {t("filters.apply")}
        </Button>
      </form>
      <p
        role="status"
        aria-live="polite"
        className="text-muted-foreground text-sm"
      >
        {pending ? tTables("updating") : tTables("count", { count: total })}
      </p>
    </div>
  );
}

function InscripcionesList({
  rows,
  total,
  state,
  periods,
}: {
  rows: readonly InscripcionRow[];
  total: number;
  state: InscripcionesListState;
  periods: readonly string[];
}) {
  const t = useTranslations("catalog.inscripciones");
  const tTables = useTranslations("tables");
  const { navigate, pending } = useListNavigation();

  const columns = useMemo<ColumnDef<InscripcionRow>[]>(
    () => [
      {
        id: "student" satisfies InscripcionesSortKey,
        header: t("columns.student"),
        enableSorting: true,
        cell: ({ row }) => (
          <>
            <span className="font-medium">{row.original.estudianteNombre}</span>
            {row.original.estudianteCif ? (
              <span className="text-muted-foreground block text-sm">
                {row.original.estudianteCif}
              </span>
            ) : null}
          </>
        ),
      },
      {
        id: "subject" satisfies InscripcionesSortKey,
        header: t("columns.subject"),
        enableSorting: true,
        cell: ({ row }) => (
          <>
            <span className="font-medium">{row.original.asignaturaCodigo}</span>
            <span className="text-muted-foreground block text-sm">
              {row.original.asignaturaNombre}
            </span>
          </>
        ),
      },
      {
        id: "period",
        header: t("columns.period"),
        cell: ({ row }) => row.original.periodo,
      },
      {
        id: "group" satisfies InscripcionesSortKey,
        header: t("columns.group"),
        enableSorting: true,
        cell: ({ row }) => row.original.numeroGrupo,
      },
      {
        // Both states as words (EA-LIST-1): the raw state, and for a raw-active
        // row whether it is also in effect. An inactive row is never "in effect".
        id: "state",
        header: t("columns.state"),
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            <StatusPill
              active={row.original.activo}
              label={
                row.original.activo ? t("state.active") : t("state.inactive")
              }
            />
            {row.original.activo ? (
              <StatusPill
                active={row.original.effective}
                label={
                  row.original.effective
                    ? t("state.effective")
                    : t("state.notEffective")
                }
              />
            ) : null}
          </span>
        ),
      },
    ],
    [t],
  );

  const toolbar = <FilterBar state={state} periods={periods} total={total} />;

  if (rows.length === 0) {
    const filtered =
      state.q !== "" ||
      state.asignatura !== "" ||
      state.grupo !== "" ||
      state.periodo !== "" ||
      state.status !== DEFAULT_STATE.status;
    return (
      <div className="flex flex-col gap-4">
        {/* The filters stay reachable: an empty latest period still has older
            periods and inactive rows behind the filters. */}
        <TableCard pending={pending}>
          <div className="px-6 py-4">{toolbar}</div>
        </TableCard>
        {filtered ? (
          <EmptyState
            variant="no-results"
            title={
              state.q !== ""
                ? t("noResults.title", { q: state.q })
                : t("noResults.titleFilters")
            }
            hint={t("noResults.hint")}
            clear={{
              // Clears what produced "no results"; sort and size are view
              // preferences and stay. The page audits each render, so the link
              // is never prefetched.
              href: hrefOf(applyListChange(state, CLEARED_FILTERS)),
              label: tTables("clear"),
              prefetch: false,
            }}
          />
        ) : (
          <EmptyState variant="empty" message={t("empty")} />
        )}
      </div>
    );
  }

  return (
    <TableCard
      pending={pending}
      toolbar={toolbar}
      footer={
        total <= PAGE_SIZE_OPTIONS[0] ? undefined : (
          <TablePagination
            page={state.page}
            pageSize={state.size}
            total={total}
            // The page audits every render, so no page link may prefetch it.
            prefetch={false}
            hrefFor={(page) => hrefOf(applyListChange(state, { page }))}
            sizeHrefFor={(size) => hrefOf(applyListChange(state, { size }))}
          />
        )
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => `${row.estudianteId}-${row.grupoId}`}
        caption={t("tableCaption")}
        sorting={{
          sort: state.sort,
          onSort: (key) =>
            navigate(
              hrefOf(
                applyListChange(state, {
                  sort: nextSort(state.sort, key as InscripcionesSortKey),
                }),
              ),
              "replace",
              sortControlId(key),
            ),
        }}
      />
    </TableCard>
  );
}

/**
 * The staff inscripciones list as a client table (EA-LIST-1, EA-FILT-1). It is
 * read-only in S1: no action column and no control in a row. The column ids of
 * the sortable columns are the URL sort keys. Columns carry function-valued
 * renderers, so they are built here and never cross a server boundary.
 */
export function InscripcionesTable(props: {
  rows: readonly InscripcionRow[];
  total: number;
  state: InscripcionesListState;
  /** The in-scope periods, newest first, for the period select. */
  periods: readonly string[];
}) {
  return (
    <ListNavigationProvider>
      <InscripcionesList {...props} />
    </ListNavigationProvider>
  );
}
