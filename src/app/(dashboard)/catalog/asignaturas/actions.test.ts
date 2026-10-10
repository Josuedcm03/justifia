import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActiveToggleState, CatalogFormState } from "@/lib/catalog/types";
import type { CatalogScope } from "@/lib/catalog/scope";

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
  getById: vi.fn(),
  update: vi.fn(),
  setActivo: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
// A translator that echoes the key (and its values): the tests pin WHICH
// message an action chooses; `catalog-parity.test.ts` pins that every key the
// action source uses exists in both locales.
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
  createAsignatura: m.create,
  getAsignaturaById: m.getById,
  updateAsignatura: m.update,
  setAsignaturaActivo: m.setActivo,
}));

import {
  createAsignaturaAction,
  setAsignaturaActivoAction,
  updateAsignaturaAction,
} from "@/app/(dashboard)/catalog/asignaturas/actions";

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

/** A FormData stand-in whose `get` throws until the guard has resolved: any
 *  read of the body before authorization fails the test (CM-ACC-2). */
function form(fields: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string) => {
      if (!guardResolved)
        throw new Error(`form field "${key}" read before the guard`);
      return fields[key] ?? null;
    }),
  } as unknown as FormData;
}

const VALID = {
  codigo: "MAT101",
  nombre: "Calculus",
  carreraId: "7",
  horasTotales: "64",
};
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
  guardResolved = false;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  allow();
});

afterEach(() => consoleError.mockRestore());

function expectNothingWritten() {
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.audit).not.toHaveBeenCalled();
  expect(m.revalidatePath).not.toHaveBeenCalled();
  expect(m.redirect).not.toHaveBeenCalled();
}

