import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

/**
 * Rendered by `notFound()` under `/requests/[id]`. It takes no props on
 * purpose: another student's request, a draft and an unknown id must look
 * identical (RNF-01).
 */
export default async function OwnRequestNotFound() {
  const t = await getTranslations("requests.notFound");

  return (
    <div className="flex flex-col items-start gap-6">
      <PageHeader title={t("title")} description={t("message")} />
      <Link href="/requests" className={buttonVariants({ size: "lg" })}>
        {t("back")}
      </Link>
    </div>
  );
}
