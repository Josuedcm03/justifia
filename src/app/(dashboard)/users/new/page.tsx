import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { NewUserForm } from "@/app/(dashboard)/users/new/new-user-form";
import { PageHeader } from "@/components/page-header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { requireRole } from "@/lib/auth/dal";
import { rolesQueGestionanUsuarios } from "@/lib/auth/permissions";
import { listCarreras } from "@/lib/data/carreras";

export default async function NewUserPage() {
  await requireRole(...rolesQueGestionanUsuarios);
  const carreras = await listCarreras();
  const t = await getTranslations("users");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/users" />}>
                {t("title")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {/* The lime rule — docs/design-system.md §2.3 */}
              <BreadcrumbPage className="is-current">
                {t("new.title")}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader title={t("new.title")} description={t("new.subtitle")} />
      </div>

      <NewUserForm carreras={carreras} />
    </div>
  );
}
