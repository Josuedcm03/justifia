"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Route error boundary of the dashboard (BS-ERR-1). It replaces the page that
 * threw, inside the shell, so it owns the single `h1`.
 *
 * - Never renders `error.message`: in production Next already replaces server
 *   messages with a generic one, and in development the message can carry
 *   internals. `error.digest` is shown as a muted reference for support.
 * - `retry` re-fetches and re-renders the segment (Next 16.3: `retry` is the
 *   stable recovery prop; `reset` only clears the boundary without re-fetching).
 * - A failed read never reaches here: reads return `{ data, degraded }`.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("shell.error");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The page that held focus is gone: move it to the heading so keyboard and
  // screen reader users land on the explanation.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-display-mobile md:text-display outline-none"
      >
        {t("title")}
      </h1>
      <p className="text-muted-foreground max-w-prose">{t("description")}</p>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => retry()}>
          {t("retry")}
        </Button>
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          {t("dashboardLink")}
        </Link>
      </div>

      {error.digest ? (
        <p className="text-muted-foreground text-sm">
          {t("reference", { digest: error.digest })}
        </p>
      ) : null}
    </div>
  );
}
