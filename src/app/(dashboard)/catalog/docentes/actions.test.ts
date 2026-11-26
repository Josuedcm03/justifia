import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActiveToggleState, CatalogFormState } from "@/lib/catalog/types";

vi.mock("server-only", () => ({}));

// The guard is the REAL one (`requireDocenteAccess` over the real `requireRole`),
// fed by a doubled session source, so a denied role really is redirected by the
// production code. `withCatalogWrite` and the audit event mapper are REAL too:
// the database handle is a recording stub and the audit insert is a spy, so lock
// order, `toEvents` and the error mapping are exercised. The data layer, the
// translator, `redirect` and `revalidatePath` are doubles.
const m = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  getSession: vi.fn(),
  getTranslations: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  setActivo: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/auth/cookies", () => ({ getSession: m.getSession }));
vi.mock("next-intl/server", () => ({
  getTranslations: m.getTranslations,
}));
vi.mock("@/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: m.audit }));
vi.mock("@/lib/data/docentes", () => ({
  getDocenteById: m.getById,
  updateDocente: m.update,
  setDocenteActivo: m.setActivo,
}));

import {
  setDocenteActivoAction,
  updateDocenteAction,
} from "@/app/(dashboard)/catalog/docentes/actions";

const ACTOR = 41;
const IDLE = { kind: "idle" } as const;
const trace: string[] = [];
const tx = {
  execute: vi.fn(async () => {
    trace.push("lock");
  }),
};

let guardResolved = false;
let consoleError: ReturnType<typeof vi.spyOn>;

type Who =
  | "secretaria"
  | "administrador"
  | "coordinacion"
  | "docente"
  | "estudiante"
  | "anonymous"
  | "flagged";

/** The session source the real guard reads. Resolving it is "the guard ran". */
function signIn(who: Who = "secretaria", sub = String(ACTOR)) {
  const session =
    who === "anonymous"
      ? null
      : {
          sub,
          login: "caller",
          rol: who === "flagged" ? "secretaria" : who,
          nombre: "Caller",
          ...(who === "flagged" ? { debeCambiarClave: true as const } : {}),
        };
  m.getSession.mockImplementation(async () => {
    await Promise.resolve();
    guardResolved = true;
    return session;
  });
}

/** A FormData stand-in whose `get` throws until the guard has resolved: any
 *  read of the body before authorization fails the test (DM-1). */
function form(fields: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string) => {
      if (!guardResolved)
        throw new Error(`form field "${key}" read before the guard`);
      return fields[key] ?? null;
    }),
  } as unknown as FormData;
}

const busyError = () =>
  Object.assign(new Error("lock timeout"), { code: "55P03" });

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  trace.length = 0;
  tx.execute.mockClear();
  m.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  // A translator that echoes the key (and its values): the tests pin WHICH
  // message an action chooses; `catalog-parity.test.ts` pins that every key the
  // action source uses exists in both locales.
  m.getTranslations.mockImplementation(
    async () => (key: string, values?: object) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  );
  m.transaction.mockImplementation(async (work: (t: typeof tx) => unknown) => {
    trace.push("begin");
    const result = await work(tx);
    trace.push("commit");
    return result;
  });
  m.audit.mockImplementation(async () => {
    trace.push("audit");
  });
  guardResolved = false;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  signIn();
});

afterEach(() => consoleError.mockRestore());

function expectNothingWritten() {
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.audit).not.toHaveBeenCalled();
  expect(m.revalidatePath).not.toHaveBeenCalled();
  expect(m.redirect).not.toHaveBeenCalled();
}

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

const DETAIL = {
  id: 12,
  nombreCompleto: "Ana Perez",
  correo: "ana@uni.edu",
  telefono: "555-0100",
  activo: true,
  gruposActivos: 0,
};
const BAD_IDS = [undefined, "", "abc", "0", "007", "-1", "1.5", " 12", "1e3"];

// DM-6 / design "Actions": the list and the edit page of the record, the Users
// list, the Asignaturas list and the three pages that read docente names. A
// pattern with a dynamic segment needs its `type`, a literal path omits it.
const REVALIDATED = [
  ["/catalog/docentes"],
  ["/catalog/docentes/12/edit"],
  ["/users"],
  ["/catalog/asignaturas"],
  ["/catalog/asignaturas/[id]/edit", "page"],
  ["/catalog/asignaturas/[id]/grupos/new", "page"],
  ["/catalog/asignaturas/[id]/grupos/[grupoId]/edit", "page"],
];

