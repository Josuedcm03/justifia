/** The fields of a queue row the search looks at. */
type SearchableRow = {
  estudianteNombre: string | null;
  estudianteCif: string | null;
  estudianteCarrera: string | null;
};

/** Lowercase and without diacritics, so "maria" finds "María". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * The queue is bounded (every pending request of the facultad is loaded), so
 * the search filters the loaded rows instead of querying again. Every word of
 * the term must appear in the name, the CIF or the career; the order is kept.
 */
export function filterQueueRows<T extends SearchableRow>(
  rows: readonly T[],
  q: string,
): T[] {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((row) => {
    const haystack = normalize(
      [row.estudianteNombre, row.estudianteCif, row.estudianteCarrera]
        .filter(Boolean)
        .join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
}
