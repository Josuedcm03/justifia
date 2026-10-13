import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // The pulse is the only movement the shell adds and it stops under
      // reduced motion (BS-MOT-1).
      className={cn(
        "bg-secondary rounded-md motion-safe:animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
