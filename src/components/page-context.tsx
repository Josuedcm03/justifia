"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { trailFor } from "@/lib/navigation";

/**
 * Where the user is, on the leading side of the top bar: the menu group and the
 * menu entry, from the same config as the sidebar (docs/design-system.md 4.3).
 * Orientation text, not a heading and not a second "you are here" marker: it
 * takes neither the sidebar bar nor the breadcrumb underline. Never names a
 * record, so it needs no data from the page.
 */
export function PageContext() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const trail = trailFor(pathname);

  if (!trail) return null;

  return (
    <nav aria-label={t("trailLabel")} className="min-w-0">
      <ol className="flex items-center gap-2 text-sm">
        {trail.groupKey ? (
          <li className="text-muted-foreground hidden items-center gap-2 md:flex">
            <span>{t(trail.groupKey)}</span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </li>
        ) : null}
        <li className="text-foreground min-w-0 truncate font-medium">
          {trail.exact ? (
            <span aria-current="page">{t(trail.key)}</span>
          ) : (
            <Link
              href={trail.href}
              className="hover:text-primary inline-flex min-h-11 items-center"
            >
              {t(trail.key)}
            </Link>
          )}
        </li>
      </ol>
    </nav>
  );
}
