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
import {
  ASIGNATURA_MATCHES_MAX,
  CATALOG_PAGE_SIZE,
  catalogListHref,
  parseCatalogListParams,
} from "@/lib/catalog/list-params";
import type { AsignaturaListItem } from "@/lib/catalog/types";
import { listAsignaturas } from "@/lib/data/asignaturas";

const BASE = "/catalog/asignaturas";

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

export default async function AsignaturasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog.asignaturas");

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
  const { page, q, status } = parseCatalogListParams(await searchParams);
  const result = await listAsignaturas({
    scope,
    status,
    q,
    page,
    pageSize: CATALOG_PAGE_SIZE,
  });

  const columns: readonly DataTableColumn<AsignaturaListItem>[] = [
    {
      key: "code",
      header: t("columns.code"),
      cell: (a) => a.codigo,
      className: "font-medium",
    },
    {
      key: "name",
      header: t("columns.name"),
      cell: (a) =>
        a.gruposCoincidentes.length === 0 ? (
          a.nombre
        ) : (
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
        ),
    },
    {
      key: "career",
      header: t("columns.career"),
      cell: (a) => a.carreraNombre,
      className: "text-muted-foreground",
    },
    {
      key: "hours",
      header: t("columns.hours"),
      align: "end",
      cell: (a) => a.horasTotales,
      className: "tabular-nums",
    },
    {
      key: "groups",
      header: t("columns.groups"),
      // Null (no active group) and an empty string both read as a hyphen.
      cell: (a) => a.grupos || "-",
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (a) => (
        <StatusPill
          active={a.activo}
          label={a.activo ? tStatus("active") : tStatus("inactive")}
        />
      ),
    },
    {
      key: "actions",
      header: t("columns.actions"),
      align: "end",
      cell: (a) => (
        <Link
          href={`${BASE}/${a.id}/edit`}
          aria-label={`${t("edit")} ${a.codigo}`}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {t("edit")}
        </Link>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  // Anything but the default view is a filtered view; the default view with no
  // rows means the catalog has no active subject at all.
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
              getRowKey={(a) => a.id}
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
