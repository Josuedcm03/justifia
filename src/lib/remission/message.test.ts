import { describe, expect, it } from "vitest";

import {
  CAUSE_PHRASES,
  formatDateRange,
} from "@/lib/intake/decision-templates";

import {
  RN18_DISCRETION_NOTE,
  RN18_WARNING,
  buildRemissionMessage,
  type RemissionMessageInput,
} from "./message";

const groupA = {
  asignaturaId: 10,
  codigo: "MAT101",
  nombre: "Matematica I",
  numeroGrupo: "A",
};
const groupB = {
  asignaturaId: 11,
  codigo: "FIS101",
  nombre: "Fisica I",
  numeroGrupo: "B",
};

function input(
  overrides: Partial<RemissionMessageInput> = {},
): RemissionMessageInput {
  return {
    to: "ana@uam.edu.ni",
    cc: "estudiante@uam.edu.ni",
    estudianteNombre: "Carlos Ruiz",
    estudianteCif: "2021-0042",
    causa: "medica",
    fechaInicio: "2026-03-03",
    fechaFin: "2026-03-05",
    clases: [groupA],
    adjuntos: ["constancia.pdf"],
    ...overrides,
  };
}

describe("buildRemissionMessage (RF-09 a, RN-18, TR-10)", () => {
  it("is addressed to the snapshot email with the student in copy", () => {
    const message = buildRemissionMessage(input());
    expect(message.to).toBe("ana@uam.edu.ni");
    expect(message.cc).toEqual(["estudiante@uam.edu.ni"]);
  });

  it("uses the approved Spanish subject", () => {
    expect(buildRemissionMessage(input()).subject).toBe(
      "Justificar la inasistencia de Carlos Ruiz",
    );
  });

  it("opens and closes like the secretary's own messages", () => {
    const { text } = buildRemissionMessage(input());
    expect(text).toContain(
      `Buenos días, su apoyo en justificar la inasistencia de Carlos Ruiz por motivos ${CAUSE_PHRASES.medica}, ${formatDateRange("2026-03-03", "2026-03-05")}.`,
    );
    expect(text.trimEnd().endsWith("Gracias de antemano.")).toBe(true);
  });

  it("states the student CIF and the cause phrase of each cause", () => {
    const medica = buildRemissionMessage(input({ causa: "medica" })).text;
    const exchange = buildRemissionMessage(
      input({ causa: "intercambio_academico" }),
    ).text;
    expect(medica).toContain("2021-0042");
    expect(medica).toContain(`por motivos ${CAUSE_PHRASES.medica},`);
    expect(exchange).toContain(
      `por motivos ${CAUSE_PHRASES.intercambio_academico},`,
    );
  });

  it("renders a single day with the shared date formatter", () => {
    const { text } = buildRemissionMessage(
      input({ fechaInicio: "2026-03-03", fechaFin: "2026-03-03" }),
    );
    expect(text).toContain(formatDateRange("2026-03-03", "2026-03-03"));
  });

  it("lists only the groups of this teacher (T1 never sees T2)", () => {
    const t1 = buildRemissionMessage(input({ clases: [groupA] })).text;
    const t2 = buildRemissionMessage(input({ clases: [groupB] })).text;
    expect(t1).toContain("MAT101");
    expect(t1).not.toContain("FIS101");
    expect(t2).toContain("FIS101");
    expect(t2).not.toContain("MAT101");
  });

  it("lists the names of the attachments", () => {
    const { text } = buildRemissionMessage(
      input({ adjuntos: ["constancia.pdf", "receta.png"] }),
    );
    expect(text).toContain("constancia.pdf");
    expect(text).toContain("receta.png");
  });

  it("carries the approved RN-18 warning verbatim for every cause", () => {
    expect(RN18_WARNING).toBe(
      "Esta justificación habilita la reprogramación de las evaluaciones o actividades de las fechas indicadas; no elimina la inasistencia del registro.",
    );
    for (const causa of Object.keys(CAUSE_PHRASES) as never[]) {
      expect(buildRemissionMessage(input({ causa })).text).toContain(
        RN18_WARNING,
      );
    }
  });

  it("adds the discretion note only for force majeure", () => {
    expect(RN18_DISCRETION_NOTE).toBe(
      "Por tratarse de una causa de fuerza mayor, la aplicación de penalizaciones en las evaluaciones reprogramadas queda a criterio del docente.",
    );
    expect(
      buildRemissionMessage(input({ causa: "fuerza_mayor" })).text,
    ).toContain(RN18_DISCRETION_NOTE);
    for (const causa of [
      "medica",
      "maternidad_paternidad",
      "actividad_representativa",
      "intercambio_academico",
    ] as const) {
      expect(buildRemissionMessage(input({ causa })).text).not.toContain(
        RN18_DISCRETION_NOTE,
      );
    }
  });

  it("keeps a student name with line breaks on one line of the subject", () => {
    const message = buildRemissionMessage(
      input({ estudianteNombre: "Carlos\r\nBcc: x@y.z Ruiz" }),
    );
    expect(message.subject).toBe(
      "Justificar la inasistencia de Carlos Bcc: x@y.z Ruiz",
    );
    expect(message.subject).not.toMatch(/[\r\n]/);
  });
});
