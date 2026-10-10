import { Checkbox } from "@/components/ui/checkbox";

export type CheckboxGroupOption = { value: string; label: string };

/**
 * A small fixed set of independent options (docs/design-system.md §5 Checkbox
 * group). A `fieldset` whose `legend` is the field label, one native checkbox
 * per option inside a 44px-tall label, then the hint and the error as in Form.
 *
 * Uncontrolled: every checked option submits one form entry under the shared
 * `name`, so `FormData.getAll(name)` returns the checked values, and the checked
 * state survives a re-render that adds an `error`. `FormField` is not reused
 * because it hands one id to one control. `aria-invalid` and `aria-required` are
 * not valid on the group role, so the requirement belongs in the `hint` and the
 * error is announced by its alert role.
 */
export function CheckboxGroup({
  id,
  legend,
  name,
  options,
  defaultValues = [],
  hint,
  error,
  disabled = false,
}: {
  id: string;
  legend: string;
  name: string;
  options: readonly CheckboxGroupOption[];
  defaultValues?: readonly string[];
  hint?: string;
  error?: string;
  /** Disables every checkbox through the native `fieldset` attribute. */
  disabled?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");

  return (
    <fieldset
      id={id}
      disabled={disabled}
      aria-describedby={describedBy || undefined}
      className="flex min-w-0 flex-col gap-2"
    >
      <legend className="text-label text-foreground mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-x-6">
        {options.map((option) => (
          <label
            key={option.value}
            className="text-foreground inline-flex min-h-11 items-center gap-2 text-sm select-none"
          >
            <Checkbox
              id={`${id}-${option.value}`}
              name={name}
              value={option.value}
              defaultChecked={defaultValues.includes(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
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
    </fieldset>
  );
}
