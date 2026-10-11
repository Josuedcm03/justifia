import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

// The retired edit URL of a Grupo (CM-RTE-1, UG-4): the one redirect that reads
// data. The guard is the real `requireCatalogAccess`; only its sources (the
// session and the actor's Carrera) and the one scoped read are doubles.
const {
  redirectMock,
  notFoundMock,
  getSessionMock,
  getCatalogActorMock,
  getByIdMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  getSessionMock: vi.fn(),
  getCatalogActorMock: vi.fn(),
  getByIdMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/users", () => ({ getCatalogActor: getCatalogActorMock }));
vi.mock("@/lib/data/grupos", () => ({ getGrupoById: getByIdMock }));

const ASIGNATURAS_LIST = "/catalog/asignaturas";

function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

/** A scoped read result: only `asignaturaId` matters to the redirect. */
function record(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    asignaturaId: 345,
    asignaturaCodigo: "MAT101",
    asignaturaNombre: "Algebra",
    periodo: "2026-S1",
    numeroGrupo: "A",
    docenteId: 7,
    docenteNombre: "Ana Ruiz",
    activo: true,
    origen: "manual",
    dias: ["lunes"],
    ...overrides,
  };
}

let Page: (props: { params: Promise<{ id: string }> }) => Promise<unknown>;

function run(id = "12") {
  return Page({ params: Promise.resolve({ id }) });
}

/** What the page ends with: the thrown redirect or not-found marker. */
async function outcome(id?: string) {
  return run(id).then(
    () => "returned",
    (error: Error) => error.message,
  );
}

const PAGE_SOURCE = join(
  process.cwd(),
  "src/app/(dashboard)/catalog/grupos/[id]/edit/page.tsx",
);

beforeAll(async () => {
  Page = (await import("@/app/(dashboard)/catalog/grupos/[id]/edit/page"))
    .default;
}, 60_000);

beforeEach(() => {
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("administrador"));
  getCatalogActorMock.mockReset();
  getCatalogActorMock.mockResolvedValue({ carreraId: null });
  getByIdMock.mockReset();
  getByIdMock.mockResolvedValue(record());
});

describe("retired Grupo edit URL redirects to the owner Asignatura (CM-RTE-1 'Edit URL of an in-scope Grupo')", () => {
  it.each([
    ["active", true],
    ["inactive", false],
  ])(
    "redirects an in-scope %s group to the URL built from its own Asignatura",
    async (_label, activo) => {
      getByIdMock.mockResolvedValue(record({ activo }));

      await expect(run("12")).rejects.toThrow(
        "REDIRECT:/catalog/asignaturas/345/grupos/12/edit",
      );

      expect(redirectMock).toHaveBeenCalledExactlyOnceWith(
        "/catalog/asignaturas/345/grupos/12/edit",
      );
      expect(notFoundMock).not.toHaveBeenCalled();
    },
  );

  // Triangulation: the target follows the record, not a constant, and the
  // group id comes from the parsed address.
  it("builds the target from the record's Asignatura and the parsed group id", async () => {
    getByIdMock.mockResolvedValue(record({ id: 9, asignaturaId: 2 }));

    await expect(run("9")).rejects.toThrow(
      "REDIRECT:/catalog/asignaturas/2/grupos/9/edit",
    );
  });

  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "redirects for %s, reading the group with the guard's scope and the parsed id",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({
        carreraId: rol === "coordinacion" ? 3 : null,
      });

      await run("12").catch(() => undefined);

      expect(getByIdMock).toHaveBeenCalledExactlyOnceWith(
        rol === "coordinacion"
          ? { kind: "carrera", carreraId: 3 }
          : { kind: "all" },
        12,
      );
      expect(redirectMock).toHaveBeenCalledExactlyOnceWith(
        "/catalog/asignaturas/345/grupos/12/edit",
      );
    },
  );
});

