import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

/**
 * Rendered by `notFound()` under `/review`. It takes no props on purpose: an
 * unknown id, a draft and a request outside the caller's facultad must look
 * identical (RNF-01).
 */
export default async function ReviewNotFound() {
  const t = await getTranslations("review.notFound");

  return (
    <div className="flex flex-col items-start gap-6">
      <PageHeader title={t("title")} description={t("message")} />
      <Link
        href="/review"
        prefetch={false}
        className={buttonVariants({ size: "lg" })}
      >
        {t("back")}
      </Link>
    </div>
  );
}
