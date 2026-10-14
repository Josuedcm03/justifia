"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { useListNavigation } from "@/components/tables/list-navigation";
import type { StatusFilterValue } from "@/lib/list-params";

const OPTIONS: readonly StatusFilterValue[] = ["active", "inactive", "all"];

/**
 * The Active / Inactive / All filter (DT-TOOL-1): three real links, so a new
 * tab or a modifier-key click keeps working (DT-NAV-1). A plain click is
 * reported into the shared list transition as a `push` and the link's own
 * client navigation is cancelled, so every control shares one pending flag.
 *
 * The selected option is marked with `aria-current` and a heavier weight as
 * well as the fill, so it never relies on colour alone. It is a filter, not a
 * location: it does not take the `.is-current` underline (design-system 2.3).
 * `hrefFor` is the caller's builder; no URL is composed here (N5).
 */
export function StatusFilter({
  selected,
  hrefFor,
}: {
  selected: StatusFilterValue;
  hrefFor: (value: StatusFilterValue) => string;
}) {
  const t = useTranslations("tables.filter");
  const { navigate } = useListNavigation();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex flex-wrap items-center gap-1"
    >
      {OPTIONS.map((option) => {
        const href = hrefFor(option);
        const isSelected = option === selected;
        return (
          <Link
            key={option}
            href={href}
            scroll={false}
            aria-current={isSelected ? "true" : undefined}
            onNavigate={(event) => {
              event.preventDefault();
              navigate(href, "push");
            }}
            className={cn(
              "text-foreground inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium",
              "hover:bg-muted outline-none",
              "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
              isSelected &&
                "bg-accent text-accent-foreground hover:bg-accent font-semibold",
            )}
          >
            {t(option)}
          </Link>
        );
      })}
    </div>
  );
}
