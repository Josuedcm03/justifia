import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DegradedAlert } from "@/components/degraded-alert";
import { PageFrame } from "@/components/page-frame";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import { parseAsignaturasListParams } from "@/lib/catalog/list-params";
import { listAsignaturas } from "@/lib/data/asignaturas";

import { AsignaturasTable, type AsignaturaRow } from "./asignaturas-table";

const BASE = "/catalog/asignaturas";

export default async function AsignaturasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog.asignaturas");

  // A scope of kind `none` is a state of its own, not "no results": nothing
  // is queried and no create control is offered (CM-SCOPE-2).
  if (scope.kind === "none") {
    const tShared = await getTranslations("catalog.shared.noCarrera");
    return (
      <PageFrame>
        <PageHeader title={t("title")} description={t("subtitle")} />
        <section className="border-border bg-card flex flex-col gap-2 rounded-xl border px-6 py-8">
          <h2 className="text-foreground font-medium">{tShared("title")}</h2>
          <p className="text-muted-foreground max-w-prose">
            {tShared("message")}
          </p>
        </section>
      </PageFrame>
    );
  }

  const state = parseAsignaturasListParams(await searchParams);
  // The scope comes from the session actor only; the URL never widens it.
  const result = await listAsignaturas({
    scope,
    status: state.status,
    q: state.q,
    page: state.page,
    pageSize: state.size,
    sort: state.sort,
  });

  // Picked field by field (DT-DATA-1): a column added to the read later, and
  // `carreraId`, never reach the browser by accident.
  const rows: AsignaturaRow[] = result.data.map((a) => ({
    id: a.id,
    codigo: a.codigo,
    nombre: a.nombre,
    carreraNombre: a.carreraNombre,
    horasTotales: a.horasTotales,
    activo: a.activo,
    grupos: a.grupos,
    gruposCoincidentes: a.gruposCoincidentes,
    gruposCoincidentesTotal: a.gruposCoincidentesTotal,
  }));

  return (
    <PageFrame>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Link href={`${BASE}/new`} className={buttonVariants()}>
            {t("newButton")}
          </Link>
        }
      />

      {result.degraded ? (
        <DegradedAlert message={t("degraded")} />
      ) : (
        <AsignaturasTable
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
