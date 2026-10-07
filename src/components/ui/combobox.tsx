"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { cn } from "cn";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

export type ComboboxOption = { value: string; label: string };

export type ComboboxProps = {
  /** Field name: the chosen option's `value` (its id) is submitted under it. */
  name: string;
  items: readonly ComboboxOption[];
  /** Shown in the popup when the typed text matches no option. */
  emptyText: string;
  /** True when `items` was cut at a cap; shows `truncatedText` under the field. */
  truncated?: boolean;
  truncatedText?: string;
  placeholder?: string;
  /** `value` of the option chosen on first render. */
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** What `FormField` passes to its control. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * A text input that filters a list of options in a popup. The input is only the
 * search box: a hidden input named `name` (rendered by Base UI) carries the
 * chosen option's `value`, so it works in a plain `<form>` and with `FormData`.
 * The component knows nothing about what the options are; every text it shows
 * comes from props.
 */
function Combobox({
  name,
  items,
  emptyText,
  truncated = false,
  truncatedText,
  placeholder,
  defaultValue,
  onValueChange,
  required,
  disabled,
  className,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: ComboboxProps) {
  const generatedId = React.useId();
  const noteId = `${id ?? generatedId}-cap`;
  const note = truncated && truncatedText ? truncatedText : undefined;
  const described = [describedBy, note ? noteId : undefined]
    .filter(Boolean)
    .join(" ");

  const initial = React.useMemo(
    () =>
      defaultValue == null
        ? null
        : (items.find((item) => item.value === defaultValue) ?? null),
    // Only the first render decides: the field is uncontrolled afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <ComboboxPrimitive.Root
        name={name}
        items={items as ComboboxOption[]}
        defaultValue={initial}
        isItemEqualToValue={(item, value) => item.value === value.value}
        onValueChange={(next) => onValueChange?.(next?.value ?? null)}
        required={required}
        disabled={disabled}
      >
        <div className="relative">
          <ComboboxPrimitive.Input
            data-slot="combobox-input"
            id={id}
            placeholder={placeholder}
            aria-describedby={described || undefined}
            aria-invalid={invalid}
            className={cn(
              "border-input bg-card placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-ring/40 disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-destructive/30 dark:bg-input/30 dark:disabled:bg-input/60 h-10 w-full min-w-0 rounded-lg border py-2 pr-9 pl-3 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
              className,
            )}
          />
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
          />
        </div>
        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner sideOffset={4} className="isolate z-50">
            <ComboboxPrimitive.Popup
              data-slot="combobox-content"
              className="bg-popover text-popover-foreground border-border shadow-soft relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border"
            >
              <ComboboxPrimitive.Empty className="text-muted-foreground px-3 py-2 text-sm empty:hidden">
                {emptyText}
              </ComboboxPrimitive.Empty>
              <ComboboxPrimitive.List className="p-1">
                {(item: ComboboxOption) => (
                  <ComboboxPrimitive.Item
                    key={item.value}
                    value={item}
                    data-slot="combobox-item"
                    className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex min-h-11 w-full cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    {item.label}
                    <ComboboxPrimitive.ItemIndicator
                      render={
                        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
                      }
                    >
                      <CheckIcon className="size-4" />
                    </ComboboxPrimitive.ItemIndicator>
                  </ComboboxPrimitive.Item>
                )}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>
      {note ? (
        <p id={noteId} className="text-muted-foreground text-xs">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export { Combobox };
