import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * The card every auth screen puts its form in (docs/design-system.md §4.3):
 * white surface, 1px outline, the ambient shadow. The caller sets the measure
 * through `className` — sign-in is narrow, sign-up is not.
 */
export function AuthCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground border-border shadow-soft mx-auto flex w-full flex-col gap-6 rounded-xl border p-6 sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
