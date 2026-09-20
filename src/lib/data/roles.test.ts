import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { dbMock } = vi.hoisted(() => ({
  dbMock: { select: vi.fn() },
}));

vi.mock("@/db", () => ({ db: dbMock }));

import { getRolIdByCodigo, RolDesconocidoError } from "@/lib/data/roles";

function mockRows(rows: { id: number }[]) {
  dbMock.select.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  });
}

describe("getRolIdByCodigo (UR: Login resolves the code)", () => {
  it("returns the id for a known code", async () => {
    mockRows([{ id: 3 }]);
    await expect(getRolIdByCodigo("docente")).resolves.toBe(3);
  });

  it("throws RolDesconocidoError for an unknown code", async () => {
    mockRows([]);
    await expect(getRolIdByCodigo("noexiste" as never)).rejects.toBeInstanceOf(
      RolDesconocidoError,
    );
  });
});
