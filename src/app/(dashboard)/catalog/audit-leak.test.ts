// @vitest-environment node
//
// Characterization pin (task 12.9): no value ever reaches an audit payload or a
// log line. Drives all eight catalog actions (three Asignatura, three Grupo and
// the two import actions) with fixtures that carry sentinel strings, then
// serialises every audit event handed to `insertAuditEvents` and every console
// line and asserts none contains a sentinel. Real: the action modules,
// `withCatalogWrite`, the audit event mappers, the import planner and
// `applyImport`. Doubles: the guards, the data layer and the database handle.
// Specs: AL-PAY, CM-AUD-1.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUDITABLE_ASIGNATURA_FIELDS,
  AUDITABLE_GRUPO_FIELDS,
  type AuditEvent,
} from "@/lib/audit/types";
import {
  CARRERA,
  makeSnapshot,
  makeWorkbook,
} from "@/lib/import/__fixtures__/plan-fixtures";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  guard: vi.fn(),
  requireRole: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
  parseWorkbook: vi.fn(),
  loadSnapshot: vi.fn(),
  createUsuariosBulk: vi.fn(),
  hashPassword: vi.fn(),
  generatePassword: vi.fn(),
  createAsignatura: vi.fn(),
  updateAsignatura: vi.fn(),
  setAsignaturaActivo: vi.fn(),
  getAsignatura: vi.fn(),
  createGrupo: vi.fn(),
  updateGrupo: vi.fn(),
  setGrupoActivo: vi.fn(),
  getGrupo: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: object) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: m.audit }));
vi.mock("@/lib/data/catalog", () => ({ loadCatalogSnapshot: m.loadSnapshot }));
vi.mock("@/lib/data/users", () => ({
  createUsuariosBulk: m.createUsuariosBulk,
}));
vi.mock("@/lib/auth/catalog-access", () => ({
  requireCatalogAccess: m.guard,
}));
vi.mock("@/lib/auth/dal", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: m.hashPassword }));
vi.mock("@/lib/import/temp-password", () => ({
  generateTemporaryPassword: m.generatePassword,
}));
vi.mock("@/lib/import/parse", () => ({ parseWorkbook: m.parseWorkbook }));
vi.mock("@/lib/data/asignaturas", () => ({
  createAsignatura: m.createAsignatura,
  updateAsignatura: m.updateAsignatura,
  setAsignaturaActivo: m.setAsignaturaActivo,
  getAsignaturaById: m.getAsignatura,
}));
vi.mock("@/lib/data/grupos", () => ({
  createGrupo: m.createGrupo,
  updateGrupo: m.updateGrupo,
  setGrupoActivo: m.setGrupoActivo,
  getGrupoById: m.getGrupo,
}));

import {
  createAsignaturaAction,
  setAsignaturaActivoAction,
  updateAsignaturaAction,
} from "@/app/(dashboard)/catalog/asignaturas/actions";
import {
  createGrupoAction,
  setGrupoActivoAction,
  updateGrupoAction,
} from "@/app/(dashboard)/catalog/grupos/actions";
import {
  applyAction,
  previewAction,
} from "@/app/(dashboard)/catalog/import/actions";

// Sentinels: a value of any of these anywhere in an audit payload or a log line
// is a leak. The day mask 85 (Mon + Wed + Fri + Sun) is checked structurally
// below, because a bare number could collide with an id.
const NOMBRE = "ZZ-NOMBRE";
const CODIGO = "ZZ-CODIGO";
const NUMERO = "ZZ-NUM";
const DOCENTE = "ZZ-DOCENTE NOMBRE";
const CORREO = "zz.docente@zz-correo.edu";
const HASH = "$2a$12$ZZhashZZhashZZhashZZhashZZhashZZhashZZhashZZha";
const CLAVE = "ZZ-TEMP-PASSWORD-7Q";
const SENTINELS = [
  NOMBRE,
  CODIGO,
  NUMERO,
  DOCENTE,
  CORREO,
  HASH,
  "$2a$",
  CLAVE,
  "miercoles",
  "Miércoles",
  "Mié",
  "Lunes",
  "lunes",
];

