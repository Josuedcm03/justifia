import Link from "next/link";
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
import { listAsignaturaOptions } from "@/lib/data/asignaturas";
import { listDocenteOptions } from "@/lib/data/users";
import { parseRecordId } from "@/lib/validations/catalog";

export default async function NewGrupoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog.grupos");

  const header = (
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

  // A scope of kind `none` is a state of its own: no form and no query
  // (CM-SCOPE-2).
  if (scope.kind === "none") {
    const tShared = await getTranslations("catalog.shared.noCarrera");
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">{header}</div>
        <section className="border-border bg-card flex flex-col gap-2 rounded-xl border px-6 py-8">
          <h2 className="text-foreground font-medium">{tShared("title")}</h2>
          <p className="text-muted-foreground max-w-prose">
            {tShared("message")}
          </p>
        </section>
      </div>
    );
  }

  // The Asignaturas follow the actor's scope; a failed read propagates.
  const asignaturas = await listAsignaturaOptions(scope);
  const docentes = await listDocenteOptions();
  // `?asignaturaId=` only preselects an Asignatura the form already offers
  // (active, in scope); anything else is ignored silently and costs no extra
  // read, so nothing tells the invalid cases apart (CM-GRP-8, CM-SCOPE-1).
  const requested = parseRecordId((await searchParams).asignaturaId);
  const preselected =
    requested !== null && asignaturas.some((a) => a.id === requested)
      ? requested
      : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">{header}</div>
      <div className="max-w-xl">
        {/* The key starts the form clean when the preselection changes. */}
        <CreateGrupoForm
          key={preselected ?? "none"}
          defaultAsignaturaId={preselected}
          asignaturas={asignaturas}
          // The e-mail stays on the server.
          docentes={docentes.map((d) => ({
            id: d.id,
            nombreCompleto: d.nombreCompleto,
          }))}
          asignaturasTruncated={asignaturas.length >= CATALOG_OPTIONS_MAX}
          docentesTruncated={docentes.length >= CATALOG_OPTIONS_MAX}
        />
      </div>
    </div>
  );
}