describe("retired Grupo edit URL cannot probe groups (CM-RTE-1 'cannot probe', 'malformed id'; CM-SCOPE-1)", () => {
  it("answers one and the same not-found for an unknown group and a group of another Carrera, with no redirect", async () => {
    getByIdMock.mockResolvedValue(null);
    const unknown = await outcome("99");

    // A coordinacion of Carrera 3 asking for a group of Carrera 4: the scoped
    // read answers null exactly as for an id that does not exist.
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });
    const foreign = await outcome("41");

    expect(unknown).toBe("NEXT_NOT_FOUND");
    expect(foreign).toBe(unknown);
    expect(notFoundMock).toHaveBeenCalledTimes(2);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(getByIdMock).toHaveBeenLastCalledWith(
      { kind: "carrera", carreraId: 3 },
      41,
    );
  });

  it.each(["abc", "0", "01", "", "12abc", " 12", "-3", "1.5"])(
    "answers the same not-found for the malformed id %j and reads nothing",
    async (id) => {
      const result = await outcome(id);

      expect(result).toBe("NEXT_NOT_FOUND");
      expect(notFoundMock).toHaveBeenCalledTimes(1);
      expect(redirectMock).not.toHaveBeenCalled();
      expect(getByIdMock).not.toHaveBeenCalled();
    },
  );

  it("lets a failing read propagate: no try, no fallback, no redirect", async () => {
    getByIdMock.mockRejectedValue(new Error("db down"));

    await expect(run()).rejects.toThrow("db down");
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("retired Grupo edit URL access (CM-RTE-1 denied callers; CM-SCOPE-2; the guard is the first await)", () => {
  it("sends a coordinacion with no Carrera to the Asignaturas list without any read", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });

    await expect(run("12")).rejects.toThrow(`REDIRECT:${ASIGNATURAS_LIST}`);

    expect(redirectMock).toHaveBeenCalledExactlyOnceWith(ASIGNATURAS_LIST);
    expect(getByIdMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("does not even parse the id of a coordinacion with no Carrera (a malformed one is not a 404 there)", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });

    await expect(run("abc")).rejects.toThrow(`REDIRECT:${ASIGNATURAS_LIST}`);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it.each(rolesUsuario.filter((r) => r === "docente" || r === "estudiante"))(
    "sends %s to /denied without awaiting params or reading anything",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      const then = vi.fn();
      const params = { then } as unknown as Promise<{ id: string }>;

      await expect(Page({ params })).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(then).not.toHaveBeenCalled();
      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(getByIdMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(run()).rejects.toThrow("REDIRECT:/login");

    expect(getCatalogActorMock).not.toHaveBeenCalled();
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it.each(["secretaria", "docente"] as const)(
    "sends a flagged %s to the password change before anything else",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol, true));

      await expect(run()).rejects.toThrow(`REDIRECT:${PASSWORD_CHANGE_PATH}`);

      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(getByIdMock).not.toHaveBeenCalled();
    },
  );
});

describe("retired Grupo edit URL source (U4, UG-4; STRUCT)", () => {
  // The working tree is CRLF on Windows; the pins read LF.
  const source = () => readFileSync(PAGE_SOURCE, "utf8").replace(/\r\n/g, "\n");

  /** The page without comments, so a comment cannot satisfy or break a pin. */
  const code = () =>
    source()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  it("calls redirect() and notFound() outside any try block", () => {
    const text = code();

    expect(text).toContain("redirect(");
    expect(text).toContain("notFound(");
    expect(text).not.toMatch(/\btry\s*\{/);
    expect(text).not.toMatch(/\bcatch\b/);
  });

  it("never redirects permanently", () => {
    expect(source()).not.toContain("permanentRedirect");
  });

  it("makes the guard its first await, ahead of params and the read", () => {
    const text = source();
    const first = text.indexOf("await ");

    expect(first).toBeGreaterThanOrEqual(0);
    expect(text.slice(first)).toMatch(/^await requireCatalogAccess\(/);
    expect(first).toBeLessThan(text.indexOf("await params"));
    expect(first).toBeLessThan(text.indexOf("getGrupoById("));
  });

  it("holds no copy and renders nothing of its own", () => {
    const text = code();

    expect(text).not.toMatch(/getTranslations|useTranslations/);
    expect(text).not.toMatch(/<[A-Za-z/]/);
  });

  it("builds the target only from the scoped record and the parsed id", () => {
    const text = code();

    expect(text).toMatch(
      /redirect\(\s*`\/catalog\/asignaturas\/\$\{record\.asignaturaId\}\/grupos\/\$\{id\}\/edit`/,
    );
    expect(text).not.toMatch(/searchParams|headers\(|cookies\(/);
  });
});
