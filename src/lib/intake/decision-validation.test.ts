import { describe, expect, it } from "vitest";

import { validateDecision, type DecisionDraft } from "./decision-validation";

function codes(input: DecisionDraft): string[] {
  const result = validateDecision(input);
  return result.ok ? [] : result.errors.map((e) => `${e.field}:${e.code}`);
}

const REJECT: DecisionDraft = {
  tipo: "rechazada",
  plantilla: "rechazo.documento_no_acredita",
  texto: "El documento no cubre las fechas.",
};
const RETURN: DecisionDraft = {
  tipo: "devuelta",
  plantilla: "devolucion.documento_ilegible",
  motivo: "documento_ilegible",
  texto: "Adjunte una copia legible.",
};
const APPROVE: DecisionDraft = {
  tipo: "aprobada",
  plantilla: "aprobacion.general",
  texto: null,
};

describe("validateDecision (RF-07, RN-17, RNF-12)", () => {
  it("accepts a valid decision of each kind and normalizes the text", () => {
    expect(validateDecision(APPROVE)).toEqual({
      ok: true,
      decision: {
        tipo: "aprobada",
        plantilla: "aprobacion.general",
        texto: null,
      },
    });
    expect(validateDecision({ ...REJECT, texto: "  motivo claro  " })).toEqual({
      ok: true,
      decision: { ...REJECT, texto: "motivo claro" },
    });
    expect(validateDecision(RETURN).ok).toBe(true);
  });

  it("stores an empty or blank approval text as null", () => {
    for (const texto of ["", "   ", null]) {
      const result = validateDecision({ ...APPROVE, texto });
      expect(result).toMatchObject({ ok: true, decision: { texto: null } });
    }
  });

  it("keeps an approval text and bounds it", () => {
    expect(
      validateDecision({ ...APPROVE, texto: " Aprobada. " }),
    ).toMatchObject({
      ok: true,
      decision: { texto: "Aprobada." },
    });
    expect(codes({ ...APPROVE, texto: "a".repeat(1001) })).toEqual([
      "texto:text_too_long",
    ]);
  });

  describe("reject text bounds (table-driven)", () => {
    const rows: [string, string, string[]][] = [
      ["empty", "", ["texto:text_required"]],
      ["whitespace only", " \n\t ", ["texto:text_required"]],
      ["1 character", "a", []],
      ["1000 characters", "a".repeat(1000), []],
      ["1001 characters", "a".repeat(1001), ["texto:text_too_long"]],
      ["1000 plus padding (trimmed)", ` ${"a".repeat(1000)} `, []],
    ];
    it.each(rows)("%s", (_name, texto, expected) => {
      expect(codes({ ...REJECT, texto })).toEqual(expected);
    });
  });

  it("refuses an unresolved [..] marker in a rejection text", () => {
    expect(codes({ ...REJECT, texto: "Motivo: [indique el motivo]." })).toEqual(
      ["texto:text_placeholder"],
    );
  });

  it("does not apply the marker rule to approvals or returns", () => {
    expect(codes({ ...RETURN, texto: "Ver [anexo 1]." })).toEqual([]);
  });

  it("requires a text to return", () => {
    expect(codes({ ...RETURN, texto: "  " })).toEqual(["texto:text_required"]);
  });

  describe("RN-17 reason code", () => {
    it("is required to return", () => {
      expect(codes({ ...RETURN, motivo: null })).toEqual([
        "motivo:motivo_required",
      ]);
      expect(codes({ ...RETURN, motivo: undefined })).toEqual([
        "motivo:motivo_required",
      ]);
    });

    it("must come from the closed list", () => {
      expect(codes({ ...RETURN, motivo: "otro" })).toEqual([
        "motivo:motivo_invalid",
      ]);
    });

    it("must match the template reason", () => {
      expect(codes({ ...RETURN, motivo: "fecha_alterada" })).toEqual([
        "plantilla:template_mismatch",
      ]);
    });

    it("is refused on approve and reject", () => {
      expect(codes({ ...REJECT, motivo: "fecha_incorrecta" })).toEqual([
        "motivo:motivo_not_allowed",
      ]);
      expect(codes({ ...APPROVE, motivo: "fecha_incorrecta" })).toEqual([
        "motivo:motivo_not_allowed",
      ]);
    });
  });

  describe("template", () => {
    it("must exist", () => {
      expect(codes({ ...REJECT, plantilla: "nope" })).toEqual([
        "plantilla:template_unknown",
      ]);
    });

    it("must match the decision kind", () => {
      expect(codes({ ...REJECT, plantilla: "aprobacion.general" })).toEqual([
        "plantilla:template_mismatch",
      ]);
      expect(
        codes({ ...APPROVE, plantilla: "devolucion.fecha_alterada" }),
      ).toEqual(["plantilla:template_mismatch"]);
    });
  });

  it("refuses an unknown kind, including the coordination state", () => {
    for (const tipo of ["en_revision_coordinacion", "pendiente", ""]) {
      expect(codes({ ...REJECT, tipo })).toEqual(["tipo:tipo_invalid"]);
    }
  });

  it("reports every problem at once, in field order", () => {
    expect(
      codes({ tipo: "devuelta", plantilla: "nope", motivo: null, texto: "" }),
    ).toEqual([
      "plantilla:template_unknown",
      "motivo:motivo_required",
      "texto:text_required",
    ]);
  });
});
