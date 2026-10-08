import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import { DataTablePagination } from "@/components/data-table-pagination";
import { DataTableSearch } from "@/components/data-table-search";
import { PageHeader } from "@/components/page-header";
import { StatusFilter } from "@/components/status-filter";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import type { DiaSemana } from "@/lib/catalog/dias";
import {
  CATALOG_PAGE_SIZE,
  catalogListHref,
  parseCatalogListParams,
} from "@/lib/catalog/list-params";
import type { GrupoListItem } from "@/lib/catalog/types";
import { listGrupos } from "@/lib/data/grupos";

const BASE = "/catalog/grupos";

function EmptyOrNoResultsState({
  filtered,
  emptyLabel,
  noResultsTitle,
  noResultsHint,
  newButtonLabel,
}: {
  filtered: boolean;
  emptyLabel: string;
  noResultsTitle: string;
  noResultsHint: string;
  newButtonLabel: string;
}) {
  return (
    <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
      {filtered ? (
        <>
          <p className="text-foreground max-w-prose font-medium">
            {noResultsTitle}
          </p>
          <p className="text-muted-foreground max-w-prose">{noResultsHint}</p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground max-w-prose">{emptyLabel}</p>
          <Link href={`${BASE}/new`} className={buttonVariants()}>
            {newButtonLabel}
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * The days of a group in the cell: short names for sighted users, long names
 * for assistive technology, never both. An empty set (a legacy group) is a
 * plain muted note, not an alert and not an error (amendment 2026-10-07).
 */
function DiasCell({
  dias,
  short,
  long,
  notSet,
}: {
  dias: readonly DiaSemana[];
  short: (dia: DiaSemana) => string;
  long: (dia: DiaSemana) => string;
  notSet: string;
}) {
  if (dias.length === 0) {
    return <span className="text-muted-foreground">{notSet}</span>;
  }
  return (
    <>
      <span aria-hidden="true">{dias.map(short).join(", ")}</span>
      <span className="sr-only">{dias.map(long).join(", ")}</span>
    </>
  );
}

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog.grupos.list");

  const header = (action?: React.ReactNode) => (
    <PageHeader
      title={t("title")}
      description={t("subtitle")}
      action={action}
    />
  );

  // A scope of kind `none` is a state of its own, not "no results": nothing
  // is queried and no create control is offered (CM-SCOPE-2).
  if (scope.kind === "none") {
    const tShared = await getTranslations("catalog.shared.noCarrera");
    return (
      <div className="flex flex-col gap-8">
        {header()}
        <section className="border-border bg-card flex flex-col gap-2 rounded-xl border px-6 py-8">
          <h2 className="text-foreground font-medium">{tShared("title")}</h2>
          <p className="text-muted-foreground max-w-prose">
            {tShared("message")}
          </p>
        </section>
      </div>
    );
  }

  const tStatus = await getTranslations("catalog.shared.status");
  const tDias = await getTranslations("catalog.shared.dias");
  const { page, q, status } = parseCatalogListParams(await searchParams);
  // The docente name travels in `q`; the days are neither filtered nor searched.
  const result = await listGrupos({
    scope,
    status,
    q,
    page,
    pageSize: CATALOG_PAGE_SIZE,
  });

  const columns: readonly DataTableColumn<GrupoListItem>[] = [
    {
      key: "code",
      header: t("columns.code"),
      cell: (g) => g.asignaturaCodigo,
      className: "font-medium",
    },
    {
      key: "subject",
      header: t("columns.subject"),
      cell: (g) => g.asignaturaNombre,
    },
    { key: "periodo", header: t("columns.periodo"), cell: (g) => g.periodo },
    {
      key: "numeroGrupo",
      header: t("columns.numeroGrupo"),
      cell: (g) => g.numeroGrupo,
    },
    {
      key: "docente",
      header: t("columns.docente"),
      cell: (g) => g.docenteNombre,
      className: "text-muted-foreground",
    },
    {
      key: "dias",
      header: t("columns.dias"),
      cell: (g) => (
        <DiasCell
          dias={g.dias}
          short={(dia) => tDias(`short.${dia}`)}
          long={(dia) => tDias(`long.${dia}`)}
          notSet={tDias("notSet")}
        />
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (g) => (
        <StatusPill
          active={g.activo}
          label={g.activo ? tStatus("active") : tStatus("inactive")}
        />
      ),
    },
    {
      key: "actions",
      header: t("columns.actions"),
      align: "end",
      cell: (g) => (
        <Link
          href={`${BASE}/${g.id}/edit`}
          // The name tells two groups of one subject apart.
          aria-label={`${t("edit")} ${g.asignaturaCodigo} ${g.periodo} ${g.numeroGrupo}`}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {t("edit")}
        </Link>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  // Anything but the default view is a filtered view; the default view with no
  // rows means the catalog has no active group at all.
  const filtered = q !== "" || status !== "active";

  return (
    <div className="flex flex-col gap-8">
      {header(
        <Link href={`${BASE}/new`} className={buttonVariants()}>
          {t("newButton")}
        </Link>,
      )}

      {result.degraded ? (
        <p
          role="status"
          className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
        >
          {t("degraded")}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <StatusFilter base={BASE} q={q} status={status} />
            <DataTableSearch
              action={BASE}
              value={q}
              label={t("search.label")}
              placeholder={t("search.placeholder")}
              submitLabel={t("search.submit")}
              clearLabel={t("search.clear")}
              hidden={{ status }}
              clearHref={catalogListHref(BASE, { status })}
            />
          </div>

          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground text-sm"
          >
            {t("count", { count: result.total })}
          </p>

          <div className="border-border bg-card shadow-soft overflow-hidden rounded-xl border">
            <DataTable
              columns={columns}
              rows={result.data}
              getRowKey={(g) => g.id}
              caption={t("tableCaption")}
              empty={
                <EmptyOrNoResultsState
                  filtered={filtered}
                  emptyLabel={t("empty")}
                  noResultsTitle={
                    q ? t("noResults.title", { q }) : t("noResults.titleStatus")
                  }
                  noResultsHint={t("noResults.hint")}
                  newButtonLabel={t("newButton")}
                />
              }
            />
          </div>

          <DataTablePagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            hrefFor={(p) => catalogListHref(BASE, { page: p, q, status })}
            labels={{
              region: t("pagination.region"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              status: t("pagination.status", {
                page: result.page,
                pages: totalPages,
              }),
            }}
          />
        </>
      )}
    </div>
  );
}
