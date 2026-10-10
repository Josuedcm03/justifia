import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

/**
 * Rendered by `notFound()` anywhere under `/catalog` (inside the dashboard
 * layout). It takes no props on purpose: a record that does not exist and a
 * record outside the caller's scope must look identical (CM-SCOPE-1). Next.js
 * passes no props to this file either.
 */
export default async function CatalogNotFound() {
  const t = await getTranslations("catalog.shared.notFound");

  return (
    <div className="flex flex-col items-start gap-6">
      <PageHeader title={t("title")} description={t("message")} />
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        {t("back")}
      </Link>
    </div>
  );
}
