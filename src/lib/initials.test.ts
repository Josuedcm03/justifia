import { describe, expect, it } from "vitest";

import { initials } from "./initials";

describe("initials (BS-NAV-2 name edge cases)", () => {
  it.each([
    ["Ana Perez", "AP"],
    ["ana perez", "AP"],
    ["Ana María Pérez Gómez", "AM"],
  ])(
    "takes the first letters of the first two words of %j",
    (name, expected) => {
      expect(initials(name)).toBe(expected);
    },
  );

  it.each([
    ["Ana", "A"],
    ["ana", "A"],
    ["  Ana  ", "A"],
  ])("gives one character for the one-word name %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it.each([
    ["  Ana    Perez  ", "AP"],
    ["Ana\tPerez", "AP"],
    ["\n Ana \n Perez \n", "AP"],
  ])(
    "gives two characters for %j despite extra whitespace",
    (name, expected) => {
      expect(initials(name)).toBe(expected);
    },
  );

  it("is a string, never undefined, for a blank name (moved behaviour)", () => {
    expect(initials("")).toBe("");
    expect(initials("   ")).toBe("");
  });
});
