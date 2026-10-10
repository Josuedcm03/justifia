import { describe, expect, it } from "vitest";

import {
  carreraIdForWrite,
  catalogScopeFor,
  type CatalogScope,
} from "@/lib/catalog/scope";

describe("catalogScopeFor (CM-SCOPE-1, CM-SCOPE-2)", () => {
  it.each(["administrador", "secretaria"] as const)(
    "%s sees everything",
    (rol) => {
      expect(catalogScopeFor(rol, { carreraId: null })).toEqual({
        kind: "all",
      });
      expect(catalogScopeFor(rol, { carreraId: 7 })).toEqual({ kind: "all" });
      expect(catalogScopeFor(rol, null)).toEqual({ kind: "all" });
    },
  );

  it("coordinacion with a carrera is scoped to it", () => {
    expect(catalogScopeFor("coordinacion", { carreraId: 7 })).toEqual({
      kind: "carrera",
      carreraId: 7,
    });
  });

  it("coordinacion without a carrera sees nothing", () => {
    expect(catalogScopeFor("coordinacion", { carreraId: null })).toEqual({
      kind: "none",
    });
  });

  it("coordinacion whose row vanished sees nothing", () => {
    expect(catalogScopeFor("coordinacion", null)).toEqual({ kind: "none" });
  });

  it.each(["docente", "estudiante"] as const)("%s sees nothing", (rol) => {
    expect(catalogScopeFor(rol, { carreraId: 7 })).toEqual({ kind: "none" });
    expect(catalogScopeFor(rol, null)).toEqual({ kind: "none" });
  });
});

describe("carreraIdForWrite (CM-SCOPE-1..3)", () => {
  const all: CatalogScope = { kind: "all" };
  const own: CatalogScope = { kind: "carrera", carreraId: 7 };
  const none: CatalogScope = { kind: "none" };

  it("unscoped chooses the requested carrera", () => {
    expect(carreraIdForWrite(all, 3)).toBe(3);
  });

  it("unscoped without a request refuses", () => {
    expect(carreraIdForWrite(all, undefined)).toBeNull();
  });

  it("scoped without a request uses its own carrera", () => {
    expect(carreraIdForWrite(own, undefined)).toBe(7);
  });

  it("scoped requesting its own carrera uses it", () => {
    expect(carreraIdForWrite(own, 7)).toBe(7);
  });

  it("scoped requesting another carrera refuses", () => {
    expect(carreraIdForWrite(own, 9)).toBeNull();
  });

  it("none refuses everything", () => {
    expect(carreraIdForWrite(none, undefined)).toBeNull();
    expect(carreraIdForWrite(none, 7)).toBeNull();
  });
});
