import { describe, expect, it } from "vitest";

import {
  ASSIGN_BASE,
  assignHref,
  parseAssignParams,
} from "@/app/(dashboard)/catalog/inscripciones/assign/assign-params";

// The URL of the assign page (EA-CRE-1, EA-CHG-1): `q` is the student search,
// `estudiante` the chosen student, `asignatura` the chosen subject. Pure, so a
// hostile value is decided here and never reaches a read.

const id = (value: number) => ({ kind: "id", id: value });
const INVALID = { kind: "invalid" };

describe("parseAssignParams", () => {
  it("reads nothing from an empty query", () => {
    expect(parseAssignParams({})).toEqual({
      q: "",
      estudiante: { kind: "none" },
      asignatura: null,
    });
  });

  // Present but not a positive safe integer: the page answers not found, it
  // never falls back to the search (EA-SCOPE-1).
  it.each([
    ["5", "5", id(5)],
    ["12", "12", id(12)],
    ["the safe maximum", "9007199254740991", id(Number.MAX_SAFE_INTEGER)],
    ["zero", "0", INVALID],
    ["negative", "-3", INVALID],
    ["decimal", "1.5", INVALID],
    ["text", "abc", INVALID],
    ["empty", "", INVALID],
    ["padded", " 5", INVALID],
    ["leading zero", "05", INVALID],
    ["exponent", "1e3", INVALID],
    ["beyond the safe range", "9007199254740993", INVALID],
    ["repeated", ["1", "2"], INVALID],
  ])("reads an estudiante of %s as %j", (_name, raw, expected) => {
    expect(parseAssignParams({ estudiante: raw }).estudiante).toEqual(expected);
  });

  // The subject only narrows the groups shown: a bad value is no selection,
  // as on the student's own picker (SE-6).
  it.each([
    ["9", "9", 9],
    ["31", "31", 31],
    ["zero", "0", null],
    ["negative", "-1", null],
    ["text", "x", null],
    ["empty", "", null],
    ["beyond the safe range", "9007199254740993", null],
    ["repeated", ["1", "2"], null],
  ])("reads an asignatura of %s as %j", (_name, raw, expected) => {
    expect(
      parseAssignParams({ estudiante: "5", asignatura: raw }).asignatura,
    ).toBe(expected);
  });

  it("trims, collapses and caps the search text and ignores a repeated one", () => {
    expect(parseAssignParams({ q: "  Ana   Pérez " }).q).toBe("Ana Pérez");
    expect(parseAssignParams({ q: "x".repeat(300) }).q).toHaveLength(100);
    expect(parseAssignParams({ q: ["a", "b"] }).q).toBe("");
  });

  it("keeps the three values apart", () => {
    expect(
      parseAssignParams({ q: "ana", estudiante: "5", asignatura: "9" }),
    ).toEqual({ q: "ana", estudiante: id(5), asignatura: 9 });
  });
});

describe("assignHref", () => {
  it("pins the base path", () => {
    expect(ASSIGN_BASE).toBe("/catalog/inscripciones/assign");
  });

  it.each([
    ["a student", { estudianteId: 5 }, "?estudiante=5"],
    [
      "a student and a subject",
      { estudianteId: 5, asignaturaId: 9 },
      "?estudiante=5&asignatura=9",
    ],
    ["a new search", {}, ""],
  ])("builds the link of %s", (_name, ids, query) => {
    expect(assignHref(ids)).toBe(`/catalog/inscripciones/assign${query}`);
  });

  it("round-trips through the parser", () => {
    const href = assignHref({ estudianteId: 31, asignaturaId: 4 });
    const query = Object.fromEntries(new URL(href, "http://x").searchParams);

    expect(parseAssignParams(query)).toMatchObject({
      estudiante: id(31),
      asignatura: 4,
    });
  });
});
