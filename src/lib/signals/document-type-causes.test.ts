import { describe, expect, it } from "vitest";

import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/document-data/types";
import { CAUSAS, type Causa } from "@/lib/intake/causes";

import { DOCUMENT_TYPE_CAUSES } from "./document-type-causes";

// manual-document-data: "Type to cause map" (MD-15, MD-14), RN-13 and RF-05
// (e). The map is a code constant until roadmap row 8 replaces its source
// (RNF-14 stays "not met").

type TypeCauseMap = Readonly<Record<TipoDocumento, readonly Causa[]>>;

/** Types the map does not list and causes no type corresponds to. */
function gaps(map: Partial<Record<TipoDocumento, readonly Causa[]>>) {
  const missingTypes = TIPOS_DOCUMENTO.filter((type) => !(type in map));
  const corresponding = new Set(Object.values(map).flat());
  const uncoveredCauses = CAUSAS.filter((causa) => !corresponding.has(causa));
  return { missingTypes, uncoveredCauses };
}

function corresponds(map: TypeCauseMap, type: TipoDocumento, causa: Causa) {
  return map[type].includes(causa);
}

// The 3 x 5 truth table, written out so a change of the map is a visible edit
// of this table and never a silent recomputation.
const TRUTH_TABLE: readonly [TipoDocumento, Causa, boolean][] = [
  ["constancia_medica", "medica", true],
  ["constancia_medica", "maternidad_paternidad", true],
  ["constancia_medica", "actividad_representativa", false],
  ["constancia_medica", "intercambio_academico", false],
  ["constancia_medica", "fuerza_mayor", false],
  ["constancia_institucional", "medica", false],
  ["constancia_institucional", "maternidad_paternidad", false],
  ["constancia_institucional", "actividad_representativa", true],
  ["constancia_institucional", "intercambio_academico", true],
  ["constancia_institucional", "fuerza_mayor", true],
  ["otro", "medica", false],
  ["otro", "maternidad_paternidad", false],
  ["otro", "actividad_representativa", false],
  ["otro", "intercambio_academico", false],
  ["otro", "fuerza_mayor", false],
];

describe("DOCUMENT_TYPE_CAUSES truth table (MD-14, MD-15)", () => {
  it("covers every pair of the three types and the five causes", () => {
    expect(TRUTH_TABLE).toHaveLength(15);
    expect(TIPOS_DOCUMENTO).toHaveLength(3);
    expect(CAUSAS).toHaveLength(5);
    for (const type of TIPOS_DOCUMENTO) {
      for (const causa of CAUSAS) {
        expect(
          TRUTH_TABLE.filter(([t, c]) => t === type && c === causa),
          `${type} x ${causa}`,
        ).toHaveLength(1);
      }
    }
  });

  it.each(TRUTH_TABLE)(
    "%s and %s: corresponds is %s",
    (type, causa, expected) => {
      expect(corresponds(DOCUMENT_TYPE_CAUSES, type, causa)).toBe(expected);
    },
  );

  it("holds the maternity pairing as an assumption of the design (no thesis scenario)", () => {
    // D4: a medical certificate is taken as the document of a maternity or
    // paternity absence. A change of this cell must be a decision, not a drift.
    expect(DOCUMENT_TYPE_CAUSES.constancia_medica).toEqual([
      "medica",
      "maternidad_paternidad",
    ]);
  });
});

describe("DOCUMENT_TYPE_CAUSES shape (MD-15)", () => {
  it("has exactly one entry for every document type", () => {
    expect(Object.keys(DOCUMENT_TYPE_CAUSES).sort()).toEqual(
      [...TIPOS_DOCUMENTO].sort(),
    );
  });

  it('maps "otro" to no cause, so it always raises the RN-13 signal', () => {
    expect(DOCUMENT_TYPE_CAUSES.otro).toEqual([]);
  });

  it("lists only valid causes, each at most once per type", () => {
    for (const type of TIPOS_DOCUMENTO) {
      const list = DOCUMENT_TYPE_CAUSES[type];
      expect(new Set(list).size).toBe(list.length);
      for (const causa of list) expect(CAUSAS).toContain(causa);
    }
  });

  it("leaves no cause without a document type", () => {
    expect(gaps(DOCUMENT_TYPE_CAUSES)).toEqual({
      missingTypes: [],
      uncoveredCauses: [],
    });
  });
});

describe("the completeness check itself", () => {
  it("fails when a type is missing from the table", () => {
    const partial = Object.fromEntries(
      Object.entries(DOCUMENT_TYPE_CAUSES).filter(
        ([type]) => type !== "constancia_institucional",
      ),
    );

    expect(gaps(partial).missingTypes).toEqual(["constancia_institucional"]);
  });

  it("fails when a cause is missing from every type", () => {
    const withoutFuerzaMayor = {
      ...DOCUMENT_TYPE_CAUSES,
      constancia_institucional:
        DOCUMENT_TYPE_CAUSES.constancia_institucional.filter(
          (causa) => causa !== "fuerza_mayor",
        ),
    };

    expect(gaps(withoutFuerzaMayor).uncoveredCauses).toEqual(["fuerza_mayor"]);
  });
});
