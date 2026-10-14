import type { ComponentProps } from "react";
import { cn } from "cn";

/**
 * One vertical stack inside the shell (docs/design-system.md section 4.3,
 * "Page frame"): the page header, then its cards, with the 32px rhythm. Adopted
 * by the pages this change rewrites; other pages keep their identical wrapper.
 */
export function PageFrame({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-frame"
      className={cn("flex flex-col gap-8", className)}
      {...props}
    />
  );
}
