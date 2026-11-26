import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The real `requireRole` runs over a doubled session source, so the redirect
// destinations are the production ones (`/login`, `/change-password`,
// `/denied`). Every other root a guard could touch is a tripwire: a denial, and
// the guard itself, must reach none of them (DM-1: no data read, no body read).
const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn(),
  getCatalogActor: vi.fn(),
  dbAccess: vi.fn(),
  getDocenteById: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/auth/cookies", () => ({ getSession: m.getSession }));
vi.mock("@/lib/data/users", () => ({ getCatalogActor: m.getCatalogActor }));
vi.mock("@/lib/data/docentes", () => ({ getDocenteById: m.getDocenteById }));
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: () => m.dbAccess() }),
}));

import { requireDocenteAccess } from "@/lib/auth/docente-access";
import { rolesQueGestionanDocentes } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";
import { rolesUsuario } from "@/lib/validations/auth";

function session(
  rol: SessionPayload["rol"],
  sub = "42",
  flagged = false,
): SessionPayload {
  return {
    sub,
    login: "u",
    rol,
    nombre: "U",
    ...(flagged ? { debeCambiarClave: true as const } : {}),
  };
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

/** The guard under a given session; a redirect surfaces as its path. */
async function run(current: SessionPayload | null) {
  m.getSession.mockResolvedValue(current);
  try {
    return await requireDocenteAccess();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) {
      return error.message.slice("REDIRECT:".length);
    }
    throw error;
  }
}

function expectNoDataRead() {
  expect(m.getCatalogActor).not.toHaveBeenCalled();
  expect(m.getDocenteById).not.toHaveBeenCalled();
  expect(m.dbAccess).not.toHaveBeenCalled();
}

describe("requireDocenteAccess (DM-1, CM-ACC-1: role table)", () => {
  it("admits the secretaria with her session and her numeric id", async () => {
    const s = session("secretaria", "17");

    expect(await run(s)).toEqual({ session: s, actorId: 17 });
    expectNoDataRead();
  });

  it.each(["administrador", "coordinacion", "docente", "estudiante"] as const)(
    "sends %s to /denied",
    async (rol) => {
      expect(await run(session(rol))).toBe("/denied");
      expectNoDataRead();
    },
  );

  it("sends an anonymous caller to /login", async () => {
    expect(await run(null)).toBe("/login");
    expectNoDataRead();
  });

  it("sends a secretaria who must change her password to /change-password, not /denied", async () => {
    expect(await run(session("secretaria", "42", true))).toBe(
      "/change-password",
    );
    expectNoDataRead();
  });

  it("sends a flagged coordinacion to /change-password: the forced change comes before the role", async () => {
    expect(await run(session("coordinacion", "42", true))).toBe(
      "/change-password",
    );
    expectNoDataRead();
  });

  it("covers every role: only the derived list is admitted", async () => {
    for (const rol of rolesUsuario) {
      const outcome = await run(session(rol));
      const admitted = typeof outcome === "object";
      expect(admitted, rol).toBe(rolesQueGestionanDocentes.includes(rol));
    }
  });
});

describe("requireDocenteAccess (DM-1: a denial makes no read)", () => {
  it.each(["/login", "/denied", "/change-password"])(
    "propagates the %s redirect before any other root is touched",
    async (destination) => {
      const redirect = new Error(`NEXT_REDIRECT ${destination}`);
      m.getSession.mockRejectedValue(redirect);

      await expect(requireDocenteAccess()).rejects.toBe(redirect);

      expectNoDataRead();
    },
  );

  it("is a guard with no database read at all: even an admitted caller reads nothing", async () => {
    await run(session("secretaria"));

    expectNoDataRead();
  });

  it("source: requireRole is the first await and nothing is read before it", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/auth/docente-access.ts"),
      "utf8",
    );
    const body = source.slice(source.indexOf("export async function"));

    expect(source).toMatch(/^import "server-only";/);
    expect(body.slice(body.indexOf("await "))).toMatch(
      /^await requireRole\(\.\.\.rolesQueGestionanDocentes\)/,
    );
    expect(source).not.toContain("auth/catalog-access");
    expect(source).not.toMatch(/requireCatalogAccess\(|getCatalogActor/);
  });
});

describe("requireDocenteAccess (the subject is the actor id)", () => {
  it.each(["abc", "", "4.5", "-1", "0", "12x", "1e3", "007", " 7"])(
    "refuses a malformed session subject %j",
    async (sub) => {
      m.getSession.mockResolvedValue(session("secretaria", sub));

      await expect(requireDocenteAccess()).rejects.toThrow(
        "session subject is not a valid user id",
      );
      expectNoDataRead();
    },
  );

  it("refuses a subject beyond the safe integer range", async () => {
    m.getSession.mockResolvedValue(session("secretaria", "9007199254740993"));

    await expect(requireDocenteAccess()).rejects.toThrow(
      "session subject is not a valid user id",
    );
  });

  it("does not look at the subject of a denied caller: the redirect wins", async () => {
    expect(await run(session("coordinacion", "abc"))).toBe("/denied");
  });

  it("admits a secretaria without a facultad: no scope is read, so none can be missing (DM-1)", async () => {
    // The session carries no facultad and the guard reads none.
    const s = session("secretaria", "5");

    expect(await run(s)).toEqual({ session: s, actorId: 5 });
    expect(m.getCatalogActor).not.toHaveBeenCalled();
  });
});
