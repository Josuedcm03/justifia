import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

/**
 * Rendered by `notFound()` under `/coordination`. It takes no props on purpose:
 * an unknown id, an answered escalation, a draft and an escalation of another
 * career must look identical (RNF-01).
 */
export default async function CoordinationNotFound() {
  const t = await getTranslations("coordination.notFound");

  return (
    <div className="flex flex-col items-start gap-6">
      <PageHeader title={t("title")} description={t("message")} />
      <Link
        href="/coordination"
        prefetch={false}
        className={buttonVariants({ size: "lg" })}
      >
        {t("back")}
      </Link>
    </div>
  );
}
