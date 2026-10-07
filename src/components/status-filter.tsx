import { cn } from "cn";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import {
  catalogListHref,
  type CatalogListBase,
} from "@/lib/catalog/list-params";
import type { CatalogStatusFilter } from "@/lib/catalog/types";

const OPTIONS = ["active", "inactive", "all"] as const;

/**
 * The Active / Inactive / All filter of the catalog lists: three real links
 * (no JavaScript, GET only). The selected one is marked with `aria-current` and
 * the `accent` fill. It is a filter, not a location, so it never carries the
 * "you are here" marker (`.is-current`, design-system.md §2.3). Each href keeps
 * `q` and drops `page`, so a new filter always opens page 1.
 */
export function StatusFilter({
  base,
  q,
  status,
}: {
  base: CatalogListBase;
  q: string;
  status: CatalogStatusFilter;
}) {
  const t = useTranslations("catalog.shared.filter");

  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center gap-1">
      {OPTIONS.map((option) => {
        const selected = option === status;
        return (
          <Link
            key={option}
            href={catalogListHref(base, { q, status: option })}
            aria-current={selected ? "true" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              selected &&
                "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {t(option)}
          </Link>
        );
      })}
    </nav>
  );
}
