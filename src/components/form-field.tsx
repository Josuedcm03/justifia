import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

/** What a control must spread to be associated with its `FormField`. */
export type FormFieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * Label above the control, an optional hint, and the error directly under it
 * with `role="alert"` (docs/design-system.md §5 Form). The control comes from a
 * render function so any input, select trigger or combobox can receive the
 * `id`, `aria-describedby` and `aria-invalid` that tie it to the text.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (control: FormFieldControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-destructive-ink text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
