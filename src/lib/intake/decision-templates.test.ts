import { describe, expect, it } from "vitest";

import { CAUSAS } from "./causes";
import {
  CAUSE_PHRASES,
  DECISION_TEMPLATES,
  PLACEHOLDERS,
  formatDateRange,
  getTemplate,
  renderTemplate,
  templateForReason,
  templatesFor,
} from "./decision-templates";
import { RETURN_REASONS } from "./return-reasons";

const VARS = {
  estudiante: "Ana Perez",
  causa: "medica",
  fechaInicio: "2026-03-03",
  fechaFin: "2026-03-03",
} as const;

describe("decision templates (SR-8)", () => {
  it("has the six templates by code", () => {
    expect(DECISION_TEMPLATES.map((t) => t.codigo)).toEqual([
      "aprobacion.general",
      "rechazo.general",
      "rechazo.documento_no_acredita",
      "devolucion.fecha_incorrecta",
      "devolucion.fecha_alterada",
      "devolucion.documento_ilegible",
    ]);
  });

  it("uses unique codes that fit the PlantillaCodigo varchar(40) column", () => {
    const codes = DECISION_TEMPLATES.map((t) => t.codigo);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code.length).toBeLessThanOrEqual(40);
  });

  it("only uses placeholders the renderer knows", () => {
    for (const template of DECISION_TEMPLATES) {
      const used = template.cuerpo.match(/\{[^}]*\}/g) ?? [];
      for (const placeholder of used) {
        expect(PLACEHOLDERS).toContain(placeholder);
      }
    }
  });

  it("covers approve, reject and return", () => {
    expect(templatesFor("aprobada").length).toBeGreaterThanOrEqual(1);
    expect(templatesFor("rechazada").length).toBeGreaterThanOrEqual(1);
    expect(templatesFor("devuelta")).toHaveLength(RETURN_REASONS.length);
  });

  it("gives every RN-17 reason exactly one return template", () => {
    for (const reason of RETURN_REASONS) {
      const template = templateForReason(reason);
      expect(template.tipo).toBe("devuelta");
      expect(template.motivo).toBe(reason);
    }
  });

  it("gives a Spanish phrase to every cause", () => {
    for (const causa of CAUSAS) {
      expect(CAUSE_PHRASES[causa].length).toBeGreaterThan(0);
    }
  });

  it("looks a template up by code", () => {
    expect(getTemplate("aprobacion.general")?.tipo).toBe("aprobada");
    expect(getTemplate("nope")).toBeUndefined();
  });
});

describe("renderTemplate", () => {
  it("fills student, cause and a single day", () => {
    const text = renderTemplate("aprobacion.general", VARS);
    expect(text).toContain("Ana Perez");
    expect(text).toContain("por motivos médicos");
    expect(text).toContain("el día 3 de marzo de 2026");
    expect(text).toContain("ha sido aprobada");
    expect(text).not.toMatch(/\{[^}]*\}/);
  });

  it("fills a date range", () => {
    const text = renderTemplate("devolucion.fecha_incorrecta", {
      ...VARS,
      fechaFin: "2026-03-05",
    });
    expect(text).toContain("del 3 al 5 de marzo de 2026");
  });

  it("leaves the reject marker for the secretary to complete", () => {
    expect(renderTemplate("rechazo.general", VARS)).toContain(
      "[indique el motivo]",
    );
  });

  it("fills every placeholder of every template", () => {
    for (const { codigo } of DECISION_TEMPLATES) {
      expect(renderTemplate(codigo, VARS)).not.toMatch(/\{[^}]*\}/);
    }
  });

  it("does not re-expand placeholders found inside a value", () => {
    const text = renderTemplate("aprobacion.general", {
      ...VARS,
      estudiante: "{causa}",
    });
    expect(text).toContain("Buenos días, {causa}.");
  });

  it("throws on an unknown code", () => {
    expect(() => renderTemplate("nope", VARS)).toThrow();
  });
});

describe("formatDateRange", () => {
  it.each([
    ["2026-03-03", "2026-03-03", "el día 3 de marzo de 2026"],
    ["2026-03-03", "2026-03-05", "del 3 al 5 de marzo de 2026"],
    ["2026-03-30", "2026-04-02", "del 30 de marzo al 2 de abril de 2026"],
    [
      "2026-12-30",
      "2027-01-02",
      "del 30 de diciembre de 2026 al 2 de enero de 2027",
    ],
  ])("%s to %s", (start, end, expected) => {
    expect(formatDateRange(start, end)).toBe(expected);
  });
});
