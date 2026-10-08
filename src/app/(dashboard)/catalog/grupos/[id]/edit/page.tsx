import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  EditGrupoForm,
  GrupoActiveToggle,
} from "@/app/(dashboard)/catalog/grupos/bound-controls";
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
import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";
import type { GrupoListItem } from "@/lib/catalog/types";
import { getGrupoById } from "@/lib/data/grupos";
import { listDocenteOptions } from "@/lib/data/users";
import { parseRecordId } from "@/lib/validations/catalog";

export default async function EditGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog.grupos");

  // Rendered above every state of the page; the breadcrumb names the record
  // when there is one.
  const header = (record?: GrupoListItem) => (
    <>
      <Breadcrumb aria-label={t("breadcrumb.label")}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/catalog/grupos" />}>
              {t("list.title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {/* The "you are here" rule — docs/design-system.md §2.3 */}
            <BreadcrumbPage className="is-current">
              {record === undefined
                ? t("page.editTitle")
                : t("breadcrumb.edit", {
                    codigo: record.asignaturaCodigo,
                    periodo: record.periodo,
                    numeroGrupo: record.numeroGrupo,
                  })}
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
  const record = await getGrupoById(scope, id);
  if (record === null) notFound();

  // Only the docente and the days are editable, so no Asignatura is offered.
  const docentes = await listDocenteOptions();

  const stateTitleId = "grupo-state-title";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">{header(record)}</div>

      <div className="max-w-xl">
        <EditGrupoForm
          record={{
            id: record.id,
            asignaturaCodigo: record.asignaturaCodigo,
            asignaturaNombre: record.asignaturaNombre,
            periodo: record.periodo,
            numeroGrupo: record.numeroGrupo,
            docenteId: record.docenteId,
            docenteNombre: record.docenteNombre,
            activo: record.activo,
            dias: record.dias,
          }}
          asignaturas={[]}
          // The e-mail stays on the server.
          docentes={docentes.map((d) => ({
            id: d.id,
            nombreCompleto: d.nombreCompleto,
          }))}
          docentesTruncated={docentes.length >= CATALOG_OPTIONS_MAX}
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

      <section
        aria-labelledby={stateTitleId}
        className="border-border bg-card flex max-w-xl flex-col gap-4 rounded-xl border px-6 py-6"
      >
        <h2 id={stateTitleId} className="text-foreground font-medium">
          {t("state.title")}
        </h2>
        <GrupoActiveToggle
          id={record.id}
          recordLabel={`${record.asignaturaCodigo} · ${record.asignaturaNombre} · ${record.periodo} · ${record.numeroGrupo}`}
          activo={record.activo}
        />
      </section>
    </div>
  );
}
