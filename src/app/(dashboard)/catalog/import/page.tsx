import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ImportForm } from "@/app/(dashboard)/catalog/import/import-form";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { canImportCatalog } from "@/lib/auth/permissions";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

// Applies to every Server Action used on this page (the apply hashes one
// password per new account). Next reads segment config statically, so this must
// be a literal, not an import; page.test.tsx pins it to
// IMPORT_MAX_DURATION_SECONDS in limits.ts, the decided value.
export const maxDuration = 300;

export default async function CatalogImportPage() {
  const session = await requireRole(...rolesUsuario);
  if (!canImportCatalog(session.rol)) redirect(ACCESS_DENIED_PATH);
  const t = await getTranslations("catalog.import");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ImportForm />
    </div>
  );
}
