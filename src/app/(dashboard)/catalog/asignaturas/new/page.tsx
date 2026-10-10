import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CreateAsignaturaForm } from "@/app/(dashboard)/catalog/asignaturas/bound-controls";
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
import { listCarreraOptions } from "@/lib/data/asignaturas";

export default async function NewAsignaturaPage() {
  const { scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog.asignaturas");

  const header = (
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

  const options = await listCarreraOptions(scope);
  // A scoped actor sees the own Carrera as text; the server decides it anyway.
  const carrera =
    scope.kind === "carrera"
      ? { kind: "fixed" as const, nombre: options[0]?.nombre ?? "" }
      : { kind: "choose" as const, options };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">{header}</div>
      <div className="max-w-xl">
        <CreateAsignaturaForm carrera={carrera} />
      </div>
    </div>
  );
}
