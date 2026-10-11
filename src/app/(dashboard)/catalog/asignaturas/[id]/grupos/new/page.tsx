import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CreateGrupoForm } from "@/app/(dashboard)/catalog/grupos/bound-controls";
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
import { getAsignaturaById } from "@/lib/data/asignaturas";
import { listDocenteOptions } from "@/lib/data/users";
import { parseRecordId } from "@/lib/validations/catalog";

export default async function NewGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog.grupos");
  const tAsignaturas = await getTranslations("catalog.asignaturas");

  // Rendered above every state of the page: the Asignaturas list, then the
  // Asignatura the group is created under (when one was read), then the page.
  const header = (asignatura?: { id: number; codigo: string }) => (
    <>
      <Breadcrumb aria-label={t("breadcrumb.label")}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/catalog/asignaturas" />}>
              {tAsignaturas("title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {asignatura === undefined ? null : (
            <>
              <BreadcrumbItem>
                {/* Built from the numeric id; the code is only the label. */}
                <BreadcrumbLink
                  render={
                    <Link href={`/catalog/asignaturas/${asignatura.id}/edit`} />
                  }
                >
                  {asignatura.codigo}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            {/* The "you are here" rule — docs/design-system.md §2.3 */}
            <BreadcrumbPage className="is-current">
              {t("breadcrumb.new")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title={t("page.newTitle")}
        description={t("page.newSubtitle")}
      />
    </>
  );

  // A scope of kind `none` is a state of its own: no form and no query, so the
  // route's id is not even read (CM-SCOPE-2).
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

  // A malformed id, a missing Asignatura, one outside the scope and an
  // inactive one all end in the same `notFound()`: the scoped read answers
  // null for the first two kinds of record (CM-SCOPE-1) and a group cannot be
  // created under an inactive parent (CM-GRP-1). `notFound()` throws, so it
  // stays in the render path.
  const id = parseRecordId((await params).id);
  if (id === null) notFound();
  const asignatura = await getAsignaturaById(scope, id);
  if (asignatura === null || !asignatura.activo) notFound();

  // The docentes are read only for a parent the actor may use.
  const docentes = await listDocenteOptions();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">{header(asignatura)}</div>
      <div className="max-w-xl">
        <CreateGrupoForm
          // A different Asignatura remounts the form, so an uncontrolled field
          // never keeps what was typed for the previous one.
          key={asignatura.id}
          asignatura={{
            id: asignatura.id,
            codigo: asignatura.codigo,
            nombre: asignatura.nombre,
          }}
          // The e-mail stays on the server.
          docentes={docentes.map((d) => ({
            id: d.id,
            nombreCompleto: d.nombreCompleto,
          }))}
          docentesTruncated={docentes.length >= CATALOG_OPTIONS_MAX}
        />
      </div>
    </div>
  );
}