// Extras a data-layer result may carry. The mappers must pick only the closed
// fields, so a spread of the result into a payload would leak every one.
const LEAK = {
  codigo: CODIGO,
  nombre: NOMBRE,
  numeroGrupo: NUMERO,
  docenteNombre: DOCENTE,
  correo: CORREO,
  dias: 85,
  diasCount: 4,
};

const ACTOR = 41;
const SHA = "b".repeat(64);
const IDLE = { kind: "idle" } as const;
const tx = {
  execute: vi.fn(async () => undefined),
  insert() {
    return {
      values(input: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = Array.isArray(input) ? input : [input];
        return Object.assign(Promise.resolve(), {
          returning: async (cols: Record<string, unknown>) =>
            rows.map((row, i) => ({
              id: 900 + i,
              ...Object.fromEntries(
                Object.keys(cols)
                  .filter((key) => key !== "id")
                  .map((key) => [key, row[key]]),
              ),
            })),
        });
      },
    };
  },
  update: () => ({ set: () => ({ where: async () => undefined }) }),
  select: () => {
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve([{ id: 9 }]).then(res, rej),
    };
    return chain;
  },
};

const CONSOLE = ["log", "info", "warn", "error", "debug"] as const;
const consoleSpies = {} as Record<
  (typeof CONSOLE)[number],
  ReturnType<typeof vi.spyOn>
>;

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  m.transaction.mockImplementation(async (work: (t: typeof tx) => unknown) =>
    work(tx),
  );
  m.guard.mockResolvedValue({
    session: {},
    actorId: ACTOR,
    scope: { kind: "all" },
  });
  m.requireRole.mockResolvedValue({
    sub: "7",
    login: "caller",
    rol: "secretaria",
  });
  m.getAsignatura.mockResolvedValue({ id: 12, activo: true, ...LEAK });
  m.getGrupo.mockResolvedValue({
    id: 5,
    asignaturaId: 12,
    asignaturaCodigo: CODIGO,
    asignaturaNombre: NOMBRE,
    docenteId: 30,
    docenteNombre: DOCENTE,
    activo: true,
    dias: [],
  });
  m.hashPassword.mockResolvedValue(HASH);
  m.generatePassword.mockReturnValue(CLAVE);
  m.createUsuariosBulk.mockImplementation(async (_tx, rows: unknown[]) =>
    rows.map((_row, i) => 700 + i),
  );
  m.loadSnapshot.mockResolvedValue(makeSnapshot());
  m.parseWorkbook.mockResolvedValue({
    ok: true,
    workbook: makeWorkbook({
      fileSha256: SHA,
      asignaturas: [
        {
          Codigo: CODIGO,
          Nombre: NOMBRE,
          Carrera: CARRERA.nombre,
          HorasTotales: "60",
        },
      ],
      docentes: [{ Correo: CORREO, Nombre: DOCENTE }],
      grupos: [
        {
          CodigoAsignatura: CODIGO,
          Periodo: "2026-S1",
          NumGrupo: NUMERO,
          CorreoDocente: CORREO,
          Dias: "Lunes, Miércoles",
        },
      ],
    }),
  });
  for (const method of CONSOLE) {
    consoleSpies[method] = vi
      .spyOn(console, method)
      .mockImplementation(() => {});
  }
});

afterEach(() => {
  for (const method of CONSOLE) consoleSpies[method].mockRestore();
});

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

function workbookForm(): FormData {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
  const fd = new FormData();
  fd.set("file", new File([bytes], "catalogo.xlsx"));
  fd.set("fileSha256", SHA);
  return fd;
}

/** Runs an action, treating the `redirect` throw as a normal completion. */
async function settle(run: () => Promise<unknown>): Promise<unknown> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) {
      return { redirected: error.message };
    }
    throw error;
  }
}

const events = () =>
  m.audit.mock.calls.flatMap((call) => call[2] as AuditEvent[]);
