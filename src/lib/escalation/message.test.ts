import { describe, expect, it } from "vitest";

import {
  REASON_LABELS,
  buildEscalationMessage,
  type EscalationMessageInput,
} from "./message";

function input(
  overrides: Partial<EscalationMessageInput> = {},
): EscalationMessageInput {
  return {
    to: "coord1@uam.edu.ni",
    cc: [],
    solicitudId: 42,
    escalamientoId: 7,
    tipo: "sospecha_documento",
    estudianteNombre: "Carlos Ruiz",
    estudianteCif: "2021-0042",
    carreraNombre: "Ingeniería de Sistemas",
    nota: "La firma del médico no coincide con el sello.",
    baseUrl: "https://justifia.example.edu",
    ...overrides,
  };
}

describe("buildEscalationMessage (ES-10, E6)", () => {
  it("is addressed to the first recipient with the rest in copy", () => {
    const message = buildEscalationMessage(
      input({ cc: ["coord2@uam.edu.ni", "coord3@uam.edu.ni"] }),
    );
    expect(message.to).toBe("coord1@uam.edu.ni");
    expect(message.cc).toEqual(["coord2@uam.edu.ni", "coord3@uam.edu.ni"]);
  });

  it("holds the request number, the student, the career, the reason and the note", () => {
    const { text } = buildEscalationMessage(input());
    expect(text).toContain("Solicitud: 42");
    expect(text).toContain("Estudiante: Carlos Ruiz (CIF 2021-0042)");
    expect(text).toContain("Carrera: Ingeniería de Sistemas");
    expect(text).toContain("Motivo: Sospecha sobre un documento");
    expect(text).toContain(
      "Nota: La firma del médico no coincide con el sello.",
    );
  });

  it("names the excess-absence reason and carries the report note when given", () => {
    const { text } = buildEscalationMessage(
      input({ tipo: "exceso_inasistencias", nota: "Supera el límite." }),
    );
    expect(text).toContain("Motivo: Exceso de inasistencias");
    expect(text).toContain("Nota: Supera el límite.");
  });

  it("leaves the note line out when there is no note", () => {
    const { text } = buildEscalationMessage(
      input({ tipo: "exceso_inasistencias", nota: null }),
    );
    expect(text).not.toContain("Nota:");
    expect(text).toContain("Motivo: Exceso de inasistencias");
  });

  it("links to the escalation page with no token and tolerates a trailing slash", () => {
    const plain = buildEscalationMessage(input());
    const slash = buildEscalationMessage(
      input({ baseUrl: "https://justifia.example.edu/" }),
    );
    expect(plain.text).toContain("https://justifia.example.edu/coordination/7");
    expect(slash.text).toContain("https://justifia.example.edu/coordination/7");
    expect(slash.text).not.toContain("//coordination");
    expect(plain.text).not.toMatch(/[?&#]/);
  });

  it("subject names the request number only, one subject per kind", () => {
    const sospecha = buildEscalationMessage(input()).subject;
    const exceso = buildEscalationMessage(
      input({ tipo: "exceso_inasistencias" }),
    ).subject;
    expect(sospecha).toBe("Justifia: solicitud 42 escalada a coordinación");
    expect(exceso).toBe("Justifia: aviso sobre la solicitud 42");
    expect(sospecha).not.toContain("Carlos");
  });

  it("collapses line breaks and control characters in names and notes", () => {
    const { text } = buildEscalationMessage(
      input({
        estudianteNombre: "Carlos\nRuiz",
        nota: "Primera línea.\r\n\u0007Segunda línea.",
      }),
    );
    expect(text).toContain("Estudiante: Carlos Ruiz (CIF 2021-0042)");
    expect(text).toContain("Nota: Primera línea. Segunda línea.");
  });

  it("has no attachment, cause, date, teacher, document or answer wording", () => {
    const { text, subject } = buildEscalationMessage(input());
    const all = `${subject}\n${text}`.toLowerCase();
    for (const word of [
      "causa",
      "fecha",
      "docente",
      "profesor",
      "documento:",
      "adjunt",
      "respuesta",
      "token",
    ]) {
      expect(all).not.toContain(word);
    }
  });

  it("greets the coordination without a time of day and signs as the secretary", () => {
    const { text } = buildEscalationMessage(input());
    const lines = text.split("\n");
    expect(lines[0]).toBe("Estimada coordinación:");
    expect(lines.slice(-2)).toEqual(["Atentamente,", "Secretaría Académica"]);
    expect(text.toLowerCase()).not.toMatch(/buenos días|buenas tardes/);
  });

  it("labels every reason in Spanish", () => {
    expect(REASON_LABELS).toEqual({
      sospecha_documento: "Sospecha sobre un documento",
      caso_especial: "Caso especial",
      exceso_inasistencias: "Exceso de inasistencias",
    });
  });

  it("names a special case in the reason line and keeps the escalation subject (E18)", () => {
    const message = buildEscalationMessage(
      input({ tipo: "caso_especial", nota: "Fallecimiento de un familiar." }),
    );
    expect(message.text).toContain("Motivo: Caso especial");
    expect(message.text).toContain("Nota: Fallecimiento de un familiar.");
    expect(message.subject).toBe(
      "Justifia: solicitud 42 escalada a coordinación",
    );
  });
});
