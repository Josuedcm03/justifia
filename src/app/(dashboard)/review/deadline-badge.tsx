import { cn } from "cn";

import type { DeadlineStatus } from "@/lib/intake/business-days";

// The RN-08 state as a status pill (docs/design-system.md §5 Badge, §2.5). The
// state is always written as text; colour only reinforces it (§7).
const TONES: Record<DeadlineStatus, string> = {
  en_plazo: "bg-muted text-muted-foreground",
  por_vencer: "bg-warning/10 text-warning-ink",
  vencida: "bg-destructive/10 text-destructive-ink",
};

export function DeadlineBadge({
  status,
  label,
}: {
  status: DeadlineStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
        TONES[status],
      )}
    >
      {label}
    </span>
  );
}
