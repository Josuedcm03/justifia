import { describe, expect, it } from "vitest";

import { rolesUsuario } from "@/lib/validations/auth";

import { coordinationScopeFor } from "./coordination-scope";

describe("coordinationScopeFor (ES-9, RNF-01)", () => {
  it("scopes an active coordinacion with a career to it", () => {
    expect(
      coordinationScopeFor("coordinacion", { carreraId: 7, activo: true }),
    ).toEqual({ kind: "carrera", carreraId: 7 });
  });

  it("binds the career of the actor, not a constant", () => {
    expect(
      coordinationScopeFor("coordinacion", { carreraId: 12, activo: true }),
    ).toEqual({ kind: "carrera", carreraId: 12 });
  });

  it("fails closed for a coordinacion without a career", () => {
    expect(
      coordinationScopeFor("coordinacion", { carreraId: null, activo: true }),
    ).toEqual({ kind: "none" });
  });

  it("fails closed for an inactive coordinacion", () => {
    expect(
      coordinationScopeFor("coordinacion", { carreraId: 7, activo: false }),
    ).toEqual({ kind: "none" });
  });

  it("fails closed without an actor", () => {
    expect(coordinationScopeFor("coordinacion", null)).toEqual({
      kind: "none",
    });
  });

  it("gives every other role no scope, even with a career", () => {
    const others = rolesUsuario.filter((r) => r !== "coordinacion");
    expect(others.length).toBeGreaterThan(0);
    for (const rol of others) {
      expect(coordinationScopeFor(rol, { carreraId: 7, activo: true })).toEqual(
        { kind: "none" },
      );
    }
  });
});
