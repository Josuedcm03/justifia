import { cn } from "cn";

import type { DeadlineStatus } from "@/lib/intake/business-days";

/**
 * What the badge can show: the RN-08 state, or `en_pausa` for a request in
 * coordination (ES-5). `en_pausa` is a display status only; `DeadlineStatus`
 * stays the three computed states.
 */
export type DeadlineBadgeStatus = DeadlineStatus | "en_pausa";

// The RN-08 state as a status pill (docs/design-system.md §5 Badge, §2.5). The
// state is always written as text; colour only reinforces it (§7). A paused
// deadline is muted: it is not an alarm.
const TONES: Record<DeadlineBadgeStatus, string> = {
  en_plazo: "bg-muted text-muted-foreground",
  por_vencer: "bg-warning/10 text-warning-ink",
  vencida: "bg-destructive/10 text-destructive-ink",
  en_pausa: "bg-muted text-muted-foreground",
};

export function DeadlineBadge({
  status,
  label,
}: {
  status: DeadlineBadgeStatus;
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
