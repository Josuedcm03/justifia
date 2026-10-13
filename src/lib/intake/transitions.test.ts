import { describe, expect, it } from "vitest";

import { rolesUsuario } from "@/lib/validations/auth";

import { ESTADOS_SOLICITUD } from "./states";
import { canTransition, TRANSITIONS } from "./transitions";

const ALLOWED = new Set([
  "borrador>pendiente:estudiante",
  "pendiente>aprobada:secretaria",
  "pendiente>rechazada:secretaria",
  "pendiente>devuelta:secretaria",
  "devuelta>pendiente:estudiante",
]);

describe("canTransition (RN-15, RN-16, SR-4)", () => {
  it("allows exactly the five edges of the table, for their actor only", () => {
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

  it("has no edge into or out of en_revision_coordinacion (RF-10 out of scope)", () => {
    for (const other of ESTADOS_SOLICITUD) {
      for (const actor of rolesUsuario) {
        expect(canTransition(other, "en_revision_coordinacion", actor)).toBe(
          false,
        );
        expect(canTransition("en_revision_coordinacion", other, actor)).toBe(
          false,
        );
      }
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
