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

import { resolveReportScope } from "@/lib/data/report-scope";

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

describe("resolveReportScope (CR-2, per request from the database)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("gives a coordinacion user the career read from the database", async () => {
    const double = use([{ kind: "select", rows: [{ carreraId: 4 }] }]);

    expect(await resolveReportScope(30, "coordinacion")).toEqual({
      kind: "carrera",
      carreraId: 4,
    });
    expect(double.log).toHaveLength(1);
  });

  it("fails closed for coordinacion without a career", async () => {
    use([{ kind: "select", rows: [{ carreraId: null }] }]);

    expect(await resolveReportScope(30, "coordinacion")).toEqual({
      kind: "none",
    });
  });

  it("fails closed when the account row no longer exists", async () => {
    use([{ kind: "select", rows: [] }]);

    expect(await resolveReportScope(30, "coordinacion")).toEqual({
      kind: "none",
    });
  });

  it.each(["estudiante", "secretaria", "administrador", "docente"] as const)(
    "gives %s no scope without reading the database",
    async (rol) => {
      const double = use([]);

      expect(await resolveReportScope(30, rol)).toEqual({ kind: "none" });
      expect(double.log).toHaveLength(0);
    },
  );

  it("lets a failed read propagate instead of failing open", async () => {
    use([{ kind: "select", error: new Error("db down") }]);

    await expect(resolveReportScope(30, "coordinacion")).rejects.toThrow(
      "db down",
    );
  });

  it("reads again on every call and never caches", async () => {
    const double = use([
      { kind: "select", rows: [{ carreraId: 4 }] },
      { kind: "select", rows: [{ carreraId: 5 }] },
    ]);

    const first = await resolveReportScope(30, "coordinacion");
    const second = await resolveReportScope(30, "coordinacion");

    expect(first).toEqual({ kind: "carrera", carreraId: 4 });
    expect(second).toEqual({ kind: "carrera", carreraId: 5 });
    expect(double.log).toHaveLength(2);
  });
});