const logs = () =>
  JSON.stringify(CONSOLE.flatMap((method) => consoleSpies[method].mock.calls));

function expectNoSentinel(serialised: string) {
  for (const sentinel of SENTINELS) {
    expect(serialised, sentinel).not.toContain(sentinel);
  }
}

/** The shape every MANUAL event must have: exactly `campos` and `origen`
 *  (so no mask, count or value key can exist), origin `manual`, and only
 *  field names from the closed lists. */
function expectManualShape(event: AuditEvent) {
  const datos = event.datos as Record<string, unknown>;
  expect(Object.keys(datos).sort()).toEqual(["campos", "origen"]);
  expect(datos.origen).toBe("manual");
  const closed: readonly string[] = [
    ...AUDITABLE_ASIGNATURA_FIELDS,
    ...AUDITABLE_GRUPO_FIELDS,
  ];
  for (const campo of datos.campos as string[]) {
    expect(closed).toContain(campo);
  }
}

function expectCleanTrail() {
  const serialised = JSON.stringify(events());
  expectNoSentinel(serialised);
  expectNoSentinel(logs());
  // Only the FIELD NAME `dias` may appear; never as a key carrying the mask.
  expect(serialised).not.toMatch(/"dias"\s*:/);
  expect(serialised).not.toMatch(/\b85\b/);
}

const leakyError = () =>
  Object.assign(
    new Error(`insert failed near (${CODIGO}, ${NOMBRE}, ${CORREO}, ${HASH})`),
    {
      code: "23505",
      detail: `Key (codigo)=(${CODIGO}) already exists.`,
      parameters: [CODIGO, NOMBRE, DOCENTE, CORREO, HASH, CLAVE, "miercoles"],
    },
  );

const ASIGNATURA = {
  codigo: CODIGO,
  nombre: NOMBRE,
  carreraId: "7",
  horasTotales: "60",
};
const GRUPO_CREATE = {
  asignaturaId: "12",
  periodo: "2026-S1",
  numeroGrupo: NUMERO,
  docenteId: "30",
  dias: ["miercoles", "lunes"],
};
const GRUPO_EDIT = { id: "5", docenteId: "31", dias: ["miercoles", "lunes"] };

type Scenario = {
  name: string;
  data: ReturnType<typeof vi.fn>;
  run: () => Promise<unknown>;
  /** A successful result and the one event it must produce. */
  ok: Record<string, unknown>;
  accion: string;
  /** A refusal or no-op that must leave no audit row. */
  refusal: Record<string, unknown>;
};

const MANUAL: Scenario[] = [
  {
    name: "createAsignaturaAction",
    data: m.createAsignatura,
    run: () => createAsignaturaAction(IDLE, form(ASIGNATURA)),
    ok: { kind: "created", id: 301 },
    accion: "asignatura.creada",
    refusal: { kind: "codigo_taken", inScope: true, activo: false },
  },
  {
    name: "updateAsignaturaAction",
    data: m.updateAsignatura,
    run: () => updateAsignaturaAction(IDLE, form({ id: "12", ...ASIGNATURA })),
    ok: { kind: "updated", id: 12, campos: ["nombre", "horasTotales"] },
    accion: "asignatura.actualizada",
    refusal: { kind: "unchanged" },
  },
  {
    name: "setAsignaturaActivoAction",
    data: m.setAsignaturaActivo,
    run: () =>
      setAsignaturaActivoAction(IDLE, form({ id: "12", intent: "deactivate" })),
    ok: { kind: "changed", id: 12, activo: false },
    accion: "asignatura.desactivada",
    refusal: { kind: "has_active_groups", count: 3 },
  },
  {
    name: "createGrupoAction",
    data: m.createGrupo,
    run: () => createGrupoAction(IDLE, form(GRUPO_CREATE)),
    ok: { kind: "created", id: 501 },
    accion: "grupo.creado",
    refusal: { kind: "grupo_taken", activo: false },
  },
  {
    name: "updateGrupoAction",
    data: m.updateGrupo,
    run: () => updateGrupoAction(IDLE, form(GRUPO_EDIT)),
    ok: { kind: "updated", id: 5, campos: ["docenteId", "dias"] },
    accion: "grupo.actualizado",
    refusal: { kind: "unchanged" },
  },
  {
    name: "setGrupoActivoAction",
    data: m.setGrupoActivo,
    run: () =>
      setGrupoActivoAction(IDLE, form({ id: "5", intent: "reactivate" })),
    ok: { kind: "changed", id: 5, activo: true },
    accion: "grupo.reactivado",
    refusal: { kind: "asignatura_unavailable" },
  },
];

