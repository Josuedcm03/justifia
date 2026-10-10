import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DIAS_SEMANA, encodeDias } from "@/lib/catalog/dias";

import { parseDiasCell } from "./dias";

// CEI-DIAS-2: the day-token table is a data contract. The parser is pure and
// is the only place a spreadsheet day token is recognised.

describe("parseDiasCell: accepted cells (CEI-DIAS-2 table)", () => {
  it.each([
    ["Lunes, Miércoles", ["lunes", "miercoles"]],
    ["lun,MIE", ["lunes", "miercoles"]],
    ["miercoles ,  SABADO", ["miercoles", "sabado"]],
    ["Vie,Lunes,vie", ["lunes", "viernes"]],
    ["Lunes,,Martes,", ["lunes", "martes"]],
  ] as const)("%j parses to the matching mask", (cell, dias) => {
    expect(parseDiasCell(cell)).toEqual({
      ok: true,
      mask: encodeDias(dias),
    });
  });

  it.each([
    ["Lunes", "lunes"],
    ["Martes", "martes"],
    ["Miércoles", "miercoles"],
    ["Jueves", "jueves"],
    ["Viernes", "viernes"],
    ["Sábado", "sabado"],
    ["Domingo", "domingo"],
    ["Lun", "lunes"],
    ["Mar", "martes"],
    ["Mié", "miercoles"],
    ["Jue", "jueves"],
    ["Vie", "viernes"],
    ["Sáb", "sabado"],
    ["Dom", "domingo"],
    ["lun", "lunes"],
    ["mar", "martes"],
    ["mie", "miercoles"],
    ["jue", "jueves"],
    ["vie", "viernes"],
    ["sab", "sabado"],
    ["dom", "domingo"],
    ["MIERCOLES", "miercoles"],
    ["  sabado  ", "sabado"],
  ] as const)("the token %j is the single day %s", (cell, dia) => {
    expect(parseDiasCell(cell)).toEqual({ ok: true, mask: encodeDias([dia]) });
  });

  it("accepts decomposed accents (NFD) like the composed ones", () => {
    expect(parseDiasCell("Miércoles")).toEqual({
      ok: true,
      mask: encodeDias(["miercoles"]),
    });
    expect(parseDiasCell("Sábado")).toEqual({
      ok: true,
      mask: encodeDias(["sabado"]),
    });
  });

  it("recognises every day of the week exactly once, in bit order", () => {
    const all = parseDiasCell("Dom, Sáb, Vie, Jue, Miércoles, Martes, Lunes");
    expect(all).toEqual({ ok: true, mask: encodeDias(DIAS_SEMANA) });
  });

  it.each(["", "   ", " , ,", ",", ", ,  ,"])(
    "%j has no day and is the empty mask",
    (cell) => {
      expect(parseDiasCell(cell)).toEqual({ ok: true, mask: 0 });
    },
  );
});

describe("parseDiasCell: first unrecognised token (CEI-DIAS-2 invalid table)", () => {
  it.each([
    ["Monday", "Monday"],
    ["Lunes;Martes", "Lunes;Martes"],
    ["Lun-Vie", "Lun-Vie"],
    ["Lunes y Martes", "Lunes y Martes"],
    ["Luness", "Luness"],
    ["1", "1"],
    ["Lunes, Funday", "Funday"],
    ["  Funday  , Lunes", "Funday"],
    ["Lunes, Foo, Bar", "Foo"],
  ])("%j is refused naming %j", (cell, token) => {
    expect(parseDiasCell(cell)).toEqual({ ok: false, token });
  });
});

describe("dias.ts module boundary", () => {
  it("takes its day codes from the catalog module and imports no locale catalog", () => {
    const source = readFileSync(resolve(__dirname, "dias.ts"), "utf8");

    expect(source).toContain("@/lib/catalog/dias");
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(specifiers).toEqual(["@/lib/catalog/dias", "./normalize"]);
  });
});
