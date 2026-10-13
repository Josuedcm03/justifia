import { cn } from "cn";
import { useTranslations } from "next-intl";

// The request state as a status pill (docs/design-system.md §5 Badge, §2.5). The
// state is always written as text; colour only reinforces it (§7). A returned
// request is the one that asks the student to act, so it takes the warning tint.
const TONES: Record<string, string> = {
  pendiente: "bg-muted text-muted-foreground",
  en_revision_coordinacion: "bg-muted text-muted-foreground",
  devuelta: "bg-warning/10 text-warning-ink",
  aprobada: "bg-success/10 text-success-ink",
  rechazada: "bg-destructive/10 text-destructive-ink",
};

export function StatePill({ estado }: { estado: string }) {
  const t = useTranslations("requests.states");

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
        TONES[estado] ?? TONES.pendiente,
      )}
    >
      {t(estado)}
    </span>
  );
}
