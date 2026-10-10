import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogScope } from "@/lib/catalog/scope";
import type { CatalogFormState } from "@/lib/catalog/types";

vi.mock("server-only", () => ({}));

// The guard and the data layer are doubles. `withCatalogWrite` and the audit
// event mapper are REAL: the database handle is a recording stub and the audit
// insert is a spy, so lock order, `toEvents` and error mapping are exercised.
const m = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  guard: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setActivo: vi.fn(),
  getGrupo: vi.fn(),
  getAsignatura: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
// A translator that echoes the key (and its values): the tests pin WHICH
// message an action chooses, not its text.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: object) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: m.audit }));
vi.mock("@/lib/auth/catalog-access", () => ({
  requireCatalogAccess: m.guard,
}));
vi.mock("@/lib/data/asignaturas", () => ({
  getAsignaturaById: m.getAsignatura,
}));
vi.mock("@/lib/data/grupos", () => ({
  createGrupo: m.create,
  updateGrupo: m.update,
  setGrupoActivo: m.setActivo,
  getGrupoById: m.getGrupo,
}));

import {
  createGrupoAction,
  setGrupoActivoAction,
  updateGrupoAction,
} from "@/app/(dashboard)/catalog/grupos/actions";

const ACTOR = 41;
const ALL: CatalogScope = { kind: "all" };
const SCOPE_7: CatalogScope = { kind: "carrera", carreraId: 7 };
const NONE: CatalogScope = { kind: "none" };
const IDLE = { kind: "idle" } as const;
const tx = { execute: vi.fn(async () => undefined) };

let guardResolved = false;
let consoleError: ReturnType<typeof vi.spyOn>;

function allow(scope: CatalogScope = ALL) {
  m.guard.mockImplementation(async () => {
    await Promise.resolve();
    guardResolved = true;
    return { session: {}, actorId: ACTOR, scope };
  });
}

type Fields = Record<string, string | (string | File)[] | undefined>;

/** A FormData stand-in whose `get` AND `getAll` throw until the guard has
 *  resolved: any read of the body before authorization fails (CM-ACC-2). */
function form(fields: Fields) {
  const guarded = (key: string) => {
    if (!guardResolved)
      throw new Error(`form field "${key}" read before the guard`);
  };
  return {
    get: vi.fn((key: string) => {
      guarded(key);
      const value = fields[key];
      return typeof value === "string" ? value : null;
    }),
    getAll: vi.fn((key: string) => {
      guarded(key);
      const value = fields[key];
      return Array.isArray(value) ? value : [];
    }),
  } as unknown as FormData;
}

const VALID: Fields = {
  asignaturaId: "12",
  periodo: "2026-S1",
  numeroGrupo: "1",
  docenteId: "30",
  dias: ["lunes"],
};
// The scoped pre-check read of an existing Grupo (A-6) and the edit form body.
const GRUPO = {
  id: 5,
  asignaturaId: 12,
  asignaturaCodigo: "MAT-101",
  asignaturaNombre: "Calculo",
  docenteId: 30,
  docenteNombre: "Ana Perez",
  activo: true,
  dias: [],
};
const EDIT: Fields = { id: "5", docenteId: "31", dias: ["lunes"] };
const busyError = () =>
  Object.assign(new Error("lock timeout"), { code: "55P03" });

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  m.transaction.mockImplementation(async (work: (t: typeof tx) => unknown) =>
    work(tx),
  );
  m.getAsignatura.mockResolvedValue({ id: 12, activo: true });
  m.getGrupo.mockResolvedValue(GRUPO);
  guardResolved = false;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  allow();
});

afterEach(() => consoleError.mockRestore());

function expectNothingWritten() {
  expect(m.create).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
  expect(m.setActivo).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.audit).not.toHaveBeenCalled();
  expect(m.revalidatePath).not.toHaveBeenCalled();
  expect(m.redirect).not.toHaveBeenCalled();
}

const fieldError = (field: string, key: string) => ({
  kind: "invalid",
  fieldErrors: { [field]: `shared.fieldErrors.${key}` },
});

