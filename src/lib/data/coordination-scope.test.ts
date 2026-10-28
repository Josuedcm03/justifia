// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder } = vi.hoisted(() => ({ holder: { current: null as unknown } }));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

import { resolveCoordinationScope } from "@/lib/data/coordination-scope";

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

describe("resolveCoordinationScope (ES-9, per request from the database)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("gives a coordinacion her career from the database", async () => {
    const double = use([
      { kind: "select", rows: [{ carreraId: 5, activo: true }] },
    ]);

    expect(await resolveCoordinationScope(30, "coordinacion")).toEqual({
      kind: "carrera",
      carreraId: 5,
    });
    expect(double.log).toHaveLength(1);
  });

  it("fails closed for a coordinacion without a career", async () => {
    use([{ kind: "select", rows: [{ carreraId: null, activo: true }] }]);

    expect(await resolveCoordinationScope(30, "coordinacion")).toEqual({
      kind: "none",
    });
  });

  it("fails closed for a deactivated account", async () => {
    use([{ kind: "select", rows: [{ carreraId: 5, activo: false }] }]);

    expect(await resolveCoordinationScope(30, "coordinacion")).toEqual({
      kind: "none",
    });
  });

  it("fails closed when the account row no longer exists", async () => {
    use([{ kind: "select", rows: [] }]);

    expect(await resolveCoordinationScope(30, "coordinacion")).toEqual({
      kind: "none",
    });
  });

  it.each(["estudiante", "secretaria", "administrador", "docente"] as const)(
    "gives %s no scope without reading the database",
    async (rol) => {
      const double = use([]);

      expect(await resolveCoordinationScope(30, rol)).toEqual({ kind: "none" });
      expect(double.log).toHaveLength(0);
    },
  );

  it("reads again on every call and never caches (career change takes effect)", async () => {
    const double = use([
      { kind: "select", rows: [{ carreraId: 5, activo: true }] },
      { kind: "select", rows: [{ carreraId: 6, activo: true }] },
    ]);

    const first = await resolveCoordinationScope(30, "coordinacion");
    const second = await resolveCoordinationScope(30, "coordinacion");

    expect(first).toEqual({ kind: "carrera", carreraId: 5 });
    expect(second).toEqual({ kind: "carrera", carreraId: 6 });
    expect(double.log).toHaveLength(2);
  });
});
