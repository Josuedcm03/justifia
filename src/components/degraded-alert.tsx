import { cn } from "cn";

/**
 * The shared degraded notice (BS-STATE-2): a read could not be loaded.
 *
 * A status region whose meaning is in its text, with the destructive left bar
 * as reinforcement only. Hook-free, so a server page or a client table can use
 * it; the localized copy arrives as a prop. When shown it replaces the data
 * region: callers never render a count or an empty-results message beside it.
 */
export function DegradedAlert({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm",
        className,
      )}
    >
      {message}
    </p>
  );
}
