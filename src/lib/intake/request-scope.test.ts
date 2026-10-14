import { describe, expect, it } from "vitest";

import { rolesUsuario } from "@/lib/validations/auth";

import { requestScopeFor } from "./request-scope";

describe("requestScopeFor (SR-6, RNF-01)", () => {
  it("scopes a secretaria with a facultad to it", () => {
    expect(requestScopeFor("secretaria", { facultadId: 7 })).toEqual({
      kind: "facultad",
      facultadId: 7,
    });
  });

  it("fails closed for a secretaria without a facultad", () => {
    expect(requestScopeFor("secretaria", { facultadId: null })).toEqual({
      kind: "none",
    });
  });

  it("fails closed without an actor", () => {
    expect(requestScopeFor("secretaria", null)).toEqual({ kind: "none" });
  });

  it("gives every other role no scope, even with a facultad", () => {
    for (const rol of rolesUsuario.filter((r) => r !== "secretaria")) {
      expect(requestScopeFor(rol, { facultadId: 7 })).toEqual({ kind: "none" });
    }
  });
});
