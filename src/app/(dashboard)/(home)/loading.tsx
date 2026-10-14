import { useTranslations } from "next-intl";

import { PageFrame } from "@/components/page-frame";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// The skeleton is role-agnostic: it cannot know the role before the page
// resolves, so it always draws the same neutral number of cards.
const COUNT_CARDS = 2;
const SHORTCUT_CARDS = 4;

// Same grid as the real home, so the columns collapse to one below `sm`.
const GRID = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

function CardSkeleton() {
  return (
    <Card data-slot="loading-card">
      <CardHeader className="gap-1">
        <Skeleton className="mb-3 size-12 rounded-lg" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full max-w-xs" />
      </CardHeader>
    </Card>
  );
}

/**
 * Shown by Next in place of the home while it loads (BS-LOAD-1). It lives in
 * the `(home)` route group so it replaces only the home page; every other
 * dashboard route keeps the table skeleton of `(dashboard)/loading.tsx`.
 *
 * It mirrors the home: a title bar and one subtitle line, the count cards, then
 * the shortcut cards. Synchronous on purpose, no heading (the page owns the
 * single `h1`), no landmark, and no fixed widths so it wraps at 320px.
 */
export default function HomeLoading() {
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

      <div data-slot="loading-grid" className={GRID}>
        {Array.from({ length: COUNT_CARDS }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>

      <div data-slot="loading-grid" className={GRID}>
        {Array.from({ length: SHORTCUT_CARDS }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </PageFrame>
  );
}
