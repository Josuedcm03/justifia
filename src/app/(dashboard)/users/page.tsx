import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { DegradedAlert } from "@/components/degraded-alert";
import { PageFrame } from "@/components/page-frame";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesQueCreanUsuarios } from "@/lib/auth/permissions";
import { listUsuarios } from "@/lib/data/users";
import { parseUsersListParams } from "@/lib/users/list-params";

import { UsersTable, type UserRow } from "./users-table";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(...rolesQueCreanUsuarios);
  const t = await getTranslations("users");
  const format = await getFormatter();

  const state = parseUsersListParams(await searchParams);
  const result = await listUsuarios({
    viewerRol: session.rol,
    q: state.q,
    status: state.status,
    sort: state.sort,
    page: state.page,
    pageSize: state.size,
  });

  // Picked field by field (UL:fields, DT-DATA-1): a column added to the read
  // later never reaches the browser by accident.
  const rows: UserRow[] = result.data.map((u) => ({
    id: u.id,
    nombreCompleto: u.nombreCompleto,
    login: u.login,
    rol: u.rol,
    activo: u.activo,
    creadoEnLabel: format.dateTime(u.creadoEn, { dateStyle: "medium" }),
  }));

  return (
    <PageFrame>
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
        <DegradedAlert message={t("degraded")} />
      ) : (
        <UsersTable
          rows={rows}
          total={result.total}
          // The page the read clamped to, so the paging links never point
          // past the last page (DT-URL-3).
          state={{ ...state, page: result.page }}
        />
      )}
    </PageFrame>
  );
}
