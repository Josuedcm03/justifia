import { describe, expect, it } from "vitest";

import { diffRevision, type RevisionSide } from "./revision-diff";

// SR-17: what the student changed since the return, computed on read from the
// snapshot the return froze and the request as it stands. Pure.

const BASE: RevisionSide = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  clases: [
    { asignaturaId: 10, numeroGrupo: "1" },
    { asignaturaId: 11, numeroGrupo: "A" },
  ],
  documentoIds: [1, 2],
};

const side = (overrides: Partial<RevisionSide> = {}): RevisionSide => ({
  ...BASE,
  ...overrides,
});

describe("diffRevision: cause and dates", () => {
  it("marks everything unchanged and lists nothing when both sides are equal", () => {
    expect(diffRevision(side(), side())).toEqual({
      causeDates: "unchanged",
      subjects: "unchanged",
      documents: "unchanged",
      retiredDocumentIds: [],
      addedDocumentIds: [],
    });
  });

  it.each([
    ["cause", { causa: "familiar" }],
    ["start", { fechaInicio: "2026-10-02" }],
    ["end", { fechaFin: "2026-10-04" }],
  ] as const)("a changed %s marks only cause and dates", (_name, change) => {
    expect(diffRevision(side(), side(change))).toEqual({
      causeDates: "changed",
      subjects: "unchanged",
      documents: "unchanged",
      retiredDocumentIds: [],
      addedDocumentIds: [],
    });
  });

  it("a cleared field counts as a change", () => {
    expect(diffRevision(side(), side({ causa: null })).causeDates).toBe(
      "changed",
    );
  });
});

describe("diffRevision: subjects", () => {
  it("a swapped subject group marks only subjects", () => {
    const current = side({
      clases: [
        { asignaturaId: 10, numeroGrupo: "2" },
        { asignaturaId: 11, numeroGrupo: "A" },
      ],
    });

    expect(diffRevision(side(), current)).toMatchObject({
      causeDates: "unchanged",
      subjects: "changed",
      documents: "unchanged",
    });
  });

  it("a subject added or dropped is a change", () => {
    const dropped = side({ clases: [{ asignaturaId: 10, numeroGrupo: "1" }] });
    const added = side({
      clases: [...BASE.clases, { asignaturaId: 12, numeroGrupo: "1" }],
    });

    expect(diffRevision(side(), dropped).subjects).toBe("changed");
    expect(diffRevision(side(), added).subjects).toBe("changed");
  });

  it("reordered or duplicated classes are unchanged", () => {
    const current = side({
      clases: [
        { asignaturaId: 11, numeroGrupo: "A" },
        { asignaturaId: 10, numeroGrupo: "1" },
        { asignaturaId: 11, numeroGrupo: "A" },
      ],
    });

    expect(diffRevision(side(), current).subjects).toBe("unchanged");
  });

  it("the same group number in another subject is a different class", () => {
    const current = side({
      clases: [
        { asignaturaId: 10, numeroGrupo: "A" },
        { asignaturaId: 11, numeroGrupo: "1" },
      ],
    });

    expect(diffRevision(side(), current).subjects).toBe("changed");
  });
});

describe("diffRevision: documents", () => {
  it("D1 retired and D3 added: changed, listed, and the kept D2 in neither list", () => {
    const current = side({ documentoIds: [2, 3] });

    expect(diffRevision(side(), current)).toEqual({
      causeDates: "unchanged",
      subjects: "unchanged",
      documents: "changed",
      retiredDocumentIds: [1],
      addedDocumentIds: [3],
    });
  });

  it("lists retired and added ids ascending whatever the input order", () => {
    const snapshot = side({ documentoIds: [9, 4, 7, 1] });
    const current = side({ documentoIds: [12, 1, 10] });

    const diff = diffRevision(snapshot, current);

    expect(diff.retiredDocumentIds).toEqual([4, 7, 9]);
    expect(diff.addedDocumentIds).toEqual([10, 12]);
  });

  it("the same ids in another order or repeated are unchanged", () => {
    const current = side({ documentoIds: [2, 1, 2] });

    expect(diffRevision(side(), current)).toMatchObject({
      documents: "unchanged",
      retiredDocumentIds: [],
      addedDocumentIds: [],
    });
  });

  it("only retiring a document, or only adding one, is changed", () => {
    expect(diffRevision(side(), side({ documentoIds: [1] }))).toMatchObject({
      documents: "changed",
      retiredDocumentIds: [2],
      addedDocumentIds: [],
    });
    expect(
      diffRevision(side(), side({ documentoIds: [1, 2, 5] })),
    ).toMatchObject({
      documents: "changed",
      retiredDocumentIds: [],
      addedDocumentIds: [5],
    });
  });
});
