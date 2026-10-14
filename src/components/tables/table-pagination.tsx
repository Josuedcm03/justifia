"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { cn } from "cn";

import { useListNavigation } from "@/components/tables/list-navigation";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/list-params";

const CONTROL =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg";
const ICON = "size-5 shrink-0";

/**
 * The footer of a list card (DT-PAG-1): three regions. An empty leading
 * spacer and the rows-per-page selector (trailing) frame the centered
 * cluster: first, previous, the page status, next and last. From `sm` up the
 * cluster is truly centered; on narrow screens the regions stack (cluster
 * first, then the selector) and wrap without horizontal scroll. The total
 * count is not repeated here: the toolbar owns it.
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

  const control = (
    Icon: LucideIcon,
    target: number,
    label: string,
    available: boolean,
  ) =>
    available ? (
      <Link
        href={hrefFor(target)}
        scroll={false}
        onNavigate={(event) => {
          event.preventDefault();
          navigate(hrefFor(target), "push");
        }}
        aria-label={label}
        className={cn(
          CONTROL,
          "text-primary hover:bg-primary/5 outline-none",
          "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
        )}
      >
        <Icon aria-hidden="true" className={ICON} />
      </Link>
    ) : (
      <span
        aria-disabled="true"
        aria-label={label}
        className={cn(CONTROL, "text-muted-foreground")}
      >
        <Icon aria-hidden="true" className={ICON} />
      </span>
    );

  const hasPrevious = current > 1;
  const hasNext = current < pages;

  return (
    <nav
      aria-label={t("pagination.region")}
      className="flex flex-col items-center gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr]"
    >
      <div aria-hidden="true" className="hidden sm:block" />

      <div className="flex flex-wrap items-center justify-center gap-1 sm:col-start-2">
        {control(ChevronsLeft, 1, t("pagination.first"), hasPrevious)}
        {control(
          ChevronLeft,
          current - 1,
          t("pagination.previous"),
          hasPrevious,
        )}
        <span aria-current="page" className="px-2 text-sm font-medium">
          {t("pagination.status", { page: current, pages })}
        </span>
        {control(ChevronRight, current + 1, t("pagination.next"), hasNext)}
        {control(ChevronsRight, pages, t("pagination.last"), hasNext)}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:col-start-3 sm:justify-end">
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
            "border-input bg-card text-foreground min-h-11 rounded-lg border px-3 text-sm outline-none",
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
    </nav>
  );
}
