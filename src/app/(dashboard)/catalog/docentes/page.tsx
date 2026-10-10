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
  CATALOG_PAGE_SIZE,
  catalogListHref,
  parseCatalogListParams,
} from "@/lib/catalog/list-params";
import type { DocenteListItem } from "@/lib/catalog/types";
import { listDocentes } from "@/lib/data/users";

const BASE = "/catalog/docentes";

function EmptyOrNoResultsState({
  filtered,
  emptyLabel,
  noResultsTitle,
  noResultsHint,
}: {
  filtered: boolean;
  emptyLabel: string;
  noResultsTitle: string;
  noResultsHint: string;
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
        <p className="text-muted-foreground max-w-prose">{emptyLabel}</p>
      )}
    </div>
  );
}

export default async function DocentesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The guard runs first. Its scope is deliberately ignored: the Docentes list
  // is not Carrera-scoped, so every allowed role sees the same list.
  await requireCatalogAccess();
  const t = await getTranslations("catalog.docentes");
  const tStatus = await getTranslations("catalog.shared.status");
  const { page, q, status } = parseCatalogListParams(await searchParams);
  const result = await listDocentes({
    status,
    q,
    page,
    pageSize: CATALOG_PAGE_SIZE,
  });

  // Each row is mapped to the five listed fields, whatever the data layer sent.
  const rows: readonly DocenteListItem[] = result.data.map((d) => ({
    id: d.id,
    nombreCompleto: d.nombreCompleto,
    login: d.login,
    correo: d.correo,
    activo: d.activo,
  }));

  const columns: readonly DataTableColumn<DocenteListItem>[] = [
    {
      key: "name",
      header: t("columns.name"),
      cell: (d) => d.nombreCompleto,
      className: "font-medium",
    },
    { key: "login", header: t("columns.login"), cell: (d) => d.login },
    {
      key: "email",
      header: t("columns.email"),
      cell: (d) =>
        d.correo ? (
          d.correo
        ) : (
          <span className="text-muted-foreground">{t("noEmail")}</span>
        ),
      className: "text-muted-foreground",
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (d) => (
        <StatusPill
          active={d.activo}
          label={d.activo ? tStatus("active") : tStatus("inactive")}
        />
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  // Anything but the default view is a filtered view; the default view with no
  // rows means there is no active docente at all.
  const filtered = q !== "" || status !== "active";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Link
            href="/users"
            className={buttonVariants({ variant: "outline" })}
          >
            {t("usersLink")}
          </Link>
        }
      />

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
              rows={rows}
              getRowKey={(d) => d.id}
              caption={t("tableCaption")}
              empty={
                <EmptyOrNoResultsState
                  filtered={filtered}
                  emptyLabel={t("empty")}
                  noResultsTitle={
                    q ? t("noResults.title", { q }) : t("noResults.titleStatus")
                  }
                  noResultsHint={t("noResults.hint")}
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
