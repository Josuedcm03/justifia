import { describe, expect, it } from "vitest";

import { reportScopeFor } from "@/lib/reports/scope";
import { rolesUsuario } from "@/lib/validations/auth";

describe("reportScopeFor (CR-ACC-1, CR-SCOPE-1)", () => {
  it("scopes a coordinacion user with a career to that career", () => {
    expect(reportScopeFor("coordinacion", { carreraId: 4 })).toEqual({
      kind: "carrera",
      carreraId: 4,
    });
    expect(reportScopeFor("coordinacion", { carreraId: 9 })).toEqual({
      kind: "carrera",
      carreraId: 9,
    });
  });

  it("fails closed for coordinacion without a career (scenario: no career)", () => {
    expect(reportScopeFor("coordinacion", { carreraId: null })).toEqual({
      kind: "none",
    });
  });

  it("fails closed when the actor row no longer exists", () => {
    expect(reportScopeFor("coordinacion", null)).toEqual({ kind: "none" });
  });

  it.each(rolesUsuario.filter((rol) => rol !== "coordinacion"))(
    "gives %s no scope even with a career",
    (rol) => {
      expect(reportScopeFor(rol, { carreraId: 4 })).toEqual({ kind: "none" });
    },
  );
});
