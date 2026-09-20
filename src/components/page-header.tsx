import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * The standard opening of every dashboard screen (docs/design-system.md §4.3):
 * one h1, one muted line of context, optional action aligned to the right.
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
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-prose">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