const DENIED = [
  ["administrador", "/denied"],
  ["coordinacion", "/denied"],
  ["docente", "/denied"],
  ["estudiante", "/denied"],
  ["anonymous", "/login"],
  ["flagged", "/change-password"],
] as const;

describe("updateDocenteAction", () => {
  const VALID = {
    id: "12",
    nombreCompleto: "Ana Maria Perez",
    correo: "ana.perez@uni.edu",
    telefono: "555-0199",
  };

  beforeEach(() => {
    m.getById.mockResolvedValue(DETAIL);
  });

  it.each(DENIED)(
    "%s is redirected to %s with no field read, no translation, no lookup and no write",
    async (who, destination) => {
      signIn(who);
      const fd = form(VALID);

      await expect(updateDocenteAction(IDLE, fd)).rejects.toThrow(
        `REDIRECT:${destination}`,
      );

      expect(fd.get).not.toHaveBeenCalled();
      expect(m.getTranslations).not.toHaveBeenCalled();
      expect(m.getById).not.toHaveBeenCalled();
      expect(m.update).not.toHaveBeenCalled();
      expect(m.transaction).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("a coordinacion with a valid form is denied and writes no row (DM-1)", async () => {
    signIn("coordinacion");
    m.update.mockResolvedValue({ kind: "updated", id: 12, campos: ["correo"] });

    await expect(updateDocenteAction(IDLE, form(VALID))).rejects.toThrow(
      "REDIRECT:/denied",
    );

    expect(m.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("busy does not bypass the guard: a denied caller is never told the catalog is busy", async () => {
    signIn("coordinacion");
    m.transaction.mockRejectedValue(busyError());

    await expect(updateDocenteAction(IDLE, form(VALID))).rejects.toThrow(
      "REDIRECT:/denied",
    );

    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("runs in the design order: guard, translations, pre-check, schema, write", async () => {
    m.update.mockResolvedValue({ kind: "unchanged", id: 12 });
    const at = (fn: ReturnType<typeof vi.fn>) => fn.mock.invocationCallOrder[0];

    await updateDocenteAction(IDLE, form(VALID));

    expect(at(m.getSession)).toBeLessThan(at(m.getTranslations));
    expect(at(m.getTranslations)).toBeLessThan(at(m.getById));
    expect(at(m.getById)).toBeLessThan(at(m.transaction));
    expect(trace).toEqual(["begin", "lock", "lock", "commit"]);
  });

  it("the schema runs after the pre-check: an invalid form for a missing docente is gone, not invalid", async () => {
    m.getById.mockResolvedValue(null);

    const state = await updateDocenteAction(
      IDLE,
      form({ ...VALID, nombreCompleto: "", correo: "nope" }),
    );

    expect(state).toEqual({ kind: "gone" } satisfies CatalogFormState);
    expectNothingWritten();
  });

  it.each(BAD_IDS.map((id) => [String(id), id] as const))(
    "a bad record id (%s) answers gone without reading or writing",
    async (_label, id) => {
      const state = await updateDocenteAction(IDLE, form({ ...VALID, id }));

      expect(state).toEqual({ kind: "gone" } satisfies CatalogFormState);
      expect(m.getById).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("the pre-check reads by the id alone", async () => {
    m.update.mockResolvedValue({ kind: "unchanged", id: 12 });

    await updateDocenteAction(IDLE, form(VALID));

    expect(m.getById.mock.calls).toEqual([[12]]);
  });

  it("another role's id and a missing id are the identical gone, without the lock", async () => {
    m.getById.mockResolvedValue(null);
    m.transaction.mockRejectedValue(busyError());

    const other = await updateDocenteAction(IDLE, form(VALID));
    const missing = await updateDocenteAction(
      IDLE,
      form({ ...VALID, id: "99999" }),
    );

    expect(other).toEqual({ kind: "gone" });
    expect(missing).toEqual(other);
    expect(m.update).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("pre-check read failure: generic error, one sanitised log line, nothing written", async () => {
    m.getById.mockRejectedValue(new Error("select failed password=hunter2"));

    const state = await updateDocenteAction(IDLE, form(VALID));

    expect(state).toEqual({
      kind: "error",
      message: "docentes.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expectOneSanitisedLog("hunter2");
    expect(m.update).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    [
      "empty name",
      { nombreCompleto: "" },
      { nombreCompleto: "shared.fieldErrors.nombre.required" },
    ],
    [
      "name of 161 characters",
      { nombreCompleto: "N".repeat(161) },
      { nombreCompleto: "shared.fieldErrors.nombre.tooLong" },
    ],
    [
      "empty email",
      { correo: "" },
      { correo: "shared.fieldErrors.correo.required" },
    ],
    [
      "invalid email",
      { correo: "not-an-email" },
      { correo: "shared.fieldErrors.correo.invalid" },
    ],
    [
      "email of 161 characters",
      { correo: `${"a".repeat(153)}@uni.edu` },
      { correo: "shared.fieldErrors.correo.tooLong" },
    ],
    [
      "phone of 31 characters",
      { telefono: "5".repeat(31) },
      { telefono: "shared.fieldErrors.telefono.tooLong" },
    ],
  ])(
    "invalid input (%s) -> translated field error, no write",
    async (_n, over, errors) => {
      const state = await updateDocenteAction(
        IDLE,
        form({ ...VALID, ...over }),
      );

      expect(state).toEqual({ kind: "invalid", fieldErrors: errors });
      expect(m.update).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("reports every invalid field at once", async () => {
    const state = await updateDocenteAction(
      IDLE,
      form({
        id: "12",
        nombreCompleto: "   ",
        correo: "a b@uni.edu",
        telefono: "5".repeat(31),
      }),
    );

    expect(state).toEqual({
      kind: "invalid",
      fieldErrors: {
        nombreCompleto: "shared.fieldErrors.nombre.required",
        correo: "shared.fieldErrors.correo.invalid",
        telefono: "shared.fieldErrors.telefono.tooLong",
      },
    });
    expectNothingWritten();
  });

  it("mass assignment: login, hashClave, rol, activo, cif, carreraId, facultadId and debeCambiarClave never reach the data layer", async () => {
    m.update.mockResolvedValue({
      kind: "updated",
      id: 12,
      campos: ["nombreCompleto"],
    });
    const fd = form({
      ...VALID,
      login: "evil",
      hashClave: "$2a$12$evil",
      rol: "administrador",
      activo: "false",
      cif: "1",
      carreraId: "3",
      facultadId: "2",
      debeCambiarClave: "true",
    });

    await expect(updateDocenteAction(IDLE, fd)).rejects.toThrow("REDIRECT:");

    expect(m.update).toHaveBeenCalledExactlyOnceWith(tx, 12, {
      nombreCompleto: "Ana Maria Perez",
      correo: "ana.perez@uni.edu",
      telefono: "555-0199",
    });
    // The action does not even read a field outside the four it names.
    const read = (fd.get as ReturnType<typeof vi.fn>).mock.calls.map(
      ([key]) => key,
    );
    expect(new Set(read)).toEqual(
      new Set(["id", "nombreCompleto", "correo", "telefono"]),
    );
  });

  it("hands the data layer the normalised values: trimmed name, lower-case email, blank phone as null", async () => {
    m.update.mockResolvedValue({ kind: "unchanged", id: 12 });

    await updateDocenteAction(
      IDLE,
      form({
        id: "12",
        nombreCompleto: "  Ana  Perez ",
        correo: " Ana.Perez@UNI.edu ",
        telefono: "   ",
      }),
    );

    expect(m.update).toHaveBeenCalledWith(tx, 12, {
      nombreCompleto: "Ana  Perez",
      correo: "ana.perez@uni.edu",
      telefono: null,
    });
  });

  it("updated: revalidates exactly the record, the lists and the three pages, then redirects outside any try", async () => {
    m.update.mockResolvedValue({
      kind: "updated",
      id: 12,
      campos: ["nombreCompleto", "correo"],
    });

    await expect(updateDocenteAction(IDLE, form(VALID))).rejects.toThrow(
      "REDIRECT:/catalog/docentes",
    );

    expect(m.revalidatePath.mock.calls).toEqual(REVALIDATED);
    expect(
      m.revalidatePath.mock.invocationCallOrder[REVALIDATED.length - 1],
    ).toBeLessThan(m.redirect.mock.invocationCallOrder[0]);
    expect(m.redirect).toHaveBeenCalledExactlyOnceWith("/catalog/docentes");
  });

  it("updated: one manual event of field names in the same transaction, after the write", async () => {
    m.update.mockImplementation(async () => {
      trace.push("write");
      return { kind: "updated", id: 12, campos: ["correo", "telefono"] };
    });

    await expect(updateDocenteAction(IDLE, form(VALID))).rejects.toThrow(
      "REDIRECT:",
    );

    expect(trace).toEqual([
      "begin",
      "lock",
      "lock",
      "write",
      "audit",
      "commit",
    ]);
    expect(m.audit).toHaveBeenCalledOnce();
    const [handle, actor, events] = m.audit.mock.calls[0];
    expect(handle).toBe(tx);
    expect(actor).toBe(ACTOR);
    expect(events).toEqual([
      {
        accion: "usuario.actualizado",
        entidadTipo: "Usuario",
        entidadId: 12,
        datos: {
          campos: ["correo", "telefono"],
          rol: "docente",
          origen: "manual",
        },
      },
    ]);
    const payload = JSON.stringify(events);
    for (const value of [
      "Ana Perez",
      "Ana Maria Perez",
      "ana@uni.edu",
      "ana.perez@uni.edu",
      "555-0100",
      "555-0199",
    ]) {
      expect(payload).not.toContain(value);
    }
  });

  it("the actor is the session user, never a value of the body", async () => {
    signIn("secretaria", "77");
    m.update.mockResolvedValue({
      kind: "updated",
      id: 12,
      campos: ["telefono"],
    });

    await expect(
      updateDocenteAction(
        IDLE,
        form({ ...VALID, actorId: "999", actor: "999", usuarioId: "999" }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(m.audit).toHaveBeenCalledWith(tx, 77, expect.any(Array));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("unchanged: told as unchanged, no revalidate, no redirect, no audit row", async () => {
    m.update.mockResolvedValue({ kind: "unchanged", id: 12 });

    const state = await updateDocenteAction(IDLE, form(VALID));

    expect(state).toEqual({ kind: "unchanged" } satisfies CatalogFormState);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("an inactive docente is refused as inactive (reactivate it first), nothing written", async () => {
    m.getById.mockResolvedValue({ ...DETAIL, activo: false });
    m.update.mockResolvedValue({ kind: "inactive" });

    const state = await updateDocenteAction(IDLE, form(VALID));

    expect(state).toEqual({ kind: "inactive" } satisfies CatalogFormState);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("re-validation inside the transaction: a docente gone by then is the identical gone", async () => {
    m.getById.mockResolvedValue(null);
    const pre = await updateDocenteAction(IDLE, form(VALID));
    signIn();
    guardResolved = false;
    m.getById.mockResolvedValue(DETAIL);
    m.update.mockResolvedValue({ kind: "not_found" });

    const inside = await updateDocenteAction(IDLE, form(VALID));

    expect(inside).toEqual(pre);
    expect(inside).toEqual({ kind: "gone" });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("correo_taken: one generic field error on correo, naming no account, role or state; no audit row", async () => {
    m.update.mockResolvedValue({ kind: "correo_taken" });

    const state = await updateDocenteAction(IDLE, form(VALID));

    expect(state).toEqual({
      kind: "invalid",
      fieldErrors: { correo: "shared.fieldErrors.correo.taken" },
    });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("busy: a lock timeout is `busy`, not `error`, with no trace, revalidate or redirect", async () => {
    m.update.mockRejectedValue(busyError());

    const state = await updateDocenteAction(IDLE, form(VALID));

    expect(state).toEqual({ kind: "busy" } satisfies CatalogFormState);
    expect(consoleError).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("unexpected error: generic message without the thrown text, one sanitised log line", async () => {
    m.update.mockRejectedValue(new Error("update failed password=hunter2"));

    const state = await updateDocenteAction(IDLE, form(VALID));

    expect(state).toEqual({
      kind: "error",
      message: "docentes.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expectOneSanitisedLog("hunter2");
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("an audit failure rejects the whole write: generic error, nothing revalidated", async () => {
    m.update.mockResolvedValue({ kind: "updated", id: 12, campos: ["correo"] });
    m.audit.mockRejectedValue(
      new Error("audit insert failed password=hunter2"),
    );

    const state = await updateDocenteAction(IDLE, form(VALID));

    expect(state).toEqual({
      kind: "error",
      message: "docentes.errors.unexpected",
    });
    expectOneSanitisedLog("hunter2");
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });
});

describe("setDocenteActivoAction", () => {
  const OFF = { id: "12", intent: "deactivate" };
  const ON = { id: "12", intent: "reactivate" };

  beforeEach(() => {
    m.getById.mockResolvedValue(DETAIL);
  });

  it("is a Server Action module: POST-only entry points, no GET handler, only async functions", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/catalog/docentes/actions.ts"),
      "utf8",
    );

    expect(source.startsWith('"use server"')).toBe(true);
    expect(source).not.toMatch(/export (async )?function GET\b/);
    expect(source).not.toMatch(/^export (?!async function )/m);
    expect(
      [...source.matchAll(/^export async function (\w+)/gm)].map((x) => x[1]),
    ).toEqual(["updateDocenteAction", "setDocenteActivoAction"]);
  });

  it.each(DENIED)(
    "%s is redirected to %s with no field read, no translation, no lookup and no write",
    async (who, destination) => {
      signIn(who);
      const fd = form(OFF);

      await expect(setDocenteActivoAction(IDLE, fd)).rejects.toThrow(
        `REDIRECT:${destination}`,
      );

      expect(fd.get).not.toHaveBeenCalled();
      expect(m.getTranslations).not.toHaveBeenCalled();
      expect(m.getById).not.toHaveBeenCalled();
      expect(m.setActivo).not.toHaveBeenCalled();
      expect(m.transaction).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("busy does not bypass the guard", async () => {
    signIn("administrador");
    m.transaction.mockRejectedValue(busyError());

    await expect(setDocenteActivoAction(IDLE, form(OFF))).rejects.toThrow(
      "REDIRECT:/denied",
    );

    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("runs in the design order: guard, translations, intent, pre-check, write", async () => {
    m.setActivo.mockResolvedValue({ kind: "unchanged", id: 12 });
    const at = (fn: ReturnType<typeof vi.fn>) => fn.mock.invocationCallOrder[0];
    const fd = form(OFF);

    await setDocenteActivoAction(IDLE, fd);

    expect(at(m.getSession)).toBeLessThan(at(m.getTranslations));
    expect(at(m.getTranslations)).toBeLessThan(at(m.getById));
    expect(at(m.getById)).toBeLessThan(at(m.transaction));
    const keys = (fd.get as ReturnType<typeof vi.fn>).mock.calls.map(
      ([key]) => key,
    );
    expect(keys).toEqual(["intent", "id"]);
  });

  it.each([
    [undefined],
    [""],
    ["delete"],
    ["DEACTIVATE"],
    ["Reactivate"],
    ["true"],
    ["false"],
    ["toggle"],
  ])(
    "an unknown intent (%s) answers gone and writes nothing",
    async (intent) => {
      const state = await setDocenteActivoAction(
        IDLE,
        form({ id: "12", intent }),
      );

      expect(state).toEqual({ kind: "gone" } satisfies ActiveToggleState);
      expect(m.getById).not.toHaveBeenCalled();
      expect(m.setActivo).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it.each(BAD_IDS.map((id) => [String(id), id] as const))(
    "a bad record id (%s) answers gone without reading or writing",
    async (_label, id) => {
      const state = await setDocenteActivoAction(IDLE, form({ ...OFF, id }));

      expect(state).toEqual({ kind: "gone" } satisfies ActiveToggleState);
      expect(m.getById).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("another role's id is gone: nothing written, even while the catalog is busy", async () => {
    m.getById.mockResolvedValue(null);
    m.transaction.mockRejectedValue(busyError());

    const state = await setDocenteActivoAction(IDLE, form(OFF));

    expect(state).toEqual({ kind: "gone" });
    expect(m.getById.mock.calls).toEqual([[12]]);
    expect(m.setActivo).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("pre-check read failure: generic error, one sanitised log line, nothing written", async () => {
    m.getById.mockRejectedValue(new Error("select failed password=hunter2"));

    const state = await setDocenteActivoAction(IDLE, form(OFF));

    expect(state).toEqual({
      kind: "error",
      message: "docentes.errors.unexpected",
    });
    expectOneSanitisedLog("hunter2");
    expect(m.setActivo).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["deactivate", OFF, false, "usuario.desactivado"],
    ["reactivate", ON, true, "usuario.reactivado"],
  ])(
    "%s changes the state, audits one manual event of names only and revalidates the record and its readers",
    async (_name, fields, activo, accion) => {
      m.setActivo.mockImplementation(async () => {
        trace.push("write");
        return { kind: "changed", id: 12, activo };
      });

      const state = await setDocenteActivoAction(IDLE, form(fields));

      expect(state).toEqual({ kind: "done", activo });
      expect(m.setActivo).toHaveBeenCalledExactlyOnceWith(tx, 12, activo);
      expect(trace).toEqual([
        "begin",
        "lock",
        "lock",
        "write",
        "audit",
        "commit",
      ]);
      expect(m.revalidatePath.mock.calls).toEqual(REVALIDATED);
      expect(m.redirect).not.toHaveBeenCalled();
      expect(m.audit).toHaveBeenCalledOnce();
      const [handle, actor, events] = m.audit.mock.calls[0];
      expect(handle).toBe(tx);
      expect(actor).toBe(ACTOR);
      expect(events).toEqual([
        {
          accion,
          entidadTipo: "Usuario",
          entidadId: 12,
          datos: { campos: ["activo"], rol: "docente", origen: "manual" },
        },
      ]);
    },
  );

  it("the actor is the session user and a crafted `activo` or actor field is ignored", async () => {
    signIn("secretaria", "77");
    m.setActivo.mockResolvedValue({ kind: "changed", id: 12, activo: false });

    await setDocenteActivoAction(
      IDLE,
      form({ ...OFF, actorId: "999", actor: "999", activo: "true" }),
    );

    expect(m.setActivo).toHaveBeenCalledWith(tx, 12, false);
    expect(m.audit).toHaveBeenCalledWith(tx, 77, expect.any(Array));
  });

  it.each([
    ["deactivate", OFF],
    ["reactivate", ON],
  ])(
    "%s of a docente already in that state is told as unchanged: no audit row, no revalidate",
    async (_name, fields) => {
      m.setActivo.mockResolvedValue({ kind: "unchanged", id: 12 });

      const state = await setDocenteActivoAction(IDLE, form(fields));

      expect(state).toEqual({ kind: "unchanged" } satisfies ActiveToggleState);
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it.each([1, 3])(
    "active grupos (%i): refused with the count, no audit row, no revalidate",
    async (count) => {
      m.setActivo.mockResolvedValue({ kind: "has_active_groups", count });

      const state = await setDocenteActivoAction(IDLE, form(OFF));

      expect(state).toEqual({
        kind: "error",
        message: `docentes.errors.activeGrupos:{"count":${count}}`,
      });
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("re-validation inside the transaction: a docente gone by then is the identical gone", async () => {
    m.setActivo.mockResolvedValue({ kind: "not_found" });

    const state = await setDocenteActivoAction(IDLE, form(OFF));

    expect(state).toEqual({ kind: "gone" });
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("busy: a lock timeout is `busy`, not `error`, with no trace and no revalidate", async () => {
    m.setActivo.mockRejectedValue(busyError());

    const state = await setDocenteActivoAction(IDLE, form(OFF));

    expect(state).toEqual({ kind: "busy" } satisfies ActiveToggleState);
    expect(consoleError).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("unexpected error: generic message without the thrown text, one sanitised log line", async () => {
    m.setActivo.mockRejectedValue(new Error("update failed password=hunter2"));

    const state = await setDocenteActivoAction(IDLE, form(OFF));

    expect(state).toEqual({
      kind: "error",
      message: "docentes.errors.unexpected",
    });
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expectOneSanitisedLog("hunter2");
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});
