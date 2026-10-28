// @vitest-environment node
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

import { recordQueueRead, recordRequestRead } from "@/lib/data/request-reads";

// Captured at load: the setup file clears mock history between tests.
const cacheCallsAtLoad = [...cacheMock.mock.calls];

function use(script: Step[] = []) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

describe("request reads (SR-11, RNF-06)", () => {
  beforeEach(() => {
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  it("wraps both writers in React cache() once, at module load", () => {
    expect(cacheCallsAtLoad).toHaveLength(2);
    for (const call of cacheCallsAtLoad) {
      expect(call[0]).toBeTypeOf("function");
    }
  });

  describe("recordRequestRead", () => {
    it("writes one solicitud.consultada row in one transaction", async () => {
      const double = use();

      await recordRequestRead(20, 1001, "pendiente");

      expect(double.transactions).toBe(1);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      const [, actor, events] = insertAuditMock.mock.calls[0];
      expect(actor).toBe(20);
      expect(events).toEqual([
        {
          accion: "solicitud.consultada",
          entidadTipo: "Solicitud",
          entidadId: 1001,
          datos: { estado: "pendiente" },
        },
      ]);
    });

    it("is a no-op for a second call of the same actor and request in a render", async () => {
      const double = use();

      await recordRequestRead(20, 1002, "devuelta");
      await recordRequestRead(20, 1002, "devuelta");

      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      expect(double.transactions).toBe(1);
    });

    it("writes again for another request or another actor", async () => {
      use();

      await recordRequestRead(20, 1003, "pendiente");
      await recordRequestRead(20, 1004, "pendiente");
      await recordRequestRead(21, 1003, "pendiente");

      expect(insertAuditMock).toHaveBeenCalledTimes(3);
    });

    it("rejects when the audit insert fails, so the page shows no data", async () => {
      use();
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(recordRequestRead(20, 1005, "pendiente")).rejects.toThrow(
        "audit down",
      );
    });

    it("carries no student data, text or dates in the payload", async () => {
      use();

      await recordRequestRead(20, 1006, "aprobada");

      expect(Object.keys(insertAuditMock.mock.calls[0][2][0].datos)).toEqual([
        "estado",
      ]);
    });
  });

  describe("recordQueueRead", () => {
    it("writes one solicitud.cola.consultada row on the facultad, count and tab code only", async () => {
      const double = use();

      await recordQueueRead(20, 3, 3, "pendiente");

      expect(double.transactions).toBe(1);
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "solicitud.cola.consultada",
          entidadTipo: "Facultad",
          entidadId: 3,
          datos: { total: 3, estado: "pendiente" },
        },
      ]);
    });

    it("carries the tab that was opened", async () => {
      use();

      await recordQueueRead(20, 3, 2, "en_revision_coordinacion");
      await recordQueueRead(20, 3, 2, "aprobada");

      expect(
        insertAuditMock.mock.calls.map((call) => call[2][0].datos.estado),
      ).toEqual(["en_revision_coordinacion", "aprobada"]);
    });

    it("never carries the list of request ids", async () => {
      use();

      await recordQueueRead(20, 4, 12, "pendiente");

      const [event] = insertAuditMock.mock.calls.at(-1)?.[2] ?? [];
      expect(Object.keys(event.datos)).toEqual(["total", "estado"]);
    });

    it("is a no-op for a second identical call in a render", async () => {
      use();

      await recordQueueRead(20, 5, 7, "pendiente");
      await recordQueueRead(20, 5, 7, "pendiente");

      expect(
        insertAuditMock.mock.calls.filter((c) => c[2][0].entidadId === 5),
      ).toHaveLength(1);
    });

    it("rejects when the audit insert fails", async () => {
      use();
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(recordQueueRead(20, 6, 1, "pendiente")).rejects.toThrow(
        "audit down",
      );
    });
  });
});
