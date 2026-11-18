import { isDeepStrictEqual } from "node:util";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as schema from "@/db/schema";
import {
  IDENTITIES,
  denialsOf,
  outcomeFor,
  type Identity,
  type Outcome,
  type Row,
} from "@/test/access/matrix-table";
import type { RolUsuario } from "@/lib/validations/auth";

// Runs every protected entry point as every identity through the REAL guard
// (`dal.ts`, `catalog-access.ts`). The session source is the only live input;
// the I/O roots past the guard are tripwires (design D3). Applied before any
// entry is imported, with `vi.doMock` (D7).

type Mod = Record<string, (...args: unknown[]) => unknown>;
type Unit = { key: string; name?: string; row: Row };

const tripped: string[] = [];
const getSession = vi.fn();

function trip(name: string): never {
  tripped.push(name);
  throw new Error(`PAST_GUARD:${name}`);
}

export function installAccessMocks(): void {
  const fail = (name: string) => () => trip(name);
  vi.doMock("server-only", () => ({}));
  vi.doMock("@/env", () => ({
    env: {
      DATABASE_URL: "postgres://u:p@127.0.0.1:9/x",
      AUTH_SECRET: "a".repeat(32),
      NODE_ENV: "test",
      CRON_SECRET: "c".repeat(32),
    },
  }));
  vi.doMock("next/navigation", async (original) => ({
    ...(await original<object>()),
    redirect: (path: string) => {
      throw new Error(`REDIRECT:${path}`);
    },
    notFound: () => {
      throw new Error("NOT_FOUND");
    },
  }));
  vi.doMock("@/lib/auth/cookies", () => ({
    getSession,
    setSessionCookie: fail("cookies"),
    clearSessionCookie: fail("cookies"),
  }));
  vi.doMock("@/db", () => ({
    db: new Proxy({}, { get: () => trip("db") }),
    schema,
  }));
  vi.doMock("next-intl/server", () => ({ getTranslations: fail("intl") }));
  vi.doMock("@/lib/intake/deps", () => ({ getIntakeDeps: fail("deps") }));
  vi.doMock("@vercel/blob/client", () => ({
    upload: fail("blob"),
    handleUpload: fail("blob"),
  }));
}

const session = (rol: RolUsuario, debeCambiarClave?: true) => ({
  sub: "7",
  login: "caller",
  rol,
  nombre: "Caller",
  ...(debeCambiarClave ? { debeCambiarClave } : {}),
});

/** Flagged takes the first allowed role, so the flag alone explains a denial. */
function useIdentity(identity: Identity, row: Row): void {
  if (identity === "anonymous") return void getSession.mockResolvedValue(null);
  if (identity !== "flagged") {
    return void getSession.mockResolvedValue(session(identity));
  }
  const rol = row.allowed.find((i) => i !== "flagged") ?? "administrador";
  getSession.mockResolvedValue(session(rol as RolUsuario, true));
}

/** What an invocation did: a redirect, an error response, a throw, or a return. */
async function observe(run: () => unknown): Promise<unknown> {
  try {
    const out = await run();
    if (!(out instanceof Response)) return { returned: true };
    const body = await out
      .clone()
      .json()
      .catch(() => ({}));
    return { status: out.status, error: body?.error ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.startsWith("REDIRECT:")
      ? { redirect: message.slice("REDIRECT:".length) }
      : { threw: message };
  }
}

const GUARD_DENIALS: Outcome[] = [
  { redirect: "/login" },
  { redirect: "/change-password" },
  { redirect: "/denied" },
];

const isDenial = (seen: unknown, row: Row) =>
  [...GUARD_DENIALS, ...Object.values(row.denial ?? {})].some((outcome) =>
    isDeepStrictEqual(outcome, seen),
  );

export function defineMatrix(options: {
  kind: string;
  units: Unit[];
  load: (key: string) => Promise<unknown> | undefined;
  call: (mod: Mod, unit: Unit) => unknown;
  /** Extra checks over the loaded modules (the actions export list). */
  inspect?: (mods: Map<string, Mod>) => void;
}): void {
  const { kind, units, load, call, inspect } = options;
  const cases = units.length * IDENTITIES.length;
  const denials = units.reduce((sum, { row }) => sum + denialsOf(row), 0);
  const tally = { denied: 0, admitted: 0 };
  const mods = new Map<string, Mod>();
  const title = `${units.length} ${kind} x ${IDENTITIES.length} identities = ${cases} cases, ${denials} denials`;

  describe(title, () => {
    beforeAll(async () => {
      installAccessMocks();
      for (const { key } of units) {
        const loader = load(key);
        expect(loader, `no module loader for ${key}`).toBeDefined();
        if (!mods.has(key)) mods.set(key, (await loader) as Mod);
      }
    }, 120_000);
    beforeEach(() => {
      tripped.length = 0;
      getSession.mockReset();
    });
    afterAll(() => {
      console.info(
        `access matrix ${kind}: ${units.length} entry points x ${IDENTITIES.length} identities = ${cases} cases, ${tally.denied} denied, ${tally.admitted} admitted`,
      );
      expect(tally).toEqual({ denied: denials, admitted: cases - denials });
    });

    if (inspect) it("lists exactly the expected exports", () => inspect(mods));

    for (const unit of units) {
      const label = unit.name ? `${unit.key} ${unit.name}` : unit.key;
      describe(label, () => {
        it.each(IDENTITIES)("as %s", async (identity) => {
          useIdentity(identity, unit.row);
          const seen = await observe(() => call(mods.get(unit.key)!, unit));
          const want = outcomeFor(unit.row, identity);

          if (want) {
            expect(seen, `${label} as ${identity} must be denied`).toEqual(
              want,
            );
            expect(tripped, `${label} as ${identity} reached`).toEqual([]);
            tally.denied++;
          } else {
            expect(
              isDenial(seen, unit.row),
              `${label} as ${identity} must be admitted, got ${JSON.stringify(seen)}`,
            ).toBe(false);
            tally.admitted++;
          }
        });
      });
    }
  });
}
