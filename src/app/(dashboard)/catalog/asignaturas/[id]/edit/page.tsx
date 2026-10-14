import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  AsignaturaActiveToggle,
  EditAsignaturaForm,
} from "@/app/(dashboard)/catalog/asignaturas/bound-controls";
import { AsignaturaGruposSection } from "@/app/(dashboard)/catalog/asignaturas/asignatura-grupos-section";
import { PageHeader } from "@/components/page-header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import { ASIGNATURA_GRUPOS_MAX } from "@/lib/catalog/list-params";
import { getAsignaturaById, listCarreraOptions } from "@/lib/data/asignaturas";
import { listGruposByAsignatura } from "@/lib/data/grupos";
import { parseRecordId } from "@/lib/validations/catalog";

export default async function EditAsignaturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog.asignaturas");

  // Rendered above every state of the page; the breadcrumb names the record
  // when there is one.
  const header = (codigo?: string) => (
    <>
      <Breadcrumb aria-label={t("breadcrumb.label")}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/catalog/asignaturas" />}>
              {t("title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {/* The "you are here" rule — docs/design-system.md §2.3 */}
            <BreadcrumbPage className="is-current">
              {codigo === undefined
                ? t("page.editTitle")
                : t("breadcrumb.edit", { codigo })}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title={t("page.editTitle")}
        description={t("page.editSubtitle")}
      />
    </>
  );

  // A scope of kind `none` is a state of its own: nothing is read, so no
  // record can be confirmed or denied (CM-SCOPE-2).
  if (scope.kind === "none") {
    const tShared = await getTranslations("catalog.shared.noCarrera");
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">{header()}</div>
        <section className="border-border bg-card flex flex-col gap-2 rounded-xl border px-6 py-8">
          <h2 className="text-foreground font-medium">{tShared("title")}</h2>
          <p className="text-muted-foreground max-w-prose">
            {tShared("message")}
          </p>
        </section>
      </div>
    );
  }

  // A malformed id, a missing record and a record outside the scope all end
  // here, in the same call: the scoped read answers null for the last two
  // (CM-SCOPE-1). `notFound()` throws, so it stays in the render path.
  const id = parseRecordId((await params).id);
  if (id === null) notFound();
  const record = await getAsignaturaById(scope, id);
  if (record === null) notFound();

  const carrera =
    scope.kind === "carrera"
      ? { kind: "fixed" as const, nombre: record.carreraNombre }
      : {
          kind: "choose" as const,
          options: await listCarreraOptions(scope),
        };

  // Only a record the scoped read answered reaches this one, so a foreign or
  // missing id never queries its groups. The read is fail-soft (degraded).
  const grupos = await listGruposByAsignatura(scope, record.id);

  const stateTitleId = "asignatura-state-title";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">{header(record.codigo)}</div>

      <div className="max-w-xl">
        <EditAsignaturaForm
          record={{
            id: record.id,
            codigo: record.codigo,
            nombre: record.nombre,
            horasTotales: record.horasTotales,
            carreraId: record.carreraId,
            activo: record.activo,
          }}
          carrera={carrera}
          // The toggle below is a form of its own, so the inactive form only
          // points to it instead of nesting it.
          reactivate={
            record.activo ? undefined : (
              <p className="text-muted-foreground text-sm">
                {t("page.reactivateHint")}
              </p>
            )
          }
        />
      </div>

      <AsignaturaGruposSection
        result={grupos}
        asignaturaId={record.id}
        activo={record.activo}
        labels={{
          title: t("grupos.title"),
          add: t("grupos.add"),
          empty: t("grupos.empty"),
          inactiveHint: t("grupos.inactiveHint"),
          tableCaption: t("grupos.tableCaption", { codigo: record.codigo }),
          truncated: t("grupos.truncated", { max: ASIGNATURA_GRUPOS_MAX }),
          degraded: t("grupos.degraded"),
        }}
      />

      <section
        aria-labelledby={stateTitleId}
        className="border-border bg-card flex max-w-xl flex-col gap-4 rounded-xl border px-6 py-6"
      >
        <h2 id={stateTitleId} className="text-foreground font-medium">
          {t("state.title")}
        </h2>
        <AsignaturaActiveToggle
          id={record.id}
          recordLabel={`${record.codigo} · ${record.nombre}`}
          activo={record.activo}
          notice={
            record.activo
              ? t("state.activeGroups", { count: record.gruposActivos })
              : undefined
          }
        />
      </section>
    </div>
  );
}
