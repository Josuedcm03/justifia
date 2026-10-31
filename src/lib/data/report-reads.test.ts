// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, insertAuditMock, cacheMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  insertAuditMock: vi.fn(),
  // React's `cache` dedupes by argument identity within one render pass; the
  // plain client build used by vitest does not, so the fake memoises by args.
  cacheMock: vi.fn(<A extends unknown[], R>(fn: (...args: A) => R) => {
    const memo = new Map<string, R>();
    return (...args: A): R => {
      const key = JSON.stringify(args);
      if (!memo.has(key)) memo.set(key, fn(...args));
      return memo.get(key) as R;
    };
  }),
}));

vi.mock("react", () => ({ cache: cacheMock }));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: insertAuditMock }));

import {
  recordReportDashboardRead,
  recordReportRequestsRead,
} from "@/lib/data/report-reads";

// Captured at load: the setup file clears mock history between tests.
const cacheCallsAtLoad = [...cacheMock.mock.calls];

function use(script: Step[] = []) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

describe("report reads (CR-7, CR-AUDIT-1, RNF-06)", () => {
  beforeEach(() => {
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  it("wraps each page writer in React cache() once, at module load", () => {
    expect(cacheCallsAtLoad).toHaveLength(2);
    for (const [fn] of cacheCallsAtLoad) expect(fn).toBeTypeOf("function");
  });

  describe("recordReportDashboardRead", () => {
    it("writes one solicitud.ranking.consultado row in one transaction", async () => {
      const double = use();

      await recordReportDashboardRead(30, 4, "2026-S2", 10, 4, 7);

      expect(double.transactions).toBe(1);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      const [, actor, events] = insertAuditMock.mock.calls[0];
      expect(actor).toBe(30);
      expect(events).toEqual([
        {
          accion: "solicitud.ranking.consultado",
          entidadTipo: "Carrera",
          entidadId: 4,
          datos: {
            periodo: "2026-S2",
            estudiantes: 10,
            docentes: 4,
            asignaturas: 7,
          },
        },
      ]);
    });

    it("is a no-op for a second identical call in a render", async () => {
      const double = use();

      await recordReportDashboardRead(30, 5, "all", 1, 1, 1);
      await recordReportDashboardRead(30, 5, "all", 1, 1, 1);

      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      expect(double.transactions).toBe(1);
    });

    it("writes again for another actor or another career", async () => {
      use();

      await recordReportDashboardRead(30, 6, null, 0, 0, 0);
      await recordReportDashboardRead(31, 6, null, 0, 0, 0);
      await recordReportDashboardRead(30, 7, null, 0, 0, 0);

      expect(insertAuditMock).toHaveBeenCalledTimes(3);
    });

    it("rejects when the audit insert fails, so the page returns no data", async () => {
      use();
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(
        recordReportDashboardRead(30, 8, "2026-S1", 1, 1, 1),
      ).rejects.toThrow("audit down");
    });
  });
});

describe("recordReportRequestsRead (CR-DET-4, RNF-06)", () => {
  beforeEach(() => {
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  it("writes one solicitud.reporte.consultado row in one transaction", async () => {
    const double = use();

    await recordReportRequestsRead(30, 4, "2026-S1", 12, "medica", true, 18);

    expect(double.transactions).toBe(1);
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    const [, actor, events] = insertAuditMock.mock.calls[0];
    expect(actor).toBe(30);
    expect(events).toEqual([
      {
        accion: "solicitud.reporte.consultado",
        entidadTipo: "Carrera",
        entidadId: 4,
        datos: {
          periodo: "2026-S1",
          docenteId: 12,
          causa: "medica",
          busqueda: true,
          total: 18,
        },
      },
    ]);
  });

  it("stores a boolean for the search: the typed term never reaches the row", async () => {
    use();

    await recordReportRequestsRead(30, 9, "all", null, null, true, 2);

    const serialized = JSON.stringify(insertAuditMock.mock.calls[0][2]);
    expect(serialized).toContain('"busqueda":true');
    expect(serialized).not.toContain("Maria Lopez");
  });

  it("is a no-op for a second identical call in a render", async () => {
    const double = use();

    await recordReportRequestsRead(30, 5, "all", null, null, false, 3);
    await recordReportRequestsRead(30, 5, "all", null, null, false, 3);

    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    expect(double.transactions).toBe(1);
  });

  it("writes again when the filters or the total differ", async () => {
    use();

    await recordReportRequestsRead(30, 6, "all", null, null, false, 3);
    await recordReportRequestsRead(30, 6, "all", null, "medica", false, 3);
    await recordReportRequestsRead(30, 6, "all", null, null, false, 4);

    expect(insertAuditMock).toHaveBeenCalledTimes(3);
  });

  it("rejects when the audit insert fails, so the page returns no data", async () => {
    use();
    insertAuditMock.mockRejectedValue(new Error("audit down"));

    await expect(
      recordReportRequestsRead(30, 8, "2026-S1", null, null, false, 1),
    ).rejects.toThrow("audit down");
  });
});

// Boundary of slice 1a (design): the data layer is inert and framework-free.
describe("report modules stay framework-free (boundary rule)", () => {
  const root = process.cwd();
  const read = (path: string) => readFileSync(join(root, path), "utf8");
  const sources = [
    ...readdirSync(join(root, "src/lib/reports"))
      .filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))
      .map((name) => `src/lib/reports/${name}`),
    ...readdirSync(join(root, "src/lib/data"))
      .filter(
        (name) => /^report-.*\.ts$/.test(name) && !/\.test\.ts$/.test(name),
      )
      .map((name) => `src/lib/data/${name}`),
  ];
  const importsOf = (text: string) =>
    [...text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);

  it("scans the report modules it is meant to guard", () => {
    expect(sources).toEqual(
      expect.arrayContaining([
        "src/lib/reports/params.ts",
        "src/lib/data/report-reads.ts",
        "src/lib/data/report-rankings.ts",
        "src/lib/data/report-requests.ts",
      ]),
    );
  });

  it("imports neither next/* nor the i18n layer", () => {
    for (const path of sources) {
      for (const specifier of importsOf(read(path))) {
        expect(specifier, path).not.toMatch(/^next(\/|$)/);
        expect(specifier, path).not.toMatch(/i18n/);
      }
    }
  });

  it("imports react only for cache(), and only in report-reads.ts", () => {
    for (const path of sources) {
      const text = read(path);
      const importsReact = importsOf(text).includes("react");
      expect(importsReact, path).toBe(path === "src/lib/data/report-reads.ts");
    }
    expect(read("src/lib/data/report-reads.ts")).toContain(
      'import { cache } from "react";',
    );
  });

  it("never reads a search term (it must not reach an event builder)", () => {
    expect(read("src/lib/data/report-reads.ts")).not.toMatch(
      /parseQ|searchParams|termino/,
    );
  });
});
