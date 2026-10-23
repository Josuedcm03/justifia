// Pieces the escalation and absence-report dialogs share (docs/design-system.md
// §5 Form, Alert, Dialog). The classes mirror the decision dialog, so the three
// staff dialogs look and behave alike (RNF-12).

/** The catalog alert banner of a refusal that names no field. */
export const DIALOG_ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink flex flex-col gap-2 rounded-lg border border-l-4 px-3 py-2 text-sm";

export const DIALOG_TEXTAREA =
  "border-input bg-card placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/30 dark:bg-input/30 min-h-32 w-full rounded-lg border px-3 py-2 text-base transition-colors outline-none focus-visible:ring-3 aria-invalid:ring-3 md:text-sm";

/** Messages under one control, already translated; nothing when empty. */
export function FieldMessages({
  id,
  messages,
}: {
  id: string;
  messages: readonly string[];
}) {
  if (messages.length === 0) return null;
  return (
    <div
      id={id}
      role="alert"
      className="text-destructive-ink flex flex-col gap-1 text-sm"
    >
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}
