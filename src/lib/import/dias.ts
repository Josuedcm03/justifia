import { DIAS_SEMANA, encodeDias, type DiaSemana } from "@/lib/catalog/dias";

import { normalizeKey } from "./normalize";

// Day tokens of the `Grupos.Dias` cell (CEI-DIAS-2). Pure: the single place a
// spreadsheet day token is recognised. The tokens are a data contract in
// Spanish and are never read from the i18n catalogs. The day codes and the bit
// order come from `src/lib/catalog/dias.ts`, never restated here.

// Three-letter abbreviation per day, in `DIAS_SEMANA` order (the full name is
// the day code itself). Keys are compared through `normalizeKey`, so case and
// accents (Mié, Sáb) never matter.
const ABBREVIATIONS: Record<DiaSemana, string> = {
  lunes: "lun",
  martes: "mar",
  miercoles: "mie",
  jueves: "jue",
  viernes: "vie",
  sabado: "sab",
  domingo: "dom",
};

const TOKENS = new Map<string, DiaSemana>(
  DIAS_SEMANA.flatMap((dia) => [
    [dia, dia] as const,
    [ABBREVIATIONS[dia], dia] as const,
  ]),
);

export type ParseDiasResult =
  { ok: true; mask: number } | { ok: false; token: string };

/** Parses one `Dias` cell: comma-separated day names or abbreviations, case-
 *  and accent-insensitive, whitespace trimmed, empty segments ignored, a day
 *  named twice counted once. Returns the encoded mask (`0` for an empty cell)
 *  or the FIRST unrecognised token, trimmed and as written. */
export function parseDiasCell(cell: string): ParseDiasResult {
  const found: DiaSemana[] = [];
  for (const segment of cell.split(",")) {
    const token = segment.trim();
    if (token === "") continue;
    const dia = TOKENS.get(normalizeKey(token));
    if (dia === undefined) return { ok: false, token };
    found.push(dia);
  }
  return { ok: true, mask: encodeDias(found) };
}
