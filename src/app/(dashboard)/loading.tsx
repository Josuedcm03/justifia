import { useTranslations } from "next-intl";

import { PageFrame } from "@/components/page-frame";
import { TableCard } from "@/components/table-card";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = 5;

/**
 * Shown by Next in place of the page while a dashboard route loads (BS-LOAD-1).
 * It draws the page frame (a title, one line of context and a table card of
 * five rows) in `secondary` blocks, so the shell stays in place and the layout
 * does not jump when the page arrives.
 *
 * Synchronous on purpose: a boundary that awaited anything could not show
 * before the data it stands in for. It adds no heading (the page that replaces
 * it owns the single `h1`) and uses no fixed widths, so it wraps at 320px.
 */
export default function DashboardLoading() {
  const t = useTranslations("common");

  return (
    <PageFrame aria-busy="true">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>

      <div className="flex flex-col gap-2">
        <Skeleton data-slot="loading-title" className="h-9 w-2/3 max-w-sm" />
        <Skeleton data-slot="loading-context" className="h-5 w-full max-w-md" />
      </div>

      <TableCard>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div
            key={index}
            data-slot="loading-row"
            className="border-border flex items-center gap-4 border-b px-6 py-4 last:border-b-0"
          >
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="ml-auto h-5 w-1/6" />
          </div>
        ))}
      </TableCard>
    </PageFrame>
  );
}
