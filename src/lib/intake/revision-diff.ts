// What changed on a resubmitted request since the return that froze its latest
// revision (SR-17). Pure and computed on read: nothing is stored and nothing is
// audited. The two sides are plain values the caller builds from the snapshot
// and from the request as it stands.

export type RevisionSide = {
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  clases: readonly { asignaturaId: number; numeroGrupo: string }[];
  /** Snapshot `DocumentoIds`, or the current non-retired document ids. */
  documentoIds: readonly number[];
};

export type SectionMark = "changed" | "unchanged";

export type RevisionDiff = {
  causeDates: SectionMark;
  subjects: SectionMark;
  documents: SectionMark;
  /** In the snapshot and not current, ascending. */
  retiredDocumentIds: number[];
  /** Current and not in the snapshot, ascending. */
  addedDocumentIds: number[];
};

const mark = (changed: boolean): SectionMark =>
  changed ? "changed" : "unchanged";

const ascending = (a: number, b: number) => a - b;

/** Members of `from` that `other` lacks, as a sorted list of distinct ids. */
function missingFrom(from: readonly number[], other: ReadonlySet<number>) {
  return [...new Set(from)].filter((id) => !other.has(id)).sort(ascending);
}

/**
 * Subjects are compared as a set of (subject, group number), so order and
 * duplicates do not count. `RevisionClase` carries no group id, which means a
 * catalog renumbering of a group reads as a change: the snapshot is the frozen
 * truth.
 */
function classKeys(clases: RevisionSide["clases"]): Set<string> {
  return new Set(clases.map((c) => `${c.asignaturaId}:${c.numeroGrupo}`));
}

export function diffRevision(
  snapshot: RevisionSide,
  current: RevisionSide,
): RevisionDiff {
  const before = classKeys(snapshot.clases);
  const after = classKeys(current.clases);
  const subjectsChanged =
    before.size !== after.size || [...before].some((key) => !after.has(key));

  const retiredDocumentIds = missingFrom(
    snapshot.documentoIds,
    new Set(current.documentoIds),
  );
  const addedDocumentIds = missingFrom(
    current.documentoIds,
    new Set(snapshot.documentoIds),
  );

  return {
    causeDates: mark(
      snapshot.causa !== current.causa ||
        snapshot.fechaInicio !== current.fechaInicio ||
        snapshot.fechaFin !== current.fechaFin,
    ),
    subjects: mark(subjectsChanged),
    documents: mark(retiredDocumentIds.length + addedDocumentIds.length > 0),
    retiredDocumentIds,
    addedDocumentIds,
  };
}