describe("createGrupoAction", () => {
  it.each(["docente", "estudiante", "anonymous", "flagged"])(
    "a guard that rejects (%s) propagates, reads no field and writes nothing",
    async (who) => {
      m.guard.mockRejectedValue(new Error(`REDIRECT:/${who}`));
      const fd = form(VALID);

      await expect(createGrupoAction(IDLE, fd)).rejects.toThrow(
        `REDIRECT:/${who}`,
      );

      expect(fd.get).not.toHaveBeenCalled();
      expect(fd.getAll).not.toHaveBeenCalled();
      expect(m.getAsignatura).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("scope none: says no Carrera is assigned, reads no field and writes nothing", async () => {
    allow(NONE);
    const fd = form(VALID);

    const state = await createGrupoAction(IDLE, fd);

    expect(state).toEqual({
      kind: "error",
      message: "shared.noCarrera.message",
    });
    expect(fd.get).not.toHaveBeenCalled();
    expect(fd.getAll).not.toHaveBeenCalled();
    expect(m.getAsignatura).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("reads the days only after the guard resolved (a throwing form proves it)", async () => {
    m.create.mockResolvedValue({ kind: "created", id: 5 });
    const fd = form(VALID);

    await expect(createGrupoAction(IDLE, fd)).rejects.toThrow("REDIRECT:");

    expect(fd.getAll).toHaveBeenCalledWith("dias");
  });

  it.each([
    ["periodo 2026-S3", { periodo: "2026-S3" }, "periodo", "invalid"],
    ["periodo 2026-1", { periodo: "2026-1" }, "periodo", "invalid"],
    ["periodo 26-S1", { periodo: "26-S1" }, "periodo", "invalid"],
    ["periodo 2026S1", { periodo: "2026S1" }, "periodo", "invalid"],
    ["periodo 2026-s1", { periodo: "2026-s1" }, "periodo", "invalid"],
    ["periodo empty", { periodo: "" }, "periodo", "required"],
    ["numero empty", { numeroGrupo: "" }, "numeroGrupo", "numGrupo.required"],
    [
      "numero spaces",
      { numeroGrupo: "   " },
      "numeroGrupo",
      "numGrupo.required",
    ],
    [
      "numero 13 chars",
      { numeroGrupo: "1".repeat(13) },
      "numeroGrupo",
      "numGrupo.tooLong",
    ],
    ["asignatura blank", { asignaturaId: "" }, "asignaturaId", "required"],
    ["asignatura text", { asignaturaId: "abc" }, "asignaturaId", "invalid"],
    ["asignatura zero", { asignaturaId: "0" }, "asignaturaId", "invalid"],
    ["docente blank", { docenteId: "" }, "docenteId", "required"],
    ["docente text", { docenteId: "x" }, "docenteId", "invalid"],
    ["no day selected", { dias: [] }, "dias", "required"],
    ["day outside the seven", { dias: ["monday"] }, "dias", "invalid"],
    ["a File entry", { dias: [new File(["x"], "a.txt")] }, "dias", "invalid"],
  ])(
    "invalid input (%s) -> translated field error, no read, no write",
    async (_n, over, field, key) => {
      const state = await createGrupoAction(IDLE, form({ ...VALID, ...over }));

      // `numeroGrupo` reuses the import's `numGrupo.*` keys (full key given).
      const full = key.includes(".") ? key : `${field}.${key}`;
      expect(state).toEqual(fieldError(field, full));
      expect(m.getAsignatura).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("reports every invalid field at once, the days included", async () => {
    const state = await createGrupoAction(
      IDLE,
      form({ periodo: "bad", numeroGrupo: "", dias: [] }),
    );

    expect(state).toEqual({
      kind: "invalid",
      fieldErrors: {
        asignaturaId: "shared.fieldErrors.asignaturaId.required",
        periodo: "shared.fieldErrors.periodo.invalid",
        numeroGrupo: "shared.fieldErrors.numGrupo.required",
        docenteId: "shared.fieldErrors.docenteId.required",
        dias: "shared.fieldErrors.dias.required",
      },
    });
  });

  // The pre-check (A-6): the Asignatura is read through the scope BEFORE the
  // lock, so a busy lock can never turn an unknown parent into "busy".
  it.each([
    ["missing", null],
    ["foreign (the scoped read finds nothing)", null],
    ["inactive", { id: 12, activo: false }],
  ])(
    "pre-check: a %s Asignatura answers the same message and never takes the lock",
    async (_n, found) => {
      allow(SCOPE_7);
      m.getAsignatura.mockResolvedValue(found);
      m.transaction.mockRejectedValue(busyError());

      const state = await createGrupoAction(IDLE, form(VALID));

      expect(state).toEqual(fieldError("asignaturaId", "asignaturaId.invalid"));
      expect(m.getAsignatura).toHaveBeenCalledExactlyOnceWith(SCOPE_7, 12);
      expectNothingWritten();
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it("pre-check: a failing read logs one sanitised line and answers the generic error", async () => {
    m.getAsignatura.mockRejectedValue(
      new Error("read failed password=hunter2"),
    );

    const state = await createGrupoAction(IDLE, form(VALID));

    expect(state).toEqual({
      kind: "error",
      message: "grupos.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledOnce();
    const line = String(consoleError.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      event: "catalog.write.failed",
      actor: ACTOR,
    });
    expect(line).not.toContain("hunter2");
    expectNothingWritten();
  });

  it("takes actor and scope from the guard, ignores crafted fields and hands createGrupo the days in week order", async () => {
    allow(SCOPE_7);
    m.create.mockResolvedValue({ kind: "created", id: 5 });

    await expect(
      createGrupoAction(
        IDLE,
        form({
          ...VALID,
          numeroGrupo: " 1 ",
          dias: ["miercoles", "lunes"],
          actorId: "999",
          scope: "all",
          origen: "importacion",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(m.create).toHaveBeenCalledExactlyOnceWith(tx, SCOPE_7, {
      asignaturaId: 12,
      periodo: "2026-S1",
      numeroGrupo: "1",
      docenteId: 30,
      dias: ["lunes", "miercoles"],
    });
    expect(m.audit).toHaveBeenCalledWith(tx, ACTOR, expect.any(Array));
  });

  it("created: revalidates the list, redirects outside any try, audits one manual event with names only", async () => {
    m.create.mockResolvedValue({ kind: "created", id: 5 });

    await expect(
      createGrupoAction(IDLE, form({ ...VALID, dias: ["miercoles", "lunes"] })),
    ).rejects.toThrow("REDIRECT:/catalog/grupos");

    expect(m.revalidatePath).toHaveBeenCalledExactlyOnceWith("/catalog/grupos");
    expect(m.revalidatePath.mock.invocationCallOrder[0]).toBeLessThan(
      m.redirect.mock.invocationCallOrder[0],
    );
    expect(m.audit).toHaveBeenCalledOnce();
    const events = m.audit.mock.calls[0][2];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      accion: "grupo.creado",
      entidadTipo: "Grupo",
      entidadId: 5,
    });
    expect(events[0].datos).toEqual({
      origen: "manual",
      campos: [
        "asignaturaId",
        "periodo",
        "numeroGrupo",
        "docenteId",
        "activo",
        "origen",
        "dias",
      ],
    });
    // Day sentinels: no day code, name or mask value reaches the payload.
    expect(JSON.stringify(events)).not.toMatch(/lunes|miercoles|Mi[eé]rcoles/i);
  });

  // Amendment 2026-10-09: the refusal is a field error on `numeroGrupo`.
  it.each([
    ["active", { activo: true }, fieldError("numeroGrupo", "numGrupo.taken")],
    [
      "inactive (points to reactivation)",
      { activo: false },
      fieldError("numeroGrupo", "numGrupo.takenInactive"),
    ],
  ])("grupo_taken (%s) -> %j", async (_n, taken, expected) => {
    m.create.mockResolvedValue({ kind: "grupo_taken", ...taken });

    const state = await createGrupoAction(IDLE, form(VALID));

    expect(state).toEqual(expected);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("asignatura_unavailable inside the transaction (a race) answers like the pre-check", async () => {
    m.create.mockResolvedValue({ kind: "asignatura_unavailable" });

    const state = await createGrupoAction(IDLE, form(VALID));

    expect(state).toEqual(fieldError("asignaturaId", "asignaturaId.invalid"));
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("docente_unavailable (missing, inactive or not a docente alike) -> one field error on docenteId, no audit", async () => {
    m.create.mockResolvedValue({ kind: "docente_unavailable" });

    const state = await createGrupoAction(IDLE, form(VALID));

    expect(state).toEqual(fieldError("docenteId", "docenteId.invalid"));
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("busy: a lock timeout is `busy`, not `error`, with no trace, revalidate or redirect", async () => {
    m.create.mockRejectedValue(busyError());

    const state = await createGrupoAction(IDLE, form(VALID));

    expect(state).toEqual({ kind: "busy" } satisfies CatalogFormState);
    expect(consoleError).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("unexpected error: generic message without the thrown text, one sanitised log line", async () => {
    m.create.mockRejectedValue(new Error("insert failed password=hunter2"));

    const state = await createGrupoAction(IDLE, form(VALID));

    expect(state).toEqual({
      kind: "error",
      message: "grupos.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledOnce();
    const line = String(consoleError.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      event: "catalog.write.failed",
      actor: ACTOR,
    });
    expect(line).not.toContain("hunter2");
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", { kind: "not_found" }],
    ["unchanged", { kind: "unchanged", id: 5 }],
  ])(
    "a result kind a create cannot produce (%s) is the generic error",
    async (_n, result) => {
      m.create.mockResolvedValue(result);

      const state = await createGrupoAction(IDLE, form(VALID));

      expect(state).toEqual({
        kind: "error",
        message: "grupos.errors.unexpected",
      });
      expect(m.audit).not.toHaveBeenCalled();
    },
  );
});

const GENERIC = { kind: "error", message: "grupos.errors.unexpected" };

describe("updateGrupoAction", () => {
  it.each(["docente", "estudiante", "anonymous", "flagged"])(
    "a guard that rejects (%s) propagates, reads no field and writes nothing",
    async (who) => {
      m.guard.mockRejectedValue(new Error(`REDIRECT:/${who}`));
      const fd = form(EDIT);

      await expect(updateGrupoAction(IDLE, fd)).rejects.toThrow(
        `REDIRECT:/${who}`,
      );

      expect(fd.get).not.toHaveBeenCalled();
      expect(fd.getAll).not.toHaveBeenCalled();
      expect(m.getGrupo).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("scope none: says no Carrera is assigned, reads no field and writes nothing", async () => {
    allow(NONE);
    const fd = form(EDIT);

    const state = await updateGrupoAction(IDLE, fd);

    expect(state).toEqual({
      kind: "error",
      message: "shared.noCarrera.message",
    });
    expect(fd.get).not.toHaveBeenCalled();
    expect(fd.getAll).not.toHaveBeenCalled();
    expect(m.getGrupo).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["absent", undefined],
    ["text", "abc"],
    ["zero", "0"],
    ["negative", "-3"],
    ["decimal", "1.5"],
  ])("a %s id answers gone without a read or the lock", async (_n, id) => {
    const state = await updateGrupoAction(IDLE, form({ ...EDIT, id }));

    expect(state).toEqual({ kind: "gone" });
    expect(m.getGrupo).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["missing", null],
    ["foreign (the scoped read finds nothing)", null],
  ])(
    "pre-check: a %s Grupo answers the same gone and never takes the lock",
    async (_n, found) => {
      allow(SCOPE_7);
      m.getGrupo.mockResolvedValue(found);
      m.transaction.mockRejectedValue(busyError());

      const state = await updateGrupoAction(IDLE, form(EDIT));

      expect(state).toEqual({ kind: "gone" });
      expect(m.getGrupo).toHaveBeenCalledExactlyOnceWith(SCOPE_7, 5);
      expectNothingWritten();
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it("pre-check: a failing read logs one sanitised line and answers the generic error", async () => {
    m.getGrupo.mockRejectedValue(new Error("read failed password=hunter2"));

    const state = await updateGrupoAction(IDLE, form(EDIT));

    expect(state).toEqual(GENERIC);
    expect(consoleError).toHaveBeenCalledOnce();
    const line = String(consoleError.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      event: "catalog.write.failed",
      actor: ACTOR,
    });
    expect(line).not.toContain("hunter2");
    expectNothingWritten();
  });

  it.each([
    ["docente blank", { docenteId: "" }, "docenteId", "docenteId.required"],
    ["docente text", { docenteId: "x" }, "docenteId", "docenteId.invalid"],
    // A legacy group has no days: a docente-only edit is refused until one is
    // chosen (A-DIAS-REQ, finding F-15).
    ["no day selected", { dias: [] }, "dias", "dias.required"],
    ["day outside the seven", { dias: ["monday"] }, "dias", "dias.invalid"],
    ["a File entry", { dias: [new File(["x"], "a")] }, "dias", "dias.invalid"],
  ])(
    "invalid input (%s) -> translated field error, nothing written",
    async (_n, over, field, key) => {
      const state = await updateGrupoAction(IDLE, form({ ...EDIT, ...over }));

      expect(state).toEqual(fieldError(field, key));
      expectNothingWritten();
    },
  );

  it("refuses a docente-only edit of a legacy group with no days (dias.required)", async () => {
    m.getGrupo.mockResolvedValue({ ...GRUPO, dias: [] });

    const state = await updateGrupoAction(
      IDLE,
      form({ id: "5", docenteId: "31" }),
    );

    expect(state).toEqual(fieldError("dias", "dias.required"));
    expectNothingWritten();
  });

  it("hands updateGrupo only { docenteId, dias } in week order, actor and scope from the guard, crafted fields ignored", async () => {
    allow(SCOPE_7);
    m.update.mockResolvedValue({ kind: "unchanged", id: 5 });

    await updateGrupoAction(
      IDLE,
      form({
        ...EDIT,
        dias: ["miercoles", "lunes", "lunes"],
        periodo: "2030-S2",
        numeroGrupo: "99",
        asignaturaId: "999",
        origen: "importacion",
        actorId: "999",
      }),
    );

    expect(m.update).toHaveBeenCalledExactlyOnceWith(tx, SCOPE_7, 5, {
      docenteId: 31,
      dias: ["lunes", "miercoles"],
    });
  });

  it.each([
    ["docente only", ["docenteId"]],
    ["days only", ["dias"]],
    ["docente and days", ["docenteId", "dias"]],
  ])(
    "updated (%s): revalidates list and edit page, redirects outside any try, audits one manual event naming only %j",
    async (_n, campos) => {
      m.update.mockResolvedValue({ kind: "updated", id: 5, campos });

      await expect(
        updateGrupoAction(IDLE, form({ ...EDIT, dias: ["miercoles"] })),
      ).rejects.toThrow("REDIRECT:/catalog/grupos");

      expect(m.revalidatePath.mock.calls).toEqual([
        ["/catalog/grupos"],
        ["/catalog/grupos/5/edit"],
      ]);
      expect(m.revalidatePath.mock.invocationCallOrder[1]).toBeLessThan(
        m.redirect.mock.invocationCallOrder[0],
      );
      expect(m.audit).toHaveBeenCalledOnce();
      const events = m.audit.mock.calls[0][2];
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        accion: "grupo.actualizado",
        entidadTipo: "Grupo",
        entidadId: 5,
      });
      expect(events[0].datos).toEqual({ origen: "manual", campos });
      // No day name, code, mask or count reaches the payload.
      expect(JSON.stringify(events)).not.toMatch(
        /lunes|miercoles|Mi[eé]rcoles/i,
      );
    },
  );

  it("unchanged (same docente and same set of days, even reordered): no audit, no revalidate, no redirect", async () => {
    m.update.mockResolvedValue({ kind: "unchanged", id: 5 });

    const state = await updateGrupoAction(
      IDLE,
      form({ ...EDIT, dias: ["miercoles", "lunes"] }),
    );

    expect(state).toEqual({ kind: "unchanged" });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["inactive", { kind: "inactive" }, { kind: "inactive" }],
    ["not_found (in the transaction)", { kind: "not_found" }, { kind: "gone" }],
    [
      "docente_unavailable",
      { kind: "docente_unavailable" },
      fieldError("docenteId", "docenteId.invalid"),
    ],
    // The group's own Asignatura is inactive: there is no Asignatura field on
    // the edit form, so this is the generic error.
    ["asignatura_unavailable", { kind: "asignatura_unavailable" }, GENERIC],
    [
      "a kind an update cannot produce (grupo_taken)",
      { kind: "grupo_taken", activo: true },
      GENERIC,
    ],
  ])(
    "%s -> the matching state, no audit, no revalidate",
    async (_n, result, expected) => {
      m.update.mockResolvedValue(result);

      const state = await updateGrupoAction(IDLE, form(EDIT));

      expect(state).toEqual(expected);
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
      expect(m.redirect).not.toHaveBeenCalled();
    },
  );

  it("busy: a lock timeout is `busy`, not `error`, with no trace", async () => {
    m.update.mockRejectedValue(busyError());

    const state = await updateGrupoAction(IDLE, form(EDIT));

    expect(state).toEqual({ kind: "busy" } satisfies CatalogFormState);
    expect(consoleError).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("unexpected error: generic message without the thrown text, one sanitised log line", async () => {
    m.update.mockRejectedValue(new Error("update failed password=hunter2"));

    const state = await updateGrupoAction(IDLE, form(EDIT));

    expect(state).toEqual(GENERIC);
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledOnce();
    expect(String(consoleError.mock.calls[0][0])).not.toContain("hunter2");
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});

const TOGGLE: Fields = { id: "5", intent: "deactivate" };
const REACTIVATE: Fields = { id: "5", intent: "reactivate" };

describe("setGrupoActivoAction", () => {
  it.each(["docente", "estudiante", "anonymous", "flagged"])(
    "a guard that rejects (%s) propagates, reads no field and writes nothing",
    async (who) => {
      m.guard.mockRejectedValue(new Error(`REDIRECT:/${who}`));
      const fd = form(TOGGLE);

      await expect(setGrupoActivoAction(IDLE, fd)).rejects.toThrow(
        `REDIRECT:/${who}`,
      );

      expect(fd.get).not.toHaveBeenCalled();
      expect(fd.getAll).not.toHaveBeenCalled();
      expect(m.getGrupo).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("scope none: says no Carrera is assigned, reads no field and writes nothing", async () => {
    allow(NONE);
    const fd = form(TOGGLE);

    const state = await setGrupoActivoAction(IDLE, fd);

    expect(state).toEqual({
      kind: "error",
      message: "shared.noCarrera.message",
    });
    expect(fd.get).not.toHaveBeenCalled();
    expect(fd.getAll).not.toHaveBeenCalled();
    expect(m.getGrupo).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["unknown word", "delete"],
    ["a boolean-looking string", "true"],
    ["wrong case", "Deactivate"],
  ])(
    "an intent that is %s answers gone before any read of the record",
    async (_n, intent) => {
      const state = await setGrupoActivoAction(IDLE, form({ id: "5", intent }));

      expect(state).toEqual({ kind: "gone" });
      expect(m.getGrupo).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it.each([
    ["absent", undefined],
    ["text", "abc"],
    ["zero", "0"],
  ])("a %s id answers gone without a read or the lock", async (_n, id) => {
    const state = await setGrupoActivoAction(IDLE, form({ ...TOGGLE, id }));

    expect(state).toEqual({ kind: "gone" });
    expect(m.getGrupo).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["missing", null],
    ["foreign (the scoped read finds nothing)", null],
  ])(
    "pre-check: a %s Grupo answers the same gone, names no parent and never takes the lock",
    async (_n, found) => {
      allow(SCOPE_7);
      m.getGrupo.mockResolvedValue(found);
      m.transaction.mockRejectedValue(busyError());

      const state = await setGrupoActivoAction(IDLE, form(REACTIVATE));

      expect(state).toEqual({ kind: "gone" });
      expect(m.getGrupo).toHaveBeenCalledExactlyOnceWith(SCOPE_7, 5);
      expectNothingWritten();
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it("pre-check: a failing read logs one sanitised line and answers the generic error", async () => {
    m.getGrupo.mockRejectedValue(new Error("read failed password=hunter2"));

    const state = await setGrupoActivoAction(IDLE, form(TOGGLE));

    expect(state).toEqual(GENERIC);
    expect(consoleError).toHaveBeenCalledOnce();
    const line = String(consoleError.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      event: "catalog.write.failed",
      actor: ACTOR,
    });
    expect(line).not.toContain("hunter2");
    expectNothingWritten();
  });

  it.each([
    ["deactivate", false, "grupo.desactivado"],
    ["reactivate", true, "grupo.reactivado"],
  ])(
    "%s: calls setGrupoActivo with no days argument, revalidates, returns done and audits one manual event on `activo` only",
    async (intent, activo, accion) => {
      allow(SCOPE_7);
      // A legacy group with no days: neither direction depends on them.
      m.getGrupo.mockResolvedValue({ ...GRUPO, activo: !activo, dias: [] });
      m.setActivo.mockResolvedValue({ kind: "changed", id: 5, activo });
      const fd = form({ id: "5", intent });

      const state = await setGrupoActivoAction(IDLE, fd);

      expect(state).toEqual({ kind: "done", activo });
      expect(m.setActivo).toHaveBeenCalledExactlyOnceWith(
        tx,
        SCOPE_7,
        5,
        activo,
      );
      expect(fd.getAll).not.toHaveBeenCalled();
      expect(m.revalidatePath.mock.calls).toEqual([
        ["/catalog/grupos"],
        ["/catalog/grupos/5/edit"],
      ]);
      expect(m.redirect).not.toHaveBeenCalled();
      const events = m.audit.mock.calls[0][2];
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        accion,
        entidadTipo: "Grupo",
        entidadId: 5,
      });
      expect(events[0].datos).toEqual({ origen: "manual", campos: ["activo"] });
    },
  );

  it("already in the requested state -> unchanged, no audit, no revalidate", async () => {
    m.setActivo.mockResolvedValue({ kind: "unchanged", id: 5 });

    const state = await setGrupoActivoAction(IDLE, form(TOGGLE));

    expect(state).toEqual({ kind: "unchanged" });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  // The label is the group's own Asignatura / docente as the pre-check read
  // them inside the actor's scope: nothing else can be named.
  it.each([
    [
      "asignatura_unavailable",
      'shared.refusals.parentInactive.asignatura:{"parent":"MAT-101 - Calculo"}',
    ],
    [
      "docente_unavailable",
      'shared.refusals.parentInactive.docente:{"parent":"Ana Perez"}',
    ],
  ])(
    "reactivation refused by %s names that parent, writes nothing",
    async (kind, message) => {
      m.setActivo.mockResolvedValue({ kind });

      const state = await setGrupoActivoAction(IDLE, form(REACTIVATE));

      expect(state).toEqual({ kind: "error", message });
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("not_found inside the transaction answers the same gone as the pre-check", async () => {
    m.setActivo.mockResolvedValue({ kind: "not_found" });

    const state = await setGrupoActivoAction(IDLE, form(TOGGLE));

    expect(state).toEqual({ kind: "gone" });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("busy: a lock timeout is `busy`, not `error`, with no trace", async () => {
    m.setActivo.mockRejectedValue(busyError());

    const state = await setGrupoActivoAction(IDLE, form(TOGGLE));

    expect(state).toEqual({ kind: "busy" });
    expect(consoleError).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("unexpected error: generic message without the thrown text, one sanitised log line", async () => {
    m.setActivo.mockRejectedValue(new Error("toggle failed password=hunter2"));

    const state = await setGrupoActivoAction(IDLE, form(TOGGLE));

    expect(state).toEqual(GENERIC);
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledOnce();
    expect(String(consoleError.mock.calls[0][0])).not.toContain("hunter2");
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});
