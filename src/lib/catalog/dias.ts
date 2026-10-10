/**
 * Meeting days of a `Grupo` (catalog-management amendment 2026-10-07, AC-DIAS).
 * The single place a day set is encoded and decoded. Pure: no imports, safe for
 * client and server.
 *
 * Storage is one `smallint` bitmask (`Grupo."Dias"`): bit `i` is the `i`-th
 * entry of `DIAS_SEMANA`, so Monday = bit 0 ... Sunday = bit 6, and the bit
 * index equals Postgres `isodow - 1`. `0` is the empty set ("days not
 * recorded"). Pages, forms and actions carry `DiaSemana[]` in week order; the
 * mask lives only in the database row, the import snapshot and the data layer.
 * The same bound backs `CK_Grupo_Dias` in `src/db/schema.ts`.
 */
export const DIAS_SEMANA = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

/** Largest valid mask: all seven bits set, `(1 << DIAS_SEMANA.length) - 1`. */
export const DIAS_MASK_MAX = 127;

export function isDiaSemana(value: unknown): value is DiaSemana {
  return (
    typeof value === "string" &&
    (DIAS_SEMANA as readonly string[]).includes(value)
  );
}

/** OR of `1 << index`; duplicates and order collapse by construction. */
export function encodeDias(dias: Iterable<DiaSemana>): number {
  let mask = 0;
  for (const dia of dias) {
    mask |= 1 << DIAS_SEMANA.indexOf(dia);
  }
  return mask;
}

/** Week order. Throws RangeError unless an integer in 0..DIAS_MASK_MAX. */
export function decodeDias(mask: number): DiaSemana[] {
  if (!Number.isInteger(mask) || mask < 0 || mask > DIAS_MASK_MAX) {
    throw new RangeError(
      `Day mask must be an integer between 0 and ${DIAS_MASK_MAX}`,
    );
  }
  return DIAS_SEMANA.filter((_, index) => (mask & (1 << index)) !== 0);
}
