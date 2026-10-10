import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // On focus the border takes the primary (6.44:1, the part of the
        // indicator that clears 3:1) and the turquoise ring glows around it.
        "border-input bg-card file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-ring/40 disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-destructive/30 dark:bg-input/30 dark:disabled:bg-input/60 h-10 w-full min-w-0 rounded-lg border px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
