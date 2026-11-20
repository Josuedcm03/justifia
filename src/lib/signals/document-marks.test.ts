import { describe, expect, it } from "vitest";

import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/document-data/types";
import { CAUSAS, type Causa } from "@/lib/intake/causes";

import { DOCUMENT_TYPE_CAUSES } from "./document-type-causes";
import {
  evaluateMissingSeal,
  evaluateMissingSignature,
  evaluateTypeMismatch,
  type MarkedDocument,
} from "./document-marks";

// manual-document-data: "Firma ausente, RN-11" (MD-12), "Sello ausente, RN-12"
// (MD-13), "Formato no corresponde a la causa, RN-13" (MD-14, MD-15) and the
// strict aggregation of all three (MD-16, D1). The evaluators are pure and
// unwired: the input is the document ids and their marks, nothing else.

type Mark = boolean | null;

function marked(
  documentId: number,
  marks: {
    type?: TipoDocumento | null;
    hasSignature?: Mark;
    hasSeal?: Mark;
  } = {},
): MarkedDocument {
  return {
    documentId,
    marks: {
      type: marks.type ?? null,
      hasSignature: marks.hasSignature ?? null,
      hasSeal: marks.hasSeal ?? null,
    },
  };
}

const withSignature = (id: number, hasSignature: Mark) =>
  marked(id, { hasSignature });
const withSeal = (id: number, hasSeal: Mark) => marked(id, { hasSeal });
const withType = (id: number, type: TipoDocumento | null) =>
  marked(id, { type });

// "Sí" is true, "No" is false and "Sin registrar" is null (MD-5).
const YES = true;
const NO = false;
const UNREGISTERED = null;

const MARK_SIGNALS = [
  {
    name: "rn11",
    label: "firma",
    evaluate: evaluateMissingSignature,
    build: withSignature,
  },
  {
    name: "rn12",
    label: "sello",
    evaluate: evaluateMissingSeal,
    build: withSeal,
  },
] as const;

describe.each(MARK_SIGNALS)(
  "$name: the $label of one document",
  ({ name, evaluate, build }) => {
    it.each([
      ["Sí", YES, "absent"],
      ["No", NO, "present"],
    ] as const)("%s is %s", (_label, mark, outcome) => {
      const result = evaluate([build(1, mark)]);

      expect(result.signal).toBe(name);
      expect(result.outcome).toBe(outcome);
    });

    it("Sin registrar is not evaluable, with not_registered", () => {
      expect(evaluate([build(1, UNREGISTERED)])).toEqual({
        signal: name,
        outcome: "not_evaluable",
        reason: "not_registered",
      });
    });

    it("a present outcome carries no reason and an absent one carries none", () => {
      expect(evaluate([build(1, NO)])).not.toHaveProperty("reason");
      expect(evaluate([build(1, YES)])).not.toHaveProperty("reason");
    });
  },
);

describe.each(MARK_SIGNALS)(
  "$name: strict aggregation over two documents (MD-16)",
  ({ name, evaluate, build }) => {
    // The table of MD-16, once per mark.
    it.each([
      ["No", "Sí", "present", NO, YES],
      ["Sí", "No", "present", YES, NO],
      ["Sí", "Sí", "absent", YES, YES],
      ["Sí", "Sin registrar", "not_registered", YES, UNREGISTERED],
      ["No", "Sin registrar", "present", NO, UNREGISTERED],
      [
        "Sin registrar",
        "Sin registrar",
        "not_registered",
        UNREGISTERED,
        UNREGISTERED,
      ],
    ] as const)("%s and %s give %s", (_a, _b, expected, markA, markB) => {
      const result = evaluate([build(1, markA), build(2, markB)]);

      expect(result.signal).toBe(name);
      if (expected === "not_registered") {
        expect(result).toEqual({
          signal: name,
          outcome: "not_evaluable",
          reason: "not_registered",
        });
      } else {
        expect(result.outcome).toBe(expected);
      }
    });

    it("one unregistered document keeps the signal open until it is registered", () => {
      const open = evaluate([build(1, YES), build(2, UNREGISTERED)]);
      const closed = evaluate([build(1, YES), build(2, YES)]);

      expect(open.outcome).toBe("not_evaluable");
      expect(closed.outcome).toBe("absent");
    });
  },
);

