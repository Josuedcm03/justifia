import { describe, expect, it } from "vitest";

import {
  ASSIGN_BASE,
  assignHref,
  parseAssignParams,
} from "@/app/(dashboard)/catalog/inscripciones/assign/assign-params";

// The URL of the assign page (EA-CRE-1, EA-CHG-1): `q` is the student search,
// `estudiante` the chosen student, `asignatura` the chosen subject. Pure, so a
// hostile value is decided here and never reaches a read.

describe("parseAssignParams", () => {
  it("reads nothing from an empty query", () => {
    expect(parseAssignParams({})).toEqual({
      q: "",
      estudiante: { kind: "none" },
      asignatura: null,
    });
  });

  it.each([
    ["5", 5],
    ["12", 12],
    ["9007199254740991", Number.MAX_SAFE_INTEGER],
  ])("reads estudiante=%s as the id %d", (raw, id) => {
    expect(parseAssignParams({ estudiante: raw }).estudiante).toEqual({
      kind: "id",
      id,
    });
  });

  // Present but not a positive safe integer: the page answers not found, it
  // never falls back to the search (EA-SCOPE-1).
  it.each([
    ["zero", "0"],
    ["negative", "-3"],
    ["decimal", "1.5"],
    ["text", "abc"],
    ["empty", ""],
    ["padded", " 5"],
    ["leading zero", "05"],
    ["exponent", "1e3"],
    ["beyond the safe range", "9007199254740993"],
    ["repeated", ["1", "2"]],
  ])("reads an estudiante that is %s as invalid", (_name, raw) => {
    expect(parseAssignParams({ estudiante: raw }).estudiante).toEqual({
      kind: "invalid",
    });
  });

  it.each([
    ["9", 9],
    ["31", 31],
  ])("reads asignatura=%s as the id %d", (raw, id) => {
    expect(parseAssignParams({ asignatura: raw }).asignatura).toBe(id);
  });

  // The subject only narrows the groups shown: a bad value is no selection,
  // as on the student's own picker (SE-6).
  it.each([
    ["0"],
    ["-1"],
    ["x"],
    [""],
    ["9007199254740993"],
    [["1", "2"]],
  ] as const)("reads the bad asignatura %j as no selection", (raw) => {
    expect(
      parseAssignParams({ estudiante: "5", asignatura: raw as string })
        .asignatura,
    ).toBeNull();
  });

  it("trims, collapses and caps the search text and ignores a repeated one", () => {
    expect(parseAssignParams({ q: "  Ana   Pérez " }).q).toBe("Ana Pérez");
    expect(parseAssignParams({ q: "x".repeat(300) }).q).toHaveLength(100);
    expect(parseAssignParams({ q: ["a", "b"] }).q).toBe("");
  });

  it("keeps the three values apart", () => {
    expect(
      parseAssignParams({ q: "ana", estudiante: "5", asignatura: "9" }),
    ).toEqual({
      q: "ana",
      estudiante: { kind: "id", id: 5 },
      asignatura: 9,
    });
  });
});

describe("assignHref", () => {
  it("builds the link of a student with and without a subject", () => {
    expect(ASSIGN_BASE).toBe("/catalog/inscripciones/assign");
    expect(assignHref({ estudianteId: 5 })).toBe(
      "/catalog/inscripciones/assign?estudiante=5",
    );
    expect(assignHref({ estudianteId: 5, asignaturaId: 9 })).toBe(
      "/catalog/inscripciones/assign?estudiante=5&asignatura=9",
    );
  });

  it("builds the bare page for a new search", () => {
    expect(assignHref({})).toBe("/catalog/inscripciones/assign");
  });

  it("round-trips through the parser", () => {
    const href = assignHref({ estudianteId: 31, asignaturaId: 4 });
    const query = Object.fromEntries(new URL(href, "http://x").searchParams);

    expect(parseAssignParams(query)).toMatchObject({
      estudiante: { kind: "id", id: 31 },
      asignatura: 4,
    });
  });
});
