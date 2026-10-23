import Link from "next/link";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { REVIEW_TABS, type ReviewTab } from "@/lib/intake/review-tabs";

const BASE = "/review";

/**
 * The three state tabs of the review list (RF-06, E14). Plain links, so the
 * selected tab is addressable and bookmarkable; none prefetches, because a
 * tab body is an audited read (SR-11). The current tab says so for assistive
 * technology as well as by its filled style.
 */
export function ReviewTabs({ current }: { current: ReviewTab }) {
  const t = useTranslations("review.queue.tabs");

  return (
    <nav
      aria-label={t("label")}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
    >
      {REVIEW_TABS.map((tab) => (
        <Link
          key={tab}
          href={`${BASE}?estado=${tab}`}
          prefetch={false}
          aria-current={tab === current ? "page" : undefined}
          className={`${buttonVariants({
            variant: tab === current ? "default" : "outline",
            size: "lg",
          })} w-full sm:w-auto`}
        >
          {t(tab)}
        </Link>
      ))}
    </nav>
  );
}
