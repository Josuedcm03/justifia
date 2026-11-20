import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireRole = vi.fn();
const resolveRequestScope = vi.fn();

vi.mock("@/lib/auth/dal", () => ({
  requireRole: (...roles: unknown[]) => requireRole(...roles),
}));
vi.mock("@/lib/data/request-scope", () => ({
  resolveRequestScope: (id: unknown, rol: unknown) =>
    resolveRequestScope(id, rol),
}));

import { requireEnrollmentAccess } from "@/lib/auth/enrollment-access";
import { rolesQueGestionanInscripciones } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";

function session(rol: SessionPayload["rol"], sub = "42"): SessionPayload {
  return { sub, login: "u", rol, nombre: "U" };
}

beforeEach(() => {
  requireRole.mockReset();
  resolveRequestScope.mockReset();
});

describe("requireEnrollmentAccess (EA-ACC-1, EA-SCOPE-1, RNF-01)", () => {
  it("calls requireRole with the enrollment-managing roles first", async () => {
    requireRole.mockResolvedValue(session("secretaria"));
    resolveRequestScope.mockResolvedValue({ kind: "none" });
    await requireEnrollmentAccess();
    expect(requireRole).toHaveBeenCalledTimes(1);
    expect(requireRole).toHaveBeenCalledWith(...rolesQueGestionanInscripciones);
  });

  it.each([
    ["estudiante", "/denied"],
    ["docente", "/denied"],
    ["coordinacion", "/denied"],
    ["administrador", "/denied"],
    ["anonymous", "/login"],
    ["secretaria with a pending password change", "/change-password"],
  ])(
    "%s: the %s redirect propagates and the scope is never read",
    async (_identity, destination) => {
      const redirect = new Error(`NEXT_REDIRECT ${destination}`);
      requireRole.mockRejectedValue(redirect);
      await expect(requireEnrollmentAccess()).rejects.toBe(redirect);
      expect(resolveRequestScope).not.toHaveBeenCalled();
    },
  );

  it("returns the facultad scope of a secretaria with a facultad", async () => {
    const s = session("secretaria", "9");
    requireRole.mockResolvedValue(s);
    resolveRequestScope.mockResolvedValue({ kind: "facultad", facultadId: 4 });
    expect(await requireEnrollmentAccess()).toEqual({
      session: s,
      actorId: 9,
      scope: { kind: "facultad", facultadId: 4 },
    });
    expect(resolveRequestScope).toHaveBeenCalledWith(9, "secretaria");
  });

  it("returns scope none for a secretaria without a facultad", async () => {
    requireRole.mockResolvedValue(session("secretaria"));
    resolveRequestScope.mockResolvedValue({ kind: "none" });
    expect((await requireEnrollmentAccess()).scope).toEqual({ kind: "none" });
  });

  it("does not cache: the facultad is read from the database on every call", async () => {
    requireRole.mockResolvedValue(session("secretaria"));
    resolveRequestScope
      .mockResolvedValueOnce({ kind: "facultad", facultadId: 1 })
      .mockResolvedValueOnce({ kind: "facultad", facultadId: 2 });
    expect((await requireEnrollmentAccess()).scope).toEqual({
      kind: "facultad",
      facultadId: 1,
    });
    expect((await requireEnrollmentAccess()).scope).toEqual({
      kind: "facultad",
      facultadId: 2,
    });
    expect(resolveRequestScope).toHaveBeenCalledTimes(2);
  });

  it("fails loud when the scope read throws", async () => {
    requireRole.mockResolvedValue(session("secretaria"));
    const boom = new Error("db down");
    resolveRequestScope.mockRejectedValue(boom);
    await expect(requireEnrollmentAccess()).rejects.toBe(boom);
  });

  it.each(["abc", "", "4.5", "-1", "0", "12x", "1e3"])(
    "refuses a non-integer session subject %j",
    async (sub) => {
      requireRole.mockResolvedValue(session("secretaria", sub));
      await expect(requireEnrollmentAccess()).rejects.toThrow();
      expect(resolveRequestScope).not.toHaveBeenCalled();
    },
  );
});
