"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { cn } from "cn";

import { useListNavigation } from "@/components/tables/list-navigation";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/list-params";

const CONTROL =
  "inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium";

/**
 * The footer of a list card (DT-PAG-1): rows per page on the leading side,
 * then first, previous, the page status and the count, next and last.
 *
 * First, previous, next and last are real links (DT-NAV-1): a plain click is
 * reported into the shared list transition as a `push` and the link's own
 * client navigation is cancelled; a modifier-key click keeps the browser's
 * behaviour. At an edge a control is muted text with `aria-disabled`, never a
 * dead link. The page-size select is a re-arrangement of the same result set,
 * so it `replace`s the history entry.
 *
 * Every href comes from the caller (`hrefFor`, `sizeHrefFor`), which keeps the
 * other parameters and resets the page where the contract says so (N5).
 */
export function TablePagination({
  page,
  pageSize,
  total,
  hrefFor,
  sizeHrefFor,
}: {
  page: number;
  pageSize: PageSize;
  total: number;
  /** The href of a page, keeping every other parameter. */
  hrefFor: (page: number) => string;
  /** The href of a page size: page 1, everything else kept. */
  sizeHrefFor: (size: PageSize) => string;
}) {
  const t = useTranslations("tables");
  const { navigate } = useListNavigation();
  const sizeId = useId();

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pages);

  const control = (target: number, label: string, available: boolean) =>
    available ? (
      <Link
        href={hrefFor(target)}
        scroll={false}
        onNavigate={(event) => {
          event.preventDefault();
          navigate(hrefFor(target), "push");
        }}
        className={cn(
          CONTROL,
          "text-primary hover:bg-primary/5 outline-none",
          "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
        )}
      >
        {label}
      </Link>
    ) : (
      <span
        aria-disabled="true"
        className={cn(CONTROL, "text-muted-foreground")}
      >
        {label}
      </span>
    );

  const hasPrevious = current > 1;
  const hasNext = current < pages;

  return (
    <nav
      aria-label={t("pagination.region")}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={sizeId} className="text-muted-foreground text-sm">
          {t("pageSize.label")}
        </label>
        <select
          id={sizeId}
          value={pageSize}
          onChange={(event) =>
            navigate(
              sizeHrefFor(Number(event.target.value) as PageSize),
              "replace",
            )
          }
          className={cn(
            "border-input bg-card text-foreground h-11 rounded-lg border px-3 text-sm outline-none",
            "focus-visible:border-primary focus-visible:ring-ring/40 focus-visible:ring-3",
          )}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {t("pageSize.option", { size })}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {control(1, t("pagination.first"), hasPrevious)}
        {control(current - 1, t("pagination.previous"), hasPrevious)}
        <span aria-current="page" className="px-2 text-sm font-medium">
          {t("pagination.status", { page: current, pages })}
        </span>
        <span className="text-muted-foreground px-2 text-sm">
          {t("count", { count: total })}
        </span>
        {control(current + 1, t("pagination.next"), hasNext)}
        {control(pages, t("pagination.last"), hasNext)}
      </div>
    </nav>
  );
}
