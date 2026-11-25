import { cn } from "cn";
import { useTranslations } from "next-intl";

export type FileOrigin = "new" | "previous";

/**
 * Where a file of a correction comes from (FE-16, D9). A file listed in the
 * latest revision, the version just returned, is "previous"; any other file was
 * attached during this correction. `null` ids mean the returned version could
 * not be read, and `undefined` means there is no returned version (a new
 * request): in both cases no origin is claimed.
 */
export function originOf(
  documentId: number,
  previousIds: readonly number[] | null | undefined,
): FileOrigin | null {
  if (!previousIds) return null;
  return previousIds.includes(documentId) ? "previous" : "new";
}

const TONES: Record<FileOrigin, string> = {
  new: "bg-primary/10 text-primary",
  previous: "bg-muted text-muted-foreground",
};

/**
 * The text mark "Nuevo" or "Anterior" beside a file name. The word carries the
 * meaning; the tint only reinforces it (docs/design-system.md §7).
 */
export function FileOriginMark({
  documentId,
  previousIds,
}: {
  documentId: number;
  previousIds: readonly number[] | null | undefined;
}) {
  const t = useTranslations("intake.correction.resubmit.marks");
  const origin = originOf(documentId, previousIds);
  if (origin === null) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium",
        TONES[origin],
      )}
    >
      {t(origin)}
    </span>
  );
}
