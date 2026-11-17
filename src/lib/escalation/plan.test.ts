import { describe, expect, it } from "vitest";

import { planEscalationNotice, type PlanInput } from "./plan";

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    escalamientoId: 7,
    solicitudId: 42,
    tipo: "sospecha_documento",
    nota: "La firma del médico no coincide con el sello.",
    estudianteNombre: "Carlos Ruiz",
    estudianteCif: "2021-0042",
    carreraNombre: "Ingeniería de Sistemas",
    recipients: ["coord1@uam.edu.ni"],
    baseUrl: "https://justifia.example.edu",
    ...overrides,
  };
}

describe("planEscalationNotice (ES-10, E4)", () => {
  it("blocks with sin_destinatarios when nobody can receive it", () => {
    expect(planEscalationNotice(input({ recipients: [] }))).toEqual({
      kind: "blocked",
      motivo: "sin_destinatarios",
    });
  });

  it("treats blank addresses as no recipient", () => {
    expect(planEscalationNotice(input({ recipients: ["", "  "] }))).toEqual({
      kind: "blocked",
      motivo: "sin_destinatarios",
    });
  });

  it("evaluates recipients before the mail configuration", () => {
    expect(
      planEscalationNotice(input({ recipients: [], baseUrl: undefined })),
    ).toEqual({ kind: "blocked", motivo: "sin_destinatarios" });
  });

  it("reports not_configured when the base URL is unset and there are recipients", () => {
    expect(planEscalationNotice(input({ baseUrl: undefined }))).toEqual({
      kind: "not_configured",
    });
  });

  it("sends one message to the only recipient", () => {
    const plan = planEscalationNotice(input());
    expect(plan.kind).toBe("send");
    if (plan.kind !== "send") return;
    expect(plan.draft.to).toBe("coord1@uam.edu.ni");
    expect(plan.draft.cc).toEqual([]);
    expect(plan.draft.text).toContain("Solicitud: 42");
    expect(plan.draft.text).toContain(
      "https://justifia.example.edu/coordination/7",
    );
  });

  it("puts the first recipient in to and the others in cc, in order", () => {
    const plan = planEscalationNotice(
      input({
        recipients: [
          "coord1@uam.edu.ni",
          "coord2@uam.edu.ni",
          "coord3@uam.edu.ni",
        ],
      }),
    );
    expect(plan.kind).toBe("send");
    if (plan.kind !== "send") return;
    expect(plan.draft.to).toBe("coord1@uam.edu.ni");
    expect(plan.draft.cc).toEqual(["coord2@uam.edu.ni", "coord3@uam.edu.ni"]);
    expect(plan.destinatarios).toBe(3);
  });

  it("builds the idempotency key from the id and the recipient set", () => {
    const first = planEscalationNotice(input());
    const again = planEscalationNotice(input());
    const other = planEscalationNotice(
      input({ recipients: ["coord1@uam.edu.ni", "coord2@uam.edu.ni"] }),
    );
    if (
      first.kind !== "send" ||
      again.kind !== "send" ||
      other.kind !== "send"
    ) {
      throw new Error("expected sendable plans");
    }
    expect(first.idempotencyKey).toMatch(/^escalamiento-7-[0-9a-f]{16}$/);
    expect(again.idempotencyKey).toBe(first.idempotencyKey);
    expect(other.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it("does not change the key when only the wording inputs change", () => {
    const a = planEscalationNotice(input());
    const b = planEscalationNotice(input({ nota: "Otra nota." }));
    if (a.kind !== "send" || b.kind !== "send") throw new Error("not sendable");
    expect(b.idempotencyKey).toBe(a.idempotencyKey);
  });
});
