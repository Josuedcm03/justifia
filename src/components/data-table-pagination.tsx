import Link from "next/link";
import { cn } from "cn";

const controlClassName =
  "inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium transition-colors";

/**
 * Real `<Link>` elements, not client-side handlers, so paging works with
 * JavaScript disabled (design.md decision 24). At an edge the control is a
 * disabled-LOOKING `<span aria-disabled="true">`, never a dead `<a>`.
 * `labels.status` arrives already formatted by the caller (e.g. via
 * `next-intl`'s `t("pagination.status", { page, pages })`); this component
 * stays presentational and has no users-domain or i18n knowledge.
 */
export function DataTablePagination({
  page,
  pageSize,
  total,
  hrefFor,
  labels,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  labels: { region: string; previous: string; next: string; status: string };
}) {
  if (total <= pageSize) return null;

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const isFirst = page <= 1;
  const isLast = page >= pages;

  return (
    <nav
      aria-label={labels.region}
      className="flex flex-wrap items-center justify-between gap-4"
    >
      {isFirst ? (
        <span
          aria-disabled="true"
          className={cn(controlClassName, "text-muted-foreground")}
        >
          {labels.previous}
        </span>
      ) : (
        <Link
          href={hrefFor(page - 1)}
          className={cn(controlClassName, "text-primary hover:bg-primary/5")}
        >
          {labels.previous}
        </Link>
      )}

      <span aria-current="page" className="text-muted-foreground text-sm">
        {labels.status}
      </span>

      {isLast ? (
        <span
          aria-disabled="true"
          className={cn(controlClassName, "text-muted-foreground")}
        >
          {labels.next}
        </span>
      ) : (
        <Link
          href={hrefFor(page + 1)}
          className={cn(controlClassName, "text-primary hover:bg-primary/5")}
        >
          {labels.next}
        </Link>
      )}
    </nav>
  );
}
