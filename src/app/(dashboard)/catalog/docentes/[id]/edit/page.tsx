import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  DocenteActiveToggle,
  EditDocenteForm,
} from "@/app/(dashboard)/catalog/docentes/bound-controls";
import { PageHeader } from "@/components/page-header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { requireDocenteAccess } from "@/lib/auth/docente-access";
import { catalogListHref } from "@/lib/catalog/list-params";
import { getDocenteById } from "@/lib/data/docentes";
import { parseRecordId } from "@/lib/validations/catalog";

export default async function EditDocentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The guard runs first: a denied caller causes no read of docente data and
  // the route params are never touched (DM-1). Docentes have no scope, so there
  // is nothing else to resolve.
  await requireDocenteAccess();
  const t = await getTranslations("catalog.docentes");

  // A malformed id, a missing record and an account of another role all end
  // here, in the same call: the reader answers null for the last two (DM-2).
  // `notFound()` throws, so it stays in the render path.
  const id = parseRecordId((await params).id);
  if (id === null) notFound();
  const record = await getDocenteById(id);
  if (record === null) notFound();

  const stateTitleId = "docente-state-title";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Breadcrumb aria-label={t("breadcrumb.label")}>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/catalog/docentes" />}>
                {t("title")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {/* The "you are here" rule — docs/design-system.md §2.3 */}
              <BreadcrumbPage className="is-current">
                {t("breadcrumb.edit", { nombre: record.nombreCompleto })}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeader
          title={t("page.editTitle")}
          description={t("page.editSubtitle")}
        />
      </div>

      {/* Picked field by field (DM-2): whatever else the read returned, only
          these five fields and the grupo count reach the browser. */}
      <EditDocenteForm
        record={{
          id: record.id,
          nombreCompleto: record.nombreCompleto,
          correo: record.correo,
          telefono: record.telefono,
          activo: record.activo,
        }}
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

      <section
        aria-labelledby={stateTitleId}
        className="border-border bg-card flex max-w-xl flex-col gap-4 rounded-xl border px-6 py-6"
      >
        <h2 id={stateTitleId} className="text-foreground font-medium">
          {t("state.title")}
        </h2>
        <DocenteActiveToggle
          id={record.id}
          nombreCompleto={record.nombreCompleto}
          correo={record.correo}
          activo={record.activo}
          gruposActivos={record.gruposActivos}
        />
        {record.gruposActivos > 0 ? (
          // The Asignaturas search finds grupos by docente name (CM-ASG-9).
          <Link
            href={catalogListHref("/catalog/asignaturas", {
              q: record.nombreCompleto,
            })}
            className="text-primary inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4"
          >
            {t("state.findGroups")}
          </Link>
        ) : null}
      </section>
    </div>
  );
}
