// Subject and group eligibility rules (RF-04, RN-21). Pure: the data layer
// supplies the groups the student may use (active groups of active subjects in
// their enrollment, already filtered through the GroupScheduleProvider port).

export interface EligibleGroup {
  grupoId: number;
  asignaturaId: number;
}

export interface SubjectGroupOptions {
  asignaturaId: number;
  grupoIds: number[];
  /** More than one eligible group: the student must choose (RF-04 c). */
  ambiguous: boolean;
}

/** A subject the student picked, with the chosen group when there is one. */
export interface SubjectSelection {
  asignaturaId: number;
  grupoId: number | null;
}

export type SubjectErrorCode =
  | "subject_not_eligible"
  | "subject_duplicate"
  | "group_required"
  | "group_not_in_subject";

export interface SubjectError {
  code: SubjectErrorCode;
  asignaturaId: number;
}

export function groupOptionsBySubject(
  eligible: readonly EligibleGroup[],
): SubjectGroupOptions[] {
  const bySubject = new Map<number, number[]>();
  for (const { asignaturaId, grupoId } of eligible) {
    const ids = bySubject.get(asignaturaId) ?? [];
    ids.push(grupoId);
    bySubject.set(asignaturaId, ids);
  }
  return [...bySubject].map(([asignaturaId, grupoIds]) => ({
    asignaturaId,
    grupoIds,
    ambiguous: grupoIds.length > 1,
  }));
}

/**
 * Fill the group of a subject whose enrollment determines exactly one (RF-04
 * b), so a draft can store it. An ambiguous or unknown subject keeps its null
 * and is reported by `validateSubjectSelections`.
 */
export function resolveGroupChoices(
  selections: readonly SubjectSelection[],
  eligible: readonly EligibleGroup[],
): SubjectSelection[] {
  const options = new Map(
    groupOptionsBySubject(eligible).map((o) => [o.asignaturaId, o]),
  );
  return selections.map(({ asignaturaId, grupoId }) => {
    const option = options.get(asignaturaId);
    const only = option && !option.ambiguous ? option.grupoIds[0] : null;
    return { asignaturaId, grupoId: grupoId ?? only ?? null };
  });
}

/** Every problem with the picked subjects, in selection order. */
export function validateSubjectSelections(
  selections: readonly SubjectSelection[],
  eligible: readonly EligibleGroup[],
): SubjectError[] {
  const options = new Map(
    groupOptionsBySubject(eligible).map((o) => [o.asignaturaId, o]),
  );
  const seen = new Set<number>();
  const errors: SubjectError[] = [];

  for (const { asignaturaId, grupoId } of selections) {
    const option = options.get(asignaturaId);
    if (!option) {
      errors.push({ code: "subject_not_eligible", asignaturaId });
    } else if (seen.has(asignaturaId)) {
      errors.push({ code: "subject_duplicate", asignaturaId });
    } else if (grupoId === null) {
      if (option.ambiguous) {
        errors.push({ code: "group_required", asignaturaId });
      }
    } else if (!option.grupoIds.includes(grupoId)) {
      errors.push({ code: "group_not_in_subject", asignaturaId });
    }
    seen.add(asignaturaId);
  }
  return errors;
}
