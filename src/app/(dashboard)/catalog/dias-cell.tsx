import type { DiaSemana } from "@/lib/catalog/dias";

/**
 * The days of a group in the cell: short names for sighted users, long names
 * for assistive technology, never both. An empty set (a legacy group) is a
 * plain muted note, not an alert and not an error (amendment 2026-10-07).
 */
export function DiasCell({
  dias,
  short,
  long,
  notSet,
}: {
  dias: readonly DiaSemana[];
  short: (dia: DiaSemana) => string;
  long: (dia: DiaSemana) => string;
  notSet: string;
}) {
  if (dias.length === 0) {
    return <span className="text-muted-foreground">{notSet}</span>;
  }
  return (
    <>
      <span aria-hidden="true">{dias.map(short).join(", ")}</span>
      <span className="sr-only">{dias.map(long).join(", ")}</span>
    </>
  );
}
