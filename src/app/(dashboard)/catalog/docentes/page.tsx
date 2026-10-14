import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DegradedAlert } from "@/components/degraded-alert";
import { PageFrame } from "@/components/page-frame";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import { parseDocentesListParams } from "@/lib/catalog/list-params";
import { listDocentes } from "@/lib/data/users";

import { DocentesTable, type DocenteRow } from "./docentes-table";

export default async function DocentesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The guard runs first. Its scope is deliberately ignored: the Docentes list
  // is not Carrera-scoped, so every allowed role sees the same list.
  await requireCatalogAccess();
  const t = await getTranslations("catalog.docentes");
  const state = parseDocentesListParams(await searchParams);
  const result = await listDocentes({
    status: state.status,
    q: state.q,
    page: state.page,
    pageSize: state.size,
    sort: state.sort,
  });

  // Picked field by field (DT-DATA-1): whatever else the read returns, a hash,
  // a CIF or a phone never reaches the browser.
  const rows: DocenteRow[] = result.data.map((d) => ({
    id: d.id,
    nombreCompleto: d.nombreCompleto,
    login: d.login,
    correo: d.correo,
    activo: d.activo,
  }));

  return (
    <PageFrame>
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
        <DegradedAlert message={t("degraded")} />
      ) : (
        <DocentesTable
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
