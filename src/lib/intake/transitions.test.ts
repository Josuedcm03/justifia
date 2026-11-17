import { describe, expect, it } from "vitest";

import { rolesUsuario } from "@/lib/validations/auth";

import { DECISION_KINDS } from "./decision-templates";
import { ESTADOS_SOLICITUD } from "./states";
import { canTransition, sourceOf, TRANSITIONS } from "./transitions";

const ALLOWED = new Set([
  "borrador>pendiente:estudiante",
  "pendiente>aprobada:secretaria",
  "pendiente>rechazada:secretaria",
  "pendiente>devuelta:secretaria",
  "devuelta>pendiente:estudiante",
  // Escalation to the career coordination and its answer (RF-10, ES-4).
  "pendiente>en_revision_coordinacion:secretaria",
  "en_revision_coordinacion>pendiente:coordinacion",
]);

describe("canTransition (RN-15, RN-16, SR-4)", () => {
  it("allows exactly the seven edges of the table, for their actor only", () => {
    const found = new Set<string>();
    for (const from of ESTADOS_SOLICITUD) {
      for (const to of ESTADOS_SOLICITUD) {
        for (const actor of rolesUsuario) {
          if (canTransition(from, to, actor)) {
            found.add(`${from}>${to}:${actor}`);
          }
        }
      }
    }
    expect(found).toEqual(ALLOWED);
  });

  it("lets only the secretaria decide a pending request (RN-15)", () => {
    for (const to of ["aprobada", "rechazada", "devuelta"] as const) {
      expect(canTransition("pendiente", to, "secretaria")).toBe(true);
      for (const actor of rolesUsuario.filter((r) => r !== "secretaria")) {
        expect(canTransition("pendiente", to, actor)).toBe(false);
      }
    }
  });

  it("lets only the student resubmit a returned request (RF-08 c)", () => {
    expect(canTransition("devuelta", "pendiente", "estudiante")).toBe(true);
    expect(canTransition("devuelta", "pendiente", "secretaria")).toBe(false);
  });

  it("keeps aprobada and rechazada terminal", () => {
    for (const from of ["aprobada", "rechazada"] as const) {
      for (const to of ESTADOS_SOLICITUD) {
        for (const actor of rolesUsuario) {
          expect(canTransition(from, to, actor)).toBe(false);
        }
      }
    }
  });

  it("reaches coordination only by the secretary escalation (RF-10)", () => {
    expect(
      canTransition("pendiente", "en_revision_coordinacion", "secretaria"),
    ).toBe(true);
    for (const from of ESTADOS_SOLICITUD) {
      for (const actor of rolesUsuario) {
        const allowed = from === "pendiente" && actor === "secretaria";
        expect(canTransition(from, "en_revision_coordinacion", actor)).toBe(
          allowed,
        );
      }
    }
  });

  it("leaves coordination only by the coordinator answer, back to pendiente", () => {
    expect(
      canTransition("en_revision_coordinacion", "pendiente", "coordinacion"),
    ).toBe(true);
    for (const to of ESTADOS_SOLICITUD) {
      for (const actor of rolesUsuario) {
        const allowed = to === "pendiente" && actor === "coordinacion";
        expect(canTransition("en_revision_coordinacion", to, actor)).toBe(
          allowed,
        );
      }
    }
  });

  it("never lets an approved request enter coordination", () => {
    for (const actor of rolesUsuario) {
      expect(canTransition("aprobada", "en_revision_coordinacion", actor)).toBe(
        false,
      );
    }
  });

  it("never allows a self transition", () => {
    for (const estado of ESTADOS_SOLICITUD) {
      for (const actor of rolesUsuario) {
        expect(canTransition(estado, estado, actor)).toBe(false);
      }
    }
  });

  it("exposes the table the data layer derives its SQL guards from", () => {
    expect(
      TRANSITIONS.map((t) => `${t.from}>${t.to}:${t.actor}`).sort(),
    ).toEqual([...ALLOWED].sort());
  });
});

describe("sourceOf (ES-4)", () => {
  it("returns the single state an escalation starts from", () => {
    expect(sourceOf("en_revision_coordinacion", "secretaria")).toBe(
      "pendiente",
    );
  });

  it("returns the single state an answer starts from", () => {
    expect(sourceOf("pendiente", "coordinacion")).toBe(
      "en_revision_coordinacion",
    );
  });

  it("throws when the pair has no edge", () => {
    expect(() => sourceOf("aprobada", "coordinacion")).toThrow(
      /No unique coordinacion transition into aprobada/,
    );
    expect(() => sourceOf("pendiente", "secretaria")).toThrow(
      /No unique secretaria transition into pendiente/,
    );
  });

  it("throws when the pair has more than one source", () => {
    // Submit (borrador) and resubmit (devuelta) both enter pendiente.
    expect(() => sourceOf("pendiente", "estudiante")).toThrow(
      /No unique estudiante transition into pendiente/,
    );
  });
});

describe("secretary decision sources stay unique (ES-4)", () => {
  it.each(DECISION_KINDS)("%s has exactly one secretary source", (kind) => {
    const sources = TRANSITIONS.filter(
      (t) => t.to === kind && t.actor === "secretaria",
    ).map((t) => t.from);
    expect(sources).toEqual(["pendiente"]);
    expect(sourceOf(kind, "secretaria")).toBe("pendiente");
  });
});
