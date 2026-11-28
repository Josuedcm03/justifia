import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The real `requireRole` runs over a doubled session source, so the redirect
// destinations are the production ones (`/login`, `/change-password`,
// `/denied`). Every other root a guard could touch is a tripwire: a denial, and
// the guard itself, must reach none of them (NP-6: no parameter read, no body
// read, no database read at all).
const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn(),
  getCatalogActor: vi.fn(),
  dbAccess: vi.fn(),
  loadParameters: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/auth/cookies", () => ({ getSession: m.getSession }));
vi.mock("@/lib/data/users", () => ({ getCatalogActor: m.getCatalogActor }));
vi.mock("@/lib/parameters/loader", () => ({
  loadNormativeParameters: m.loadParameters,
  getNormativeParameters: m.loadParameters,
}));
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: () => m.dbAccess() }),
}));

import { rolesQueGestionanParametros } from "@/lib/auth/permissions";
import { requireParameterAccess } from "@/lib/auth/parameter-access";
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
    return await requireParameterAccess();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) {
      return error.message.slice("REDIRECT:".length);
    }
    throw error;
  }
}

function expectNoDataRead() {
  expect(m.getCatalogActor).not.toHaveBeenCalled();
  expect(m.loadParameters).not.toHaveBeenCalled();
  expect(m.dbAccess).not.toHaveBeenCalled();
}

describe("requireParameterAccess (NP-6: role table)", () => {
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

  it("covers every role: only the derived list is admitted", async () => {
    for (const rol of rolesUsuario) {
      const outcome = await run(session(rol));
      const admitted = typeof outcome === "object";
      expect(admitted, rol).toBe(
        (rolesQueGestionanParametros as readonly string[]).includes(rol),
      );
    }
  });
});

describe("requireParameterAccess (NP-6: a denial makes no read)", () => {
  it.each(["/login", "/denied", "/change-password"])(
    "propagates the %s redirect before any other root is touched",
    async (destination) => {
      const redirect = new Error(`NEXT_REDIRECT ${destination}`);
      m.getSession.mockRejectedValue(redirect);

      await expect(requireParameterAccess()).rejects.toBe(redirect);

      expectNoDataRead();
    },
  );

  it("is a guard with no database read at all: a secretaria with no Facultad passes and nothing is read", async () => {
    // The session carries no Facultad and the guard reads none: parameters have
    // no facultad scope, so any secretaria is admitted.
    expect(await run(session("secretaria"))).toMatchObject({ actorId: 42 });

    expectNoDataRead();
  });

  it.each(["abc", "0", "-3", "1.5", "007", "", "9".repeat(20)])(
    "throws for a malformed session subject %j",
    async (sub) => {
      m.getSession.mockResolvedValue(session("secretaria", sub));

      await expect(requireParameterAccess()).rejects.toThrow(
        /session subject is not a valid user id/,
      );
      expectNoDataRead();
    },
  );

  it("source: requireRole is the first await and nothing is read before it", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/auth/parameter-access.ts"),
      "utf8",
    );
    const body = source.slice(source.indexOf("export async function"));

    expect(source).toMatch(/^import "server-only";/);
    expect(body.slice(body.indexOf("await "))).toMatch(
      /^await requireRole\(\.\.\.rolesQueGestionanParametros\)/,
    );
    expect(source).not.toContain("auth/catalog-access");
    expect(source).not.toMatch(/requireCatalogAccess\(|getCatalogActor/);
    expect(source).not.toMatch(/"secretaria"/);
  });
});
