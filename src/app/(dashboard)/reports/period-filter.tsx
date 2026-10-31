import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

/**
 * The period selector of the dashboard (CR-PERIOD-1): a plain GET form, so the
 * page reloads with `?period=` and nothing is held in client state. `periods`
 * arrive newest first; a well-formed code with no data (a hand-edited URL) is
 * added in its place so the select shows what the rankings use.
 */
export function PeriodFilter({
  label,
  allLabel,
  applyLabel,
  periods,
  selected,
}: {
  label: string;
  allLabel: string;
  applyLabel: string;
  periods: readonly string[];
  /** `all` or a period code. */
  selected: string;
}) {
  const codes =
    selected === ALL || periods.includes(selected)
      ? [...periods]
      : [...periods, selected].sort().reverse();
  const items = [
    { value: ALL, label: allLabel },
    ...codes.map((code) => ({ value: code, label: code })),
  ];

  return (
    <form
      method="get"
      action="/reports"
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <FormField id="period" label={label}>
        {(control) => (
          <Select name="period" defaultValue={selected} items={items}>
            <SelectTrigger {...control} className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <Button type="submit" size="lg">
        {applyLabel}
      </Button>
    </form>
  );
}