describe.each(MANUAL)("$name leaks nothing", (scenario) => {
  it("a success writes exactly one manual event of field names", async () => {
    scenario.data.mockResolvedValue({ ...scenario.ok, ...LEAK });

    await settle(scenario.run);

    expect(events()).toHaveLength(1);
    expect(events()[0].accion).toBe(scenario.accion);
    expectManualShape(events()[0]);
    expectCleanTrail();
  });

  it("a refusal or no-op writes no event", async () => {
    scenario.data.mockResolvedValue({ ...scenario.refusal, ...LEAK });

    await settle(scenario.run);

    expect(events()).toEqual([]);
    expectCleanTrail();
  });

  it("a driver error carrying every sentinel is logged by name only", async () => {
    scenario.data.mockRejectedValue(leakyError());

    await settle(scenario.run);

    expect(events()).toEqual([]);
    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
    expect(logs()).toContain("catalog.write.failed");
    expectCleanTrail();
  });
});

describe("the Grupo days never reach the audit trail", () => {
  it("a create handed the days in any order audits only the field name", async () => {
    m.createGrupo.mockResolvedValue({ kind: "created", id: 501, ...LEAK });

    await settle(() => createGrupoAction(IDLE, form(GRUPO_CREATE)));

    expect(m.createGrupo.mock.calls[0][2]).toMatchObject({
      dias: ["lunes", "miercoles"],
    });
    const [event] = events();
    expect((event.datos as { campos: readonly string[] }).campos).toContain(
      "dias",
    );
    expectCleanTrail();
  });

  it("a days-only update audits exactly [dias]", async () => {
    m.updateGrupo.mockResolvedValue({
      kind: "updated",
      id: 5,
      campos: ["dias"],
      ...LEAK,
    });

    await settle(() => updateGrupoAction(IDLE, form(GRUPO_EDIT)));

    expect(events().map((e) => e.datos)).toEqual([
      { campos: ["dias"], origen: "manual" },
    ]);
    expectCleanTrail();
  });
});

describe("the import actions leak nothing", () => {
  it("previewAction writes no audit row and logs nothing", async () => {
    const state = await previewAction({ kind: "idle" }, workbookForm());

    expect(state).toMatchObject({ kind: "preview" });
    expect(m.audit).not.toHaveBeenCalled();
    expectNoSentinel(logs());
  });

  it("applyAction audits counts and field names only, and logs no value", async () => {
    const state = await applyAction({ kind: "idle" }, workbookForm());

    // The fixture really went through the write path: the one-time credential
    // is delivered to the caller in the return value, and only there.
    expect(state).toMatchObject({
      kind: "applied",
      credentials: [{ login: CORREO, clave: CLAVE }],
    });
    const written = events();
    expect(written.map((e) => e.accion)).toEqual([
      "catalogo.importacion.aplicada",
      "usuario.creado",
    ]);
    for (const event of written) {
      const origen = (event.datos as { origen?: string }).origen;
      expect(origen === undefined || origen === "importacion").toBe(true);
    }
    expectCleanTrail();
  });

  it("a failing apply logs the actor, the file digest and the error name only", async () => {
    m.createUsuariosBulk.mockRejectedValue(leakyError());

    const state = await applyAction({ kind: "idle" }, workbookForm());

    expect(state).toEqual({ kind: "error", message: "errors.applyFailed" });
    expect(m.audit).not.toHaveBeenCalled();
    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
    expectCleanTrail();
  });
});
