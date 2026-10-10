import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { FLOW_PATH } from "@/app/(dashboard)/requests/new/steps";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";

/**
 * Where `submitRequestAction` lands after a successful submit. Static text
 * only: it reads no request, so a refresh or a forged visit shows nothing
 * private. The guard keeps it to students like the rest of the flow (RNF-01).
 */
export default async function ConfirmationPage() {
  await requireRole(...rolesSolicitantes);
  const t = await getTranslations("intake.confirmation");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className={`${buttonVariants({ size: "lg" })} w-full sm:w-auto`}
        >
          {t("home")}
        </Link>
        <Link
          href={FLOW_PATH}
          className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full sm:w-auto`}
        >
          {t("another")}
        </Link>
      </div>
    </div>
  );
}
