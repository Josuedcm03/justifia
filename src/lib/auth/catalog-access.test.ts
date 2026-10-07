import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireRole = vi.fn();
const getCatalogActor = vi.fn();

vi.mock("@/lib/auth/dal", () => ({
  requireRole: (...roles: unknown[]) => requireRole(...roles),
}));
vi.mock("@/lib/data/users", () => ({
  getCatalogActor: (id: unknown) => getCatalogActor(id),
}));

import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import { rolesQueGestionanCatalogo } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";

function session(rol: SessionPayload["rol"], sub = "42"): SessionPayload {
  return { sub, login: "u", rol, nombre: "U" };
}

beforeEach(() => {
  requireRole.mockReset();
  getCatalogActor.mockReset();
});

describe("requireCatalogAccess (CM-ACC-1, CM-SCOPE-1, CM-SCOPE-2)", () => {
  it("calls requireRole with the derived catalog roles first", async () => {
    requireRole.mockResolvedValue(session("administrador"));
    getCatalogActor.mockResolvedValue({ carreraId: null });
    await requireCatalogAccess();
    expect(requireRole).toHaveBeenCalledTimes(1);
    expect(requireRole).toHaveBeenCalledWith(...rolesQueGestionanCatalogo);
  });

  it.each(["/login", "/denied", "/change-password"])(
    "propagates the %s redirect and never reads the actor",
    async (destination) => {
      const redirect = new Error(`NEXT_REDIRECT ${destination}`);
      requireRole.mockRejectedValue(redirect);
      await expect(requireCatalogAccess()).rejects.toBe(redirect);
      expect(getCatalogActor).not.toHaveBeenCalled();
    },
  );

  it("returns scope all for administrador", async () => {
    const s = session("administrador", "5");
    requireRole.mockResolvedValue(s);
    getCatalogActor.mockResolvedValue({ carreraId: null });
    expect(await requireCatalogAccess()).toEqual({
      session: s,
      actorId: 5,
      scope: { kind: "all" },
    });
    expect(getCatalogActor).toHaveBeenCalledWith(5);
  });

  it("returns the own carrera for coordinacion", async () => {
    const s = session("coordinacion", "9");
    requireRole.mockResolvedValue(s);
    getCatalogActor.mockResolvedValue({ carreraId: 3 });
    expect(await requireCatalogAccess()).toEqual({
      session: s,
      actorId: 9,
      scope: { kind: "carrera", carreraId: 3 },
    });
  });

  it("returns none for coordinacion without a carrera", async () => {
    requireRole.mockResolvedValue(session("coordinacion"));
    getCatalogActor.mockResolvedValue({ carreraId: null });
    expect((await requireCatalogAccess()).scope).toEqual({ kind: "none" });
  });

  it("returns none for coordinacion whose row vanished", async () => {
    requireRole.mockResolvedValue(session("coordinacion"));
    getCatalogActor.mockResolvedValue(null);
    expect((await requireCatalogAccess()).scope).toEqual({ kind: "none" });
  });

  it("does not cache: the scope follows the stored carrera on every call", async () => {
    requireRole.mockResolvedValue(session("coordinacion"));
    getCatalogActor
      .mockResolvedValueOnce({ carreraId: 1 })
      .mockResolvedValueOnce({ carreraId: 2 });
    expect((await requireCatalogAccess()).scope).toEqual({
      kind: "carrera",
      carreraId: 1,
    });
    expect((await requireCatalogAccess()).scope).toEqual({
      kind: "carrera",
      carreraId: 2,
    });
    expect(getCatalogActor).toHaveBeenCalledTimes(2);
  });

  it("fails loud when the actor read throws", async () => {
    requireRole.mockResolvedValue(session("coordinacion"));
    const boom = new Error("db down");
    getCatalogActor.mockRejectedValue(boom);
    await expect(requireCatalogAccess()).rejects.toBe(boom);
  });

  it.each(["abc", "", "4.5", "-1", "0", "12x", "1e3"])(
    "refuses a non-integer session subject %j",
    async (sub) => {
      requireRole.mockResolvedValue(session("administrador", sub));
      await expect(requireCatalogAccess()).rejects.toThrow();
      expect(getCatalogActor).not.toHaveBeenCalled();
    },
  );
});