describe("createAsignaturaAction", () => {
  it.each(["docente", "estudiante", "anonymous", "flagged"])(
    "a guard that rejects (%s) propagates, reads no field and writes nothing",
    async (who) => {
      m.guard.mockRejectedValue(new Error(`REDIRECT:/${who}`));
      const fd = form(VALID);

      await expect(createAsignaturaAction(IDLE, fd)).rejects.toThrow(
        `REDIRECT:/${who}`,
      );

      expect(fd.get).not.toHaveBeenCalled();
      expect(m.create).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("scope none: says no Carrera is assigned, reads no field and writes nothing", async () => {
    allow(NONE);
    const fd = form(VALID);

    const state = await createAsignaturaAction(IDLE, fd);

    expect(state).toEqual({
      kind: "error",
      message: "shared.noCarrera.message",
    });
    expect(fd.get).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["codigo blank", { codigo: "" }, "codigo", "required"],
    ["codigo spaces", { codigo: "   " }, "codigo", "required"],
    ["codigo absent", { codigo: undefined }, "codigo", "required"],
    ["codigo 33 chars", { codigo: "X".repeat(33) }, "codigo", "tooLong"],
    ["nombre blank", { nombre: "" }, "nombre", "required"],
    ["nombre 161 chars", { nombre: "N".repeat(161) }, "nombre", "tooLong"],
    ["horas blank", { horasTotales: "" }, "horasTotales", "required"],
    ["horas zero", { horasTotales: "0" }, "horasTotales", "invalid"],
    ["horas negative", { horasTotales: "-5" }, "horasTotales", "invalid"],
    ["horas fraction", { horasTotales: "1.5" }, "horasTotales", "invalid"],
    ["horas text", { horasTotales: "abc" }, "horasTotales", "invalid"],
    ["carrera text", { carreraId: "abc" }, "carreraId", "invalid"],
    ["carrera zero", { carreraId: "0" }, "carreraId", "invalid"],
  ])(
    "invalid input (%s) -> translated field error, no write",
    async (_n, over, field, key) => {
      const state = await createAsignaturaAction(
        IDLE,
        form({ ...VALID, ...over }),
      );

      expect(state).toEqual({
        kind: "invalid",
        fieldErrors: { [field]: `shared.fieldErrors.${field}.${key}` },
      });
      expect(m.create).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("reports every invalid field at once", async () => {
    const state = await createAsignaturaAction(
      IDLE,
      form({ codigo: "", nombre: "", horasTotales: "" }),
    );

    expect(state).toEqual({
      kind: "invalid",
      fieldErrors: {
        codigo: "shared.fieldErrors.codigo.required",
        nombre: "shared.fieldErrors.nombre.required",
        horasTotales: "shared.fieldErrors.horasTotales.required",
      },
    });
  });

  it("takes actor and scope from the guard and ignores crafted fields", async () => {
    allow(SCOPE_7);
    m.create.mockResolvedValue({ kind: "created", id: 12 });

    await expect(
      createAsignaturaAction(
        IDLE,
        form({ ...VALID, actorId: "999", actor: "999", scope: "all" }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(m.create).toHaveBeenCalledWith(tx, SCOPE_7, {
      codigo: "MAT101",
      nombre: "Calculus",
      carreraId: 7,
      horasTotales: 64,
    });
    expect(m.audit).toHaveBeenCalledWith(tx, ACTOR, expect.any(Array));
  });

  it("a coordinacion naming another carrera is refused on carreraId, with no audit", async () => {
    allow(SCOPE_7);
    m.create.mockResolvedValue({ kind: "carrera_invalid" });

    const state = await createAsignaturaAction(
      IDLE,
      form({ ...VALID, carreraId: "9" }),
    );

    expect(m.create).toHaveBeenCalledWith(
      tx,
      SCOPE_7,
      expect.objectContaining({ carreraId: 9 }),
    );
    expect(state).toEqual({
      kind: "invalid",
      fieldErrors: { carreraId: "shared.fieldErrors.carreraId.invalid" },
    });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("created: revalidates the list, redirects outside any try, audits one manual event", async () => {
    m.create.mockResolvedValue({ kind: "created", id: 12 });

    await expect(createAsignaturaAction(IDLE, form(VALID))).rejects.toThrow(
      "REDIRECT:/catalog/asignaturas",
    );

    expect(m.revalidatePath).toHaveBeenCalledExactlyOnceWith(
      "/catalog/asignaturas",
    );
    expect(m.revalidatePath.mock.invocationCallOrder[0]).toBeLessThan(
      m.redirect.mock.invocationCallOrder[0],
    );
    expect(m.audit).toHaveBeenCalledOnce();
    const events = m.audit.mock.calls[0][2];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      accion: "asignatura.creada",
      entidadTipo: "Asignatura",
      entidadId: 12,
      datos: { origen: "manual" },
    });
  });

  // Amendment 2026-10-09: the refusal is a field error on `codigo`.
  const fieldError = (field: string, key: string) => ({
    kind: "invalid",
    fieldErrors: { [field]: `shared.fieldErrors.${key}` },
  });
  const generic = fieldError("codigo", "codigo.taken");
  it.each([
    ["in scope, active", { inScope: true, activo: true }, generic],
    [
      "in scope, inactive",
      { inScope: true, activo: false },
      fieldError("codigo", "codigo.takenInactive"),
    ],
    ["out of scope, active", { inScope: false, activo: true }, generic],
    ["out of scope, inactive", { inScope: false, activo: false }, generic],
  ])("codigo_taken (%s)", async (_name, taken, expected) => {
    m.create.mockResolvedValue({ kind: "codigo_taken", ...taken });

    const state = await createAsignaturaAction(IDLE, form(VALID));

    expect(state).toEqual(expected);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("an out-of-scope inactive duplicate is the very same answer as an active one", async () => {
    m.create.mockResolvedValue({
      kind: "codigo_taken",
      inScope: false,
      activo: true,
    });
    const active = await createAsignaturaAction(IDLE, form(VALID));
    allow();
    m.create.mockResolvedValue({
      kind: "codigo_taken",
      inScope: false,
      activo: false,
    });
    const inactive = await createAsignaturaAction(IDLE, form(VALID));

    expect(inactive).toEqual(active);
    expect(JSON.stringify(inactive)).not.toMatch(/inactive|activo|reactivate/i);
  });

  it("busy: a lock timeout is `busy`, not `error`, with no trace, revalidate or redirect", async () => {
    m.create.mockRejectedValue(busyError());

    const state = await createAsignaturaAction(IDLE, form(VALID));

    expect(state).toEqual({ kind: "busy" } satisfies CatalogFormState);
    expect(consoleError).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("unexpected error: generic message without the thrown text, one sanitised log line", async () => {
    m.create.mockRejectedValue(new Error("insert failed password=hunter2"));

    const state = await createAsignaturaAction(IDLE, form(VALID));

    expect(state).toEqual({
      kind: "error",
      message: "asignaturas.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledOnce();
    const line = String(consoleError.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      event: "catalog.write.failed",
      actor: ACTOR,
    });
    expect(line).not.toContain("hunter2");
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});

const DETAIL = {
  id: 12,
  codigo: "MAT101",
  nombre: "Calculus",
  carreraId: 7,
  carreraNombre: "Systems",
  horasTotales: 64,
  activo: true,
  gruposActivos: 0,
};
const EDIT_PATH = "/catalog/asignaturas/12/edit";
const BAD_IDS = [undefined, "", "abc", "0", "007", "-1", "1.5", " 12"];

/** The failure line `withCatalogWrite` and the pre-check both log. */
function expectOneSanitisedLog(leak: string) {
  expect(consoleError).toHaveBeenCalledOnce();
  const line = String(consoleError.mock.calls[0][0]);
  expect(JSON.parse(line)).toMatchObject({
    event: "catalog.write.failed",
    actor: ACTOR,
  });
  expect(line).not.toContain(leak);
}

describe("updateAsignaturaAction", () => {
  const CHANGE = { id: "12", nombre: "Calculus Zeta", horasTotales: "7777" };

  beforeEach(() => {
    m.getById.mockResolvedValue(DETAIL);
  });

  it.each(["docente", "estudiante", "anonymous", "flagged"])(
    "a guard that rejects (%s) propagates, reads no field and touches no data",
    async (who) => {
      m.guard.mockRejectedValue(new Error(`REDIRECT:/${who}`));
      const fd = form(CHANGE);

      await expect(updateAsignaturaAction(IDLE, fd)).rejects.toThrow(
        `REDIRECT:/${who}`,
      );

      expect(fd.get).not.toHaveBeenCalled();
      expect(m.getById).not.toHaveBeenCalled();
      expect(m.update).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("scope none: says no Carrera is assigned, reads no field and reads no record", async () => {
    allow(NONE);
    const fd = form(CHANGE);

    const state = await updateAsignaturaAction(IDLE, fd);

    expect(state).toEqual({
      kind: "error",
      message: "shared.noCarrera.message",
    });
    expect(fd.get).not.toHaveBeenCalled();
    expect(m.getById).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each(BAD_IDS.map((id) => [String(id), id] as const))(
    "a bad record id (%s) answers gone without reading or writing",
    async (_label, id) => {
      const state = await updateAsignaturaAction(IDLE, form({ ...CHANGE, id }));

      expect(state).toEqual({ kind: "gone" } satisfies CatalogFormState);
      expect(m.getById).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("pre-check: a missing and a foreign record are the identical gone, without the lock", async () => {
    allow(SCOPE_7);
    m.getById.mockResolvedValue(null);
    const missing = await updateAsignaturaAction(
      IDLE,
      form({ ...CHANGE, id: "99999" }),
    );
    allow(SCOPE_7);
    const foreign = await updateAsignaturaAction(IDLE, form(CHANGE));

    expect(foreign).toEqual(missing);
    expect(missing).toEqual({ kind: "gone" });
    expect(m.getById).toHaveBeenNthCalledWith(1, SCOPE_7, 99999);
    expect(m.getById).toHaveBeenNthCalledWith(2, SCOPE_7, 12);
    expect(m.update).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("pre-check: a busy lock cannot turn an unknown record into busy", async () => {
    m.getById.mockResolvedValue(null);
    m.transaction.mockRejectedValue(busyError());

    const state = await updateAsignaturaAction(IDLE, form(CHANGE));

    expect(state).toEqual({ kind: "gone" });
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("pre-check read failure: generic error, one sanitised log line, nothing written", async () => {
    m.getById.mockRejectedValue(new Error("select failed password=hunter2"));

    const state = await updateAsignaturaAction(IDLE, form(CHANGE));

    expect(state).toEqual({
      kind: "error",
      message: "asignaturas.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expectOneSanitisedLog("hunter2");
    expect(m.update).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["nombre blank", { nombre: "" }, "nombre", "required"],
    ["nombre 161 chars", { nombre: "N".repeat(161) }, "nombre", "tooLong"],
    ["horas blank", { horasTotales: "" }, "horasTotales", "required"],
    ["horas zero", { horasTotales: "0" }, "horasTotales", "invalid"],
    ["horas text", { horasTotales: "abc" }, "horasTotales", "invalid"],
    ["carrera text", { carreraId: "abc" }, "carreraId", "invalid"],
  ])(
    "invalid input (%s) -> translated field error, no write",
    async (_n, over, field, key) => {
      const state = await updateAsignaturaAction(
        IDLE,
        form({ ...CHANGE, ...over }),
      );

      expect(state).toEqual({
        kind: "invalid",
        fieldErrors: { [field]: `shared.fieldErrors.${field}.${key}` },
      });
      expect(m.update).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("ignores a crafted codigo, actor and scope: the data layer gets no codigo", async () => {
    allow(SCOPE_7);
    m.update.mockResolvedValue({
      kind: "updated",
      id: 12,
      campos: ["nombre", "horasTotales"],
    });

    await expect(
      updateAsignaturaAction(
        IDLE,
        form({
          ...CHANGE,
          codigo: "HACK1",
          actorId: "999",
          actor: "999",
          scope: "all",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(m.update).toHaveBeenCalledWith(tx, SCOPE_7, 12, {
      nombre: "Calculus Zeta",
      horasTotales: 7777,
    });
    expect(m.update.mock.calls[0][3]).not.toHaveProperty("codigo");
    expect(m.audit).toHaveBeenCalledWith(tx, ACTOR, expect.any(Array));
  });

  it("updated: revalidates list and edit page, redirects outside any try, audits names only", async () => {
    m.update.mockResolvedValue({
      kind: "updated",
      id: 12,
      campos: ["nombre", "horasTotales"],
    });

    await expect(updateAsignaturaAction(IDLE, form(CHANGE))).rejects.toThrow(
      "REDIRECT:/catalog/asignaturas",
    );

    expect(m.revalidatePath.mock.calls).toEqual([
      ["/catalog/asignaturas"],
      [EDIT_PATH],
    ]);
    expect(m.revalidatePath.mock.invocationCallOrder[1]).toBeLessThan(
      m.redirect.mock.invocationCallOrder[0],
    );
    expect(m.audit).toHaveBeenCalledOnce();
    const events = m.audit.mock.calls[0][2];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      accion: "asignatura.actualizada",
      entidadTipo: "Asignatura",
      entidadId: 12,
      datos: { origen: "manual", campos: ["nombre", "horasTotales"] },
    });
    const payload = JSON.stringify(events);
    for (const value of ["Calculus", "Calculus Zeta", "7777"]) {
      expect(payload).not.toContain(value);
    }
  });

  it("an unscoped actor may change the carrera", async () => {
    m.update.mockResolvedValue({
      kind: "updated",
      id: 12,
      campos: ["carreraId"],
    });

    await expect(
      updateAsignaturaAction(IDLE, form({ ...CHANGE, carreraId: "9" })),
    ).rejects.toThrow("REDIRECT:");

    expect(m.update).toHaveBeenCalledWith(tx, ALL, 12, {
      nombre: "Calculus Zeta",
      carreraId: 9,
      horasTotales: 7777,
    });
    expect(m.audit.mock.calls[0][2][0]).toMatchObject({
      datos: { campos: ["carreraId"] },
    });
  });

  it("a coordinacion naming another carrera is refused on carreraId, row unchanged, no audit", async () => {
    allow(SCOPE_7);
    m.update.mockResolvedValue({ kind: "carrera_invalid" });

    const state = await updateAsignaturaAction(
      IDLE,
      form({ ...CHANGE, carreraId: "9" }),
    );

    expect(state).toEqual({
      kind: "invalid",
      fieldErrors: { carreraId: "shared.fieldErrors.carreraId.invalid" },
    });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("a no-op edit is told as unchanged: no revalidate, no redirect, no audit", async () => {
    m.update.mockResolvedValue({ kind: "unchanged", id: 12 });

    const state = await updateAsignaturaAction(IDLE, form(CHANGE));

    expect(state).toEqual({ kind: "unchanged" } satisfies CatalogFormState);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("an inactive record is refused as inactive, nothing written", async () => {
    m.getById.mockResolvedValue({ ...DETAIL, activo: false });
    m.update.mockResolvedValue({ kind: "inactive" });

    const state = await updateAsignaturaAction(IDLE, form(CHANGE));

    expect(state).toEqual({ kind: "inactive" } satisfies CatalogFormState);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("re-validation inside the transaction: a record gone by then is the identical gone", async () => {
    m.getById.mockResolvedValue(null);
    const pre = await updateAsignaturaAction(IDLE, form(CHANGE));
    allow();
    m.getById.mockResolvedValue(DETAIL);
    m.update.mockResolvedValue({ kind: "not_found" });

    const inside = await updateAsignaturaAction(IDLE, form(CHANGE));

    expect(inside).toEqual(pre);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("busy: a lock timeout is `busy`, not `error`, with no trace and no revalidate", async () => {
    m.update.mockRejectedValue(busyError());

    const state = await updateAsignaturaAction(IDLE, form(CHANGE));

    expect(state).toEqual({ kind: "busy" } satisfies CatalogFormState);
    expect(consoleError).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("unexpected error: generic message without the thrown text, one sanitised log line", async () => {
    m.update.mockRejectedValue(new Error("update failed password=hunter2"));

    const state = await updateAsignaturaAction(IDLE, form(CHANGE));

    expect(state).toEqual({
      kind: "error",
      message: "asignaturas.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expectOneSanitisedLog("hunter2");
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setAsignaturaActivoAction", () => {
  const OFF = { id: "12", intent: "deactivate" };
  const ON = { id: "12", intent: "reactivate" };

  beforeEach(() => {
    m.getById.mockResolvedValue(DETAIL);
  });

  it("is a Server Action module: a POST-only entry point, no GET handler (CM-UX-1)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/catalog/asignaturas/actions.ts"),
      "utf8",
    );

    expect(source.startsWith('"use server"')).toBe(true);
    expect(source).not.toMatch(/export (async )?function GET\b/);
  });

  it.each(["docente", "estudiante", "anonymous", "flagged"])(
    "a guard that rejects (%s) propagates, reads no field and touches no data",
    async (who) => {
      m.guard.mockRejectedValue(new Error(`REDIRECT:/${who}`));
      const fd = form(OFF);

      await expect(setAsignaturaActivoAction(IDLE, fd)).rejects.toThrow(
        `REDIRECT:/${who}`,
      );

      expect(fd.get).not.toHaveBeenCalled();
      expect(m.getById).not.toHaveBeenCalled();
      expect(m.setActivo).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("scope none: says no Carrera is assigned, reads no field", async () => {
    allow(NONE);
    const fd = form(OFF);

    const state = await setAsignaturaActivoAction(IDLE, fd);

    expect(state).toEqual({
      kind: "error",
      message: "shared.noCarrera.message",
    });
    expect(fd.get).not.toHaveBeenCalled();
    expect(m.getById).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([undefined, "", "toggle", "DEACTIVATE", "true", "false"])(
    "an unknown intent (%s) answers gone and writes nothing",
    async (intent) => {
      const state = await setAsignaturaActivoAction(
        IDLE,
        form({ id: "12", intent }),
      );

      expect(state).toEqual({ kind: "gone" } satisfies ActiveToggleState);
      expect(m.getById).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it.each(BAD_IDS.map((id) => [String(id), id] as const))(
    "a bad record id (%s) answers gone without reading or writing",
    async (_label, id) => {
      const state = await setAsignaturaActivoAction(IDLE, form({ ...OFF, id }));

      expect(state).toEqual({ kind: "gone" });
      expect(m.getById).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("pre-check: a missing or foreign record is gone without taking the lock, even when busy", async () => {
    allow(SCOPE_7);
    m.getById.mockResolvedValue(null);
    m.transaction.mockRejectedValue(busyError());

    const state = await setAsignaturaActivoAction(IDLE, form(OFF));

    expect(state).toEqual({ kind: "gone" });
    expect(m.getById).toHaveBeenCalledWith(SCOPE_7, 12);
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("pre-check read failure: generic error, one sanitised log line, nothing written", async () => {
    m.getById.mockRejectedValue(new Error("select failed password=hunter2"));

    const state = await setAsignaturaActivoAction(IDLE, form(OFF));

    expect(state).toEqual({
      kind: "error",
      message: "asignaturas.errors.unexpected",
    });
    expectOneSanitisedLog("hunter2");
    expect(m.setActivo).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["deactivate", OFF, false, "asignatura.desactivada"],
    ["reactivate", ON, true, "asignatura.reactivada"],
  ])(
    "%s changes the state, audits one manual event and revalidates list and edit page",
    async (_name, fields, activo, accion) => {
      m.setActivo.mockResolvedValue({ kind: "changed", id: 12, activo });

      const state = await setAsignaturaActivoAction(IDLE, form(fields));

      expect(state).toEqual({ kind: "done", activo });
      expect(m.setActivo).toHaveBeenCalledWith(tx, ALL, 12, activo);
      expect(m.revalidatePath.mock.calls).toEqual([
        ["/catalog/asignaturas"],
        [EDIT_PATH],
      ]);
      expect(m.redirect).not.toHaveBeenCalled();
      expect(m.audit).toHaveBeenCalledOnce();
      const events = m.audit.mock.calls[0][2];
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        accion,
        entidadTipo: "Asignatura",
        entidadId: 12,
        datos: { origen: "manual", campos: ["activo"] },
      });
    },
  );

  it("takes actor and scope from the guard and ignores crafted fields", async () => {
    allow(SCOPE_7);
    m.setActivo.mockResolvedValue({ kind: "changed", id: 12, activo: false });

    await setAsignaturaActivoAction(
      IDLE,
      form({ ...OFF, actorId: "999", scope: "all", activo: "true" }),
    );

    expect(m.setActivo).toHaveBeenCalledWith(tx, SCOPE_7, 12, false);
    expect(m.audit).toHaveBeenCalledWith(tx, ACTOR, expect.any(Array));
  });

  it.each([
    ["deactivate", OFF],
    ["reactivate", ON],
  ])(
    "%s of a record already in that state is told as unchanged: no audit, no revalidate",
    async (_name, fields) => {
      m.setActivo.mockResolvedValue({ kind: "unchanged", id: 12 });

      const state = await setAsignaturaActivoAction(IDLE, form(fields));

      expect(state).toEqual({ kind: "unchanged" } satisfies ActiveToggleState);
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("active groups: refused with the count, no audit, no revalidate", async () => {
    m.setActivo.mockResolvedValue({ kind: "has_active_groups", count: 3 });

    const state = await setAsignaturaActivoAction(IDLE, form(OFF));

    expect(state).toEqual({
      kind: "error",
      message: 'shared.refusals.activeGrupos:{"count":3}',
    });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("re-validation inside the transaction: a record gone by then is the identical gone", async () => {
    m.setActivo.mockResolvedValue({ kind: "not_found" });

    const state = await setAsignaturaActivoAction(IDLE, form(OFF));

    expect(state).toEqual({ kind: "gone" });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("busy: a lock timeout is `busy`, not `error`, with no trace and no revalidate", async () => {
    m.setActivo.mockRejectedValue(busyError());

    const state = await setAsignaturaActivoAction(IDLE, form(OFF));

    expect(state).toEqual({ kind: "busy" } satisfies ActiveToggleState);
    expect(consoleError).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("unexpected error: generic message without the thrown text, one sanitised log line", async () => {
    m.setActivo.mockRejectedValue(new Error("update failed password=hunter2"));

    const state = await setAsignaturaActivoAction(IDLE, form(OFF));

    expect(state).toEqual({
      kind: "error",
      message: "asignaturas.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expectOneSanitisedLog("hunter2");
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});
