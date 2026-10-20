import { describe, expect, it } from "vitest";

import { MAX_REMISSION_ATTACHMENT_BYTES } from "./limits";
import { RN18_WARNING } from "./message";
import { planRemission, type PlanDocument, type PlanInput } from "./plan";

const clase = {
  asignaturaId: 10,
  codigo: "MAT101",
  nombre: "Matematica I",
  numeroGrupo: "A",
};

function doc(overrides: Partial<PlanDocument> = {}): PlanDocument {
  return {
    id: 1,
    nombreOriginal: "constancia.pdf",
    tipoDetectado: "pdf",
    tamanoBytes: 1000,
    subidoPorId: null,
    formatoEspecial: false,
    ...overrides,
  };
}

function format(overrides: Partial<PlanDocument> = {}): PlanDocument {
  return doc({
    id: 90,
    nombreOriginal: "formato-firmado.pdf",
    subidoPorId: 7,
    formatoEspecial: true,
    ...overrides,
  });
}

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    remisionId: 5,
    correo: "ana@uam.edu.ni",
    clases: [clase],
    solicitud: {
      causa: "medica",
      fechaInicio: "2026-03-03",
      fechaFin: "2026-03-05",
      estudianteNombre: "Carlos Ruiz",
      estudianteCif: "2021-0042",
      estudianteCorreo: "estudiante@uam.edu.ni",
      formatoEspecial: false,
    },
    documentos: [doc()],
    ...overrides,
  };
}

function marked(documentos: PlanDocument[]): PlanInput {
  const base = input();
  return {
    ...base,
    solicitud: {
      ...base.solicitud,
      causa: "fuerza_mayor",
      formatoEspecial: true,
    },
    documentos,
  };
}

describe("planRemission gate order (TR-7)", () => {
  it("blocks sin_correo first, even when the format is also missing", () => {
    expect(planRemission({ ...marked([]), correo: null })).toEqual({
      kind: "blocked",
      motivo: "sin_correo",
    });
  });

  it("treats a blank email as missing", () => {
    expect(planRemission(input({ correo: "  " }))).toEqual({
      kind: "blocked",
      motivo: "sin_correo",
    });
  });

  it("blocks formato_especial_faltante before the size guard", () => {
    const huge = doc({
      id: 2,
      tamanoBytes: MAX_REMISSION_ATTACHMENT_BYTES + 1,
    });
    expect(planRemission(marked([huge]))).toEqual({
      kind: "blocked",
      motivo: "formato_especial_faltante",
    });
  });

  it("blocks adjuntos_exceden_limite when the total is over the limit", () => {
    const plan = planRemission(
      input({
        documentos: [
          doc({ id: 1, tamanoBytes: MAX_REMISSION_ATTACHMENT_BYTES - 5 }),
          doc({ id: 2, tamanoBytes: 6 }),
        ],
      }),
    );
    expect(plan).toEqual({
      kind: "blocked",
      motivo: "adjuntos_exceden_limite",
    });
  });

  it("sends when the total is exactly at the limit", () => {
    const plan = planRemission(
      input({
        documentos: [
          doc({ id: 1, tamanoBytes: MAX_REMISSION_ATTACHMENT_BYTES - 5 }),
          doc({ id: 2, tamanoBytes: 5 }),
        ],
      }),
    );
    expect(plan.kind).toBe("send");
  });
});

describe("planRemission document selection (RN-19, TR-5)", () => {
  it("sends the student's valid documents for an unmarked request", () => {
    const plan = planRemission(
      input({
        documentos: [doc({ id: 1 }), doc({ id: 2, nombreOriginal: "b.png" })],
      }),
    );
    expect(plan.kind === "send" && plan.documentIds).toEqual([1, 2]);
  });

  it("never sends a staff upload for an unmarked request", () => {
    const plan = planRemission(
      input({ documentos: [doc({ id: 1 }), format()] }),
    );
    expect(plan.kind === "send" && plan.documentIds).toEqual([1]);
    expect(plan.kind === "send" && plan.draft.text).not.toContain(
      "formato-firmado.pdf",
    );
  });

  it("sends only the uploaded format for a marked request", () => {
    const plan = planRemission(marked([doc({ id: 1 }), format()]));
    expect(plan.kind === "send" && plan.documentIds).toEqual([90]);
    expect(plan.kind === "send" && plan.draft.text).toContain(
      "formato-firmado.pdf",
    );
    expect(plan.kind === "send" && plan.draft.text).not.toContain(
      "constancia.pdf",
    );
  });

  it("blocks a marked request without a format, ignoring student documents", () => {
    expect(planRemission(marked([doc({ id: 1 })]))).toEqual({
      kind: "blocked",
      motivo: "formato_especial_faltante",
    });
  });
});

describe("planRemission message and key", () => {
  it("builds the draft for the snapshot recipient with the warning", () => {
    const plan = planRemission(input());
    if (plan.kind !== "send") throw new Error("expected a send plan");
    expect(plan.draft.to).toBe("ana@uam.edu.ni");
    expect(plan.draft.cc).toEqual(["estudiante@uam.edu.ni"]);
    expect(plan.draft.text).toContain(RN18_WARNING);
    expect(plan.draft.text).toContain("constancia.pdf");
  });

  it("derives remision-{Id}-{digest} for the idempotency key", () => {
    const plan = planRemission(input());
    if (plan.kind !== "send") throw new Error("expected a send plan");
    expect(plan.idempotencyKey).toMatch(/^remision-5-[0-9a-f]{16}$/);
  });

  it("keeps the key stable for an equal payload", () => {
    const a = planRemission(input());
    const b = planRemission(input());
    expect(a.kind === "send" && a.idempotencyKey).toBe(
      b.kind === "send" && b.idempotencyKey,
    );
  });

  it.each([
    ["recipient", input({ correo: "otra@uam.edu.ni" })],
    [
      "student copy",
      (() => {
        const base = input();
        return {
          ...base,
          solicitud: { ...base.solicitud, estudianteCorreo: "x@uam.edu.ni" },
        };
      })(),
    ],
    ["attachment ids", input({ documentos: [doc({ id: 2 })] })],
    ["attachment sizes", input({ documentos: [doc({ tamanoBytes: 1001 })] })],
  ])("changes the key when the %s changes", (_name, changed) => {
    const base = planRemission(input());
    const other = planRemission(changed);
    expect(base.kind === "send" && other.kind === "send").toBe(true);
    expect(base.kind === "send" && base.idempotencyKey).not.toBe(
      other.kind === "send" && other.idempotencyKey,
    );
  });
});