describe.each(MARK_SIGNALS)(
  "$name: no documents and evidence",
  ({ name, evaluate, build }) => {
    it("no documents is not evaluable, with no_eligible_documents", () => {
      expect(evaluate([])).toEqual({
        signal: name,
        outcome: "not_evaluable",
        reason: "no_eligible_documents",
      });
    });

    it("is never not_applicable, whatever the documents", () => {
      const inputs = [
        [],
        [build(1, YES)],
        [build(1, NO)],
        [build(1, UNREGISTERED)],
        [build(1, YES), build(2, UNREGISTERED)],
      ];

      for (const documents of inputs) {
        expect(evaluate(documents).outcome).not.toBe("not_applicable");
      }
    });

    it("a present outcome names only the documents that raise it", () => {
      const result = evaluate([build(7, NO), build(8, YES), build(9, NO)]);

      expect(result).toEqual({
        signal: name,
        outcome: "present",
        evidence: { kind: "documents", documentIds: [7, 9] },
      });
    });

    it("an absent outcome names no document", () => {
      expect(evaluate([build(7, YES)])).toEqual({
        signal: name,
        outcome: "absent",
        evidence: { kind: "documents", documentIds: [] },
      });
    });

    it("serializes with the ids and no name, issuer, date, type or fingerprint", () => {
      const documents: MarkedDocument[] = [
        {
          documentId: 41,
          marks: {
            type: "constancia_medica",
            hasSignature: false,
            hasSeal: false,
          },
          // Anything else a caller smuggles in must not reach the outcome.
          ...({
            studentName: "Ana Lopez",
            issuer: "Clinica Central",
            issueDate: "2026-07-12",
            huellaSha256: "ab".repeat(32),
          } as object),
        },
      ];

      const serialized = JSON.stringify(evaluate(documents));

      expect(serialized).toContain("41");
      for (const forbidden of [
        "Ana Lopez",
        "Clinica Central",
        "2026-07-12",
        "constancia_medica",
        "abab",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });
  },
);

describe("rn11 and rn12 read only their own mark", () => {
  it("firma Sí with sello Sin registrar: rn11 absent, rn12 not evaluable", () => {
    const documents = [marked(1, { hasSignature: YES, hasSeal: UNREGISTERED })];

    expect(evaluateMissingSignature(documents).outcome).toBe("absent");
    expect(evaluateMissingSeal(documents)).toEqual({
      signal: "rn12",
      outcome: "not_evaluable",
      reason: "not_registered",
    });
  });

  it("ignores the type: the outcome is the same for every type", () => {
    for (const type of [null, ...TIPOS_DOCUMENTO]) {
      const documents = [marked(1, { type, hasSignature: NO, hasSeal: YES })];

      expect(evaluateMissingSignature(documents).outcome).toBe("present");
      expect(evaluateMissingSeal(documents).outcome).toBe("absent");
    }
  });
});

// RN-13 ---------------------------------------------------------------------

const TYPE_VS_CAUSE: readonly [Causa, TipoDocumento, "present" | "absent"][] = [
  ["medica", "constancia_medica", "absent"],
  ["medica", "constancia_institucional", "present"],
  ["medica", "otro", "present"],
  ["maternidad_paternidad", "constancia_medica", "absent"],
  ["maternidad_paternidad", "constancia_institucional", "present"],
  ["maternidad_paternidad", "otro", "present"],
  ["actividad_representativa", "constancia_medica", "present"],
  ["actividad_representativa", "constancia_institucional", "absent"],
  ["actividad_representativa", "otro", "present"],
  ["intercambio_academico", "constancia_medica", "present"],
  ["intercambio_academico", "constancia_institucional", "absent"],
  ["intercambio_academico", "otro", "present"],
  ["fuerza_mayor", "constancia_medica", "present"],
  ["fuerza_mayor", "constancia_institucional", "absent"],
  ["fuerza_mayor", "otro", "present"],
];

function typeMismatch(
  documents: readonly MarkedDocument[],
  causa: Causa = "medica",
) {
  return evaluateTypeMismatch(documents, causa, DOCUMENT_TYPE_CAUSES);
}

describe("rn13: the registered type against the declared cause (MD-14)", () => {
  it("covers every type and every cause", () => {
    expect(TYPE_VS_CAUSE).toHaveLength(TIPOS_DOCUMENTO.length * CAUSAS.length);
  });

  it.each(TYPE_VS_CAUSE)("%s with %s is %s", (causa, type, outcome) => {
    const result = typeMismatch([withType(1, type)], causa);

    expect(result.signal).toBe("rn13");
    expect(result.outcome).toBe(outcome);
  });

  it("otro is present for each of the five causes", () => {
    for (const causa of CAUSAS) {
      expect(typeMismatch([withType(1, "otro")], causa).outcome).toBe(
        "present",
      );
    }
  });

  it("an unregistered type is not evaluable, with not_registered", () => {
    expect(typeMismatch([withType(1, null)])).toEqual({
      signal: "rn13",
      outcome: "not_evaluable",
      reason: "not_registered",
    });
  });

  it("does not read the firma or the sello", () => {
    const flags = [
      { hasSignature: NO, hasSeal: NO },
      { hasSignature: YES, hasSeal: YES },
      { hasSignature: UNREGISTERED, hasSeal: UNREGISTERED },
    ];

    for (const marks of flags) {
      const result = typeMismatch(
        [marked(1, { type: "constancia_medica", ...marks })],
        "medica",
      );
      expect(result.outcome).toBe("absent");
    }
  });
});

describe("rn13: strict aggregation over two documents (MD-16)", () => {
  // Medical certificate against a medical cause corresponds; institutional does
  // not. The same table as rn11 and rn12, over the type check.
  const CORRESPONDS: TipoDocumento = "constancia_medica";
  const MISMATCH: TipoDocumento = "constancia_institucional";

  it.each([
    ["No", "Sí", "present", MISMATCH, CORRESPONDS],
    ["Sí", "No", "present", CORRESPONDS, MISMATCH],
    ["Sí", "Sí", "absent", CORRESPONDS, CORRESPONDS],
    ["Sí", "Sin registrar", "not_registered", CORRESPONDS, null],
    ["No", "Sin registrar", "present", MISMATCH, null],
    ["Sin registrar", "Sin registrar", "not_registered", null, null],
  ] as const)("%s and %s give %s", (_a, _b, expected, typeA, typeB) => {
    const result = typeMismatch([withType(1, typeA), withType(2, typeB)]);

    if (expected === "not_registered") {
      expect(result).toEqual({
        signal: "rn13",
        outcome: "not_evaluable",
        reason: "not_registered",
      });
    } else {
      expect(result.outcome).toBe(expected);
    }
  });

  it("no documents is not evaluable, with no_eligible_documents", () => {
    expect(typeMismatch([])).toEqual({
      signal: "rn13",
      outcome: "not_evaluable",
      reason: "no_eligible_documents",
    });
  });

  it("is never not_applicable, for any cause", () => {
    for (const causa of CAUSAS) {
      expect(typeMismatch([], causa).outcome).not.toBe("not_applicable");
      expect(typeMismatch([withType(1, null)], causa).outcome).not.toBe(
        "not_applicable",
      );
      expect(typeMismatch([withType(1, "otro")], causa).outcome).not.toBe(
        "not_applicable",
      );
    }
  });

  it("the evidence names only the mismatched documents, by id", () => {
    const result = typeMismatch([
      withType(11, MISMATCH),
      withType(12, CORRESPONDS),
      withType(13, "otro"),
    ]);

    expect(result).toEqual({
      signal: "rn13",
      outcome: "present",
      evidence: { kind: "documents", documentIds: [11, 13] },
    });
    expect(JSON.stringify(result)).not.toContain("constancia");
    expect(JSON.stringify(result)).not.toContain("medica");
  });
});

describe("rn13: the map is an input of the evaluation (MD-15)", () => {
  const WIDER_MAP = {
    ...DOCUMENT_TYPE_CAUSES,
    constancia_medica: [
      ...DOCUMENT_TYPE_CAUSES.constancia_medica,
      "fuerza_mayor",
    ],
  } as const satisfies Readonly<Record<TipoDocumento, readonly Causa[]>>;

  const documents = [withType(1, "constancia_medica")];

  it("a fuerza_mayor request flips from present to absent with a wider map", () => {
    const byDefault = evaluateTypeMismatch(
      documents,
      "fuerza_mayor",
      DOCUMENT_TYPE_CAUSES,
    );
    const widened = evaluateTypeMismatch(documents, "fuerza_mayor", WIDER_MAP);

    expect(byDefault.outcome).toBe("present");
    expect(widened.outcome).toBe("absent");
  });

  it("the wider map changes nothing for a cause it did not touch", () => {
    expect(evaluateTypeMismatch(documents, "medica", WIDER_MAP).outcome).toBe(
      "absent",
    );
    expect(
      evaluateTypeMismatch(documents, "intercambio_academico", WIDER_MAP)
        .outcome,
    ).toBe("present");
  });
});
