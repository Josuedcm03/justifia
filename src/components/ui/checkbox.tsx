import * as React from "react";
import { cn } from "cn";

/**
 * A native checkbox (docs/design-system.md §5 Checkbox group). The box has the
 * surface and border of the form input, so it belongs to the form in both
 * themes; checked, it fills with `primary` and shows a mark in
 * `primary-foreground`. The focus ring is the standard one of §7, and in forced
 * colors the browser draws its own box. No role override and no client state:
 * the value travels in a plain form submission.
 */
function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "border-input bg-card dark:bg-input/30 checked:border-primary checked:bg-primary dark:checked:bg-primary focus-visible:border-primary focus-visible:ring-ring/40 aria-invalid:border-destructive grid size-5 shrink-0 cursor-pointer appearance-none place-content-center rounded-[5px] border transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        "before:bg-primary-foreground before:size-3 before:scale-0 before:content-[''] before:[clip-path:polygon(14%_44%,0_58%,40%_96%,100%_20%,86%_6%,38%_68%)] checked:before:scale-100",
        "forced-colors:appearance-auto forced-colors:before:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
