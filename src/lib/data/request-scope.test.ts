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

import { resolveRequestScope } from "@/lib/data/request-scope";

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

describe("resolveRequestScope (SR-6, per request from the database)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("gives a secretaria her facultad from the database", async () => {
    const double = use([{ kind: "select", rows: [{ facultadId: 3 }] }]);

    expect(await resolveRequestScope(20, "secretaria")).toEqual({
      kind: "facultad",
      facultadId: 3,
    });
    expect(double.log).toHaveLength(1);
  });

  it("fails closed for a secretaria without a facultad", async () => {
    use([{ kind: "select", rows: [{ facultadId: null }] }]);

    expect(await resolveRequestScope(20, "secretaria")).toEqual({
      kind: "none",
    });
  });

  it("fails closed when the account row no longer exists", async () => {
    use([{ kind: "select", rows: [] }]);

    expect(await resolveRequestScope(20, "secretaria")).toEqual({
      kind: "none",
    });
  });

  it.each(["estudiante", "coordinacion", "administrador", "docente"] as const)(
    "gives %s no scope without reading the database",
    async (rol) => {
      const double = use([]);

      expect(await resolveRequestScope(20, rol)).toEqual({ kind: "none" });
      expect(double.log).toHaveLength(0);
    },
  );

  it("reads again on every call and never caches", async () => {
    const double = use([
      { kind: "select", rows: [{ facultadId: 3 }] },
      { kind: "select", rows: [{ facultadId: 4 }] },
    ]);

    const first = await resolveRequestScope(20, "secretaria");
    const second = await resolveRequestScope(20, "secretaria");

    expect(first).toEqual({ kind: "facultad", facultadId: 3 });
    expect(second).toEqual({ kind: "facultad", facultadId: 4 });
    expect(double.log).toHaveLength(2);
  });
});
