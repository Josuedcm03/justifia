import { describe, expect, it } from "vitest";

import { classifyIdentifier, normalizeCif } from "@/lib/auth/login-identity";

// FE-21, FE-22: the single sign-in field is classified by its content only. An
// "@" means an email; anything else is a CIF. No digit count or format is
// assumed, because the staff CIF format is unknown and is not stored.
describe("classifyIdentifier (FE-21, FE-22)", () => {
  it.each([
    ["ana.perez@uni.edu", "ana.perez@uni.edu"],
    ["Ana.Perez@UNI.edu", "ana.perez@uni.edu"],
    ["  ana.perez@uni.edu  ", "ana.perez@uni.edu"],
    ["  Ana.Perez@UNI.edu\t", "ana.perez@uni.edu"],
    ["ana@", "ana@"],
    ["@", "@"],
  ])("takes %j as an email, trimmed and lower-case", (raw, value) => {
    expect(classifyIdentifier(raw)).toEqual({ kind: "email", value });
  });

  it("takes an email that has a CIF-looking part as an email", () => {
    expect(classifyIdentifier("26001234@uni.edu")).toEqual({
      kind: "email",
      value: "26001234@uni.edu",
    });
  });

  it.each([
    ["26001234", "26001234"],
    ["  26001234  ", "26001234"],
    ["  26-00 1234 ", "26001234"],
    ["26 00 12 34", "26001234"],
    ["2600-1234", "26001234"],
  ])("takes %j as a CIF with spaces and hyphens removed", (raw, value) => {
    expect(classifyIdentifier(raw)).toEqual({ kind: "cif", value });
  });

  // No hard-coded 8 digits: the student CIF has the last two digits of the
  // enrollment year followed by digits, and the owner's has 8.
  it.each([
    ["8 digits", "26001234"],
    ["10 digits", "2600123456"],
    ["5 digits", "26012"],
    ["letters", "ab-cd"],
  ])("applies no format check to a CIF of %s", (_label, raw) => {
    expect(classifyIdentifier(raw)).toEqual({
      kind: "cif",
      value: raw.replace(/-/g, ""),
    });
  });

  it("keeps the case of a CIF: it is compared exactly", () => {
    expect(classifyIdentifier(" Ab-12 ")).toEqual({
      kind: "cif",
      value: "Ab12",
    });
  });

  it("gives null for a value that is only spaces", () => {
    expect(classifyIdentifier("    ")).toBeNull();
    expect(classifyIdentifier("")).toBeNull();
    expect(classifyIdentifier("\t \n")).toBeNull();
  });

  it("gives an empty CIF for hyphens only, so the CIF lookup is skipped", () => {
    expect(classifyIdentifier(" --- ")).toEqual({ kind: "cif", value: "" });
    expect(classifyIdentifier("- -")).toEqual({ kind: "cif", value: "" });
  });

  // The stored Login is never an identifier (owner decision 2026-11-20): a
  // value that is neither an email nor a CIF still comes out as a CIF, and the
  // data layer finds no student with it.
  it("offers no third kind: a former username is just a CIF candidate", () => {
    expect(classifyIdentifier("maria.perez")).toEqual({
      kind: "cif",
      value: "maria.perez",
    });
  });
});

// FE-21, FE-26: the one cleaning rule of a CIF, shared by the sign-in lookup
// and by the value self-registration stores.
describe("normalizeCif (FE-21, FE-26)", () => {
  it.each([
    ["26001234", "26001234"],
    ["  2201-0116 ", "22010116"],
    ["22 01\t-\n01 16", "22010116"],
    [" Ab-12 ", "Ab12"],
    [" --- ", ""],
    ["", ""],
  ])("cleans %j to %j", (raw, cleaned) => {
    expect(normalizeCif(raw)).toBe(cleaned);
  });

  it("is what a CIF identifier carries, so both paths share one rule", () => {
    for (const raw of ["2201-0116", " Ab-12 ", "- -", "1 2 3"]) {
      expect(classifyIdentifier(raw)).toEqual({
        kind: "cif",
        value: normalizeCif(raw),
      });
    }
  });
});
