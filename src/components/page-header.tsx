import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * The standard opening of every dashboard screen (docs/design-system.md §4.3):
 * one h1 on the display step (24/32 on mobile, 32/40 from `md`), one muted
 * line of context, optional action aligned to the right.
 * Use this rather than hand-rolling a title so the rhythm stays identical
 * across screens.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-display-mobile md:text-display">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-prose">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
