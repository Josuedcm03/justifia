import * as React from "react";
import { cn } from "cn";

/**
 * A native checkbox (docs/design-system.md §5 Checkbox group). The check mark is
 * the browser's own shape, tinted with the `primary` token through
 * `accent-color`; the focus ring is the standard one of §7. No role override and
 * no client state: the value travels in a plain form submission.
 */
function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "accent-primary focus-visible:ring-ring/40 size-5 shrink-0 cursor-pointer outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
