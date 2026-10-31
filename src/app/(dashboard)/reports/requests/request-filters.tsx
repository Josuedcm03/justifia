import Link from "next/link";

import { FormField } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

type Item = { value: string; label: string };

export type RequestFilterLabels = {
  /** Names the form landmark. */
  region: string;
  period: string;
  allPeriods: string;
  teacher: string;
  allTeachers: string;
  /** Generic text for a teacher id that is not among the career's teachers. */
  teacherOutside: string;
  student: string;
  studentHint: string;
  cause: string;
  allCauses: string;
  apply: string;
  clear: string;
};

/** A select that submits its value under `name` and shows `items` by label. */
function FilterSelect({
  id,
  label,
  name,
  selected,
  items,
}: {
  id: string;
  label: string;
  name: string;
  selected: string;
  items: readonly Item[];
}) {
  return (
    <FormField id={id} label={label}>
      {(control) => (
        <Select name={name} defaultValue={selected} items={[...items]}>
          <SelectTrigger {...control} className="w-full">
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
  );
}

/**
 * The filters of the request detail (CR-DET-2): period, teacher, student and
 * cause in a plain GET form, so the page reloads with the query string and
 * nothing is held in client state. Applying a filter starts at page 1 because no
 * page is submitted. A well-formed period or teacher id that is not among the
 * options (a hand-edited URL) is added in its place, so the control shows what
 * the table uses; a teacher outside the career shows generic text, never a name.
 * The clear control is a link that never prefetches the audited page.
 */
export function RequestFilters({
  labels,
  periods,
  docentes,
  causes,
  selected,
  clearHref,
}: {
  labels: RequestFilterLabels;
  /** Periods newest first. */
  periods: readonly string[];
  docentes: readonly { id: number; name: string }[];
  causes: readonly Item[];
  selected: {
    /** `all` or a period code. */
    period: string;
    docenteId: number | null;
    causa: string | null;
    q: string;
  };
  clearHref: string;
}) {
  const codes =
    selected.period === ALL || periods.includes(selected.period)
      ? [...periods]
      : [...periods, selected.period].sort().reverse();
  const periodItems: Item[] = [
    { value: ALL, label: labels.allPeriods },
    ...codes.map((code) => ({ value: code, label: code })),
  ];

  const known =
    selected.docenteId === null ||
    docentes.some((docente) => docente.id === selected.docenteId);
  const teacherItems: Item[] = [
    { value: ALL, label: labels.allTeachers },
    ...docentes.map((docente) => ({
      value: String(docente.id),
      label: docente.name,
    })),
    ...(known
      ? []
      : [{ value: String(selected.docenteId), label: labels.teacherOutside }]),
  ];

  const causeItems: Item[] = [
    { value: ALL, label: labels.allCauses },
    ...causes,
  ];

  return (
    <form
      method="get"
      action="/reports/requests"
      aria-label={labels.region}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <FilterSelect
        id="period"
        label={labels.period}
        name="period"
        selected={selected.period}
        items={periodItems}
      />
      <FilterSelect
        id="docente"
        label={labels.teacher}
        name="docente"
        selected={
          selected.docenteId === null ? ALL : String(selected.docenteId)
        }
        items={teacherItems}
      />
      <FormField id="q" label={labels.student} hint={labels.studentHint}>
        {(control) => <Input {...control} name="q" defaultValue={selected.q} />}
      </FormField>
      <FilterSelect
        id="causa"
        label={labels.cause}
        name="causa"
        selected={selected.causa ?? ALL}
        items={causeItems}
      />
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row lg:col-span-4">
        <Button type="submit" size="lg">
          {labels.apply}
        </Button>
        <Link
          href={clearHref}
          prefetch={false}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          {labels.clear}
        </Link>
      </div>
    </form>
  );
}
