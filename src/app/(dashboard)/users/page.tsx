import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import { DataTablePagination } from "@/components/data-table-pagination";
import { DataTableSearch } from "@/components/data-table-search";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesQueCreanUsuarios } from "@/lib/auth/permissions";
import { listUsuarios, type UsuarioConRol } from "@/lib/data/users";
import {
  USERS_PAGE_SIZE,
  parseUsersListParams,
  usersListHref,
} from "@/lib/users/list-params";

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? "bg-accent text-accent-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          : "bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      }
    >
      {label}
    </span>
  );
}

function EmptyOrNoResultsState({
  q,
  emptyLabel,
  noResultsTitle,
  noResultsHint,
  newButtonLabel,
}: {
  q: string;
  emptyLabel: string;
  noResultsTitle: string;
  noResultsHint: string;
  newButtonLabel: string;
}) {
  return (
    <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
      {q ? (
        <>
          <p className="text-foreground max-w-prose font-medium">
            {noResultsTitle}
          </p>
          <p className="text-muted-foreground max-w-prose">{noResultsHint}</p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground max-w-prose">{emptyLabel}</p>
          <Link href="/users/new" className={buttonVariants()}>
            {newButtonLabel}
          </Link>
        </>
      )}
    </div>
  );
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(...rolesQueCreanUsuarios);
  const t = await getTranslations("users");
  const format = await getFormatter();

  const { page, q } = parseUsersListParams(await searchParams);
  const result = await listUsuarios({
    viewerRol: session.rol,
    q,
    page,
    pageSize: USERS_PAGE_SIZE,
  });

  const columns: readonly DataTableColumn<UsuarioConRol>[] = [
    {
      key: "name",
      header: t("columns.name"),
      cell: (u) => u.nombreCompleto,
      className: "font-medium",
    },
    {
      key: "login",
      header: t("columns.login"),
      cell: (u) => u.login,
      className: "text-muted-foreground",
    },
    {
      key: "role",
      header: t("columns.role"),
      cell: (u) => u.rol,
      className: "capitalize",
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (u) => (
        <StatusPill
          active={u.activo}
          label={u.activo ? t("status.active") : t("status.inactive")}
        />
      ),
    },
    {
      key: "createdAt",
      header: t("columns.createdAt"),
      align: "end",
      cell: (u) => format.dateTime(u.creadoEn, { dateStyle: "medium" }),
      className: "text-muted-foreground tabular-nums",
    },
  ];

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Link href="/users/new" className={buttonVariants()}>
            {t("newButton")}
          </Link>
        }
      />

      {result.degraded ? (
        <p
          role="status"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {t("degraded")}
        </p>
      ) : (
        <>
          <DataTableSearch
            action="/users"
            value={q}
            label={t("search.label")}
            placeholder={t("search.placeholder")}
            submitLabel={t("search.submit")}
            clearLabel={t("search.clear")}
          />

          <p role="status" aria-live="polite">
            {t("count", { count: result.total })}
          </p>

          <div className="border-border bg-card overflow-hidden rounded-xl border">
            <DataTable
              columns={columns}
              rows={result.data}
              getRowKey={(u) => u.id}
              caption={t("tableCaption")}
              empty={
                <EmptyOrNoResultsState
                  q={q}
                  emptyLabel={t("empty")}
                  noResultsTitle={t("noResults.title", { q })}
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
            hrefFor={(p) => usersListHref({ page: p, q })}
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
