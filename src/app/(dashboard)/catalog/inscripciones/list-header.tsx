import Link from "next/link";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

import { ASSIGN_BASE } from "./assign/assign-params";

/**
 * The header of the staff list. With `withAssign` it carries the way into the
 * assign page (EA-CRE-1), a plain link that never prefetches the audited page
 * (D10); the degraded and no-facultad states show the bare header. It lives
 * here because `page.tsx` may hold no `action=` (the GET-never-mutates pin).
 */
export function InscripcionesHeader({
  withAssign = false,
}: {
  withAssign?: boolean;
}) {
  const t = useTranslations("catalog.inscripciones");

  return (
    <PageHeader
      title={t("title")}
      description={t("subtitle")}
      action={
        withAssign ? (
          <Link
            href={ASSIGN_BASE}
            prefetch={false}
            className={buttonVariants()}
          >
            {t("rowLinks.create")}
          </Link>
        ) : undefined
      }
    />
  );
}
