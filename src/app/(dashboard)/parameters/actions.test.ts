import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ParameterFormState } from "@/lib/parameters/form-state";

vi.mock("server-only", () => ({}));

// The guard is the REAL one (`requireParameterAccess` over the real
// `requireRole`), fed by a doubled session source, so a denied role really is
// redirected by the production code. `withCatalogWrite`, the audit event mapper
// and the registry are REAL too: the database handle is a recording stub and the
// audit insert is a spy, so lock order, `toEvents` and the error mapping are
// exercised. The write path (proven in `write.test.ts`), the translator,
// `redirect`, `revalidatePath` and the Managua date are doubles.
const m = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  getSession: vi.fn(),
  getTranslations: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
  write: vi.fn(),
  today: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/auth/cookies", () => ({ getSession: m.getSession }));
vi.mock("next-intl/server", () => ({ getTranslations: m.getTranslations }));
vi.mock("@/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: m.audit }));
vi.mock("@/lib/parameters/write", () => ({ writeParameters: m.write }));
vi.mock("@/lib/intake/dates", async (original) => ({
  ...(await original<object>()),
  managuaToday: m.today,
}));

import { saveScalarParametersAction } from "@/app/(dashboard)/parameters/actions";
import { PARAMETER_REGISTRY } from "@/lib/parameters/registry";

const ACTOR = 41;
const TODAY = "2026-11-27";
const IDLE = { kind: "idle" } as const;
const trace: string[] = [];
const tx = {
  execute: vi.fn(async () => {
    trace.push("lock");
  }),
};

let guardResolved = false;
let reads: string[] = [];
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
    trace.push("guard");
    return session;
  });
}

/** A FormData stand-in whose `get` throws until the guard has resolved: any
 *  read of the body before authorization fails the test (NP-6). Every field
 *  the action asks for is recorded in `reads`. */
function form(fields: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string) => {
      if (!guardResolved) {
        throw new Error(`form field "${key}" read before the guard`);
      }
      trace.push("read");
      reads.push(key);
      return fields[key] ?? null;
    }),
  } as unknown as FormData;
}

const busyError = () =>
  Object.assign(new Error("lock timeout"), { code: "55P03" });

/** What a saved write answers when the double is not told otherwise. */
const UPDATED = {
  kind: "updated",
  changes: [{ clave: "plazo_remision_dias", antes: 2, despues: 3 }],
} as const;

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  trace.length = 0;
  reads = [];
  tx.execute.mockClear();
  m.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  // A translator that echoes the key (and its values): the tests pin WHICH
  // message an action chooses; `parameters-parity.test.ts` pins that every key
  // the action source uses exists in both locales.
  m.getTranslations.mockImplementation(async () => {
    trace.push("translations");
    return (key: string, values?: object) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
  });
  m.today.mockImplementation(() => {
    trace.push("today");
    return TODAY;
  });
  m.transaction.mockImplementation(async (work: (t: typeof tx) => unknown) => {
    trace.push("begin");
    const result = await work(tx);
    trace.push("commit");
    return result;
  });
  m.audit.mockImplementation(async () => {
    trace.push("audit");
  });
  m.write.mockImplementation(async () => {
    trace.push("write");
    return UPDATED;
  });
  guardResolved = false;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  signIn();
});

afterEach(() => consoleError.mockRestore());

function expectNothingWritten() {
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.write).not.toHaveBeenCalled();
  expect(m.audit).not.toHaveBeenCalled();
  expect(m.revalidatePath).not.toHaveBeenCalled();
}

/** Consecutive repeats collapsed: the lock is two statements, a form read is
 *  one per field. */
function order(): string[] {
  return trace.filter((step, index) => step !== trace[index - 1]);
}

type Action = (
  prev: ParameterFormState,
  formData: FormData,
) => Promise<ParameterFormState>;

/**
 * The behaviour every parameter action shares (NP-6, NP-9, NP-AUD-2): the
 * guard before the body, the step order, the actor, the closed field set and
 * the five outcomes. Each action runs it with its own valid form.
 */
function sharedBehaviour(
  action: Action,
  validFields: Record<string, string>,
  expectedChanges: unknown,
) {
  describe("guard (NP-6)", () => {
    it.each([
      ["administrador", "/denied"],
      ["coordinacion", "/denied"],
      ["docente", "/denied"],
      ["estudiante", "/denied"],
      ["anonymous", "/login"],
      ["flagged", "/change-password"],
    ] as const)(
      "sends %s to %s with no body read and no write",
      async (who, destination) => {
        signIn(who);

        await expect(action(IDLE, form(validFields))).rejects.toThrow(
          `REDIRECT:${destination}`,
        );

        expect(reads).toEqual([]);
        expectNothingWritten();
      },
    );

    it("does not let busy bypass the guard: coordinacion gets /denied, never the busy outcome", async () => {
      signIn("coordinacion");
      m.transaction.mockRejectedValue(busyError());

      await expect(action(IDLE, form(validFields))).rejects.toThrow(
        "REDIRECT:/denied",
      );

      expectNothingWritten();
    });
  });

  describe("order and actor", () => {
    it("runs guard, translations, parse, today, then the transaction with the write and its audit row", async () => {
      await action(IDLE, form(validFields));

      expect(order()).toEqual([
        "guard",
        "translations",
        "read",
        "today",
        "begin",
        "lock",
        "write",
        "audit",
        "commit",
      ]);
    });

    it("writes with the Managua date of the request and the closed set of changes", async () => {
      await action(IDLE, form(validFields));

      expect(m.today).toHaveBeenCalledTimes(1);
      expect(m.write).toHaveBeenCalledWith(tx, expectedChanges, TODAY);
    });

    it("reads only its own closed field set, never an actor, a confirmation marker or a stray key", async () => {
      const body = {
        ...validFields,
        actor: "999",
        actorId: "999",
        usuarioId: "999",
        confirmado: "1",
        inventada: "5",
      };

      await action(IDLE, form(body));

      expect(reads.every((key) => key in validFields)).toBe(true);
    });

    it("takes the actor from the session, never from the body", async () => {
      await action(IDLE, form({ ...validFields, actor: "999" }));

      expect(m.audit).toHaveBeenCalledTimes(1);
      expect(m.audit).toHaveBeenCalledWith(tx, ACTOR, expect.any(Array));
    });
  });

  describe("outcomes (NP-9)", () => {
    it("saved: one audit event per applied change and /parameters revalidated; a form with no confirmation field is saved", async () => {
      expect(await action(IDLE, form(validFields))).toEqual({
        kind: "saved",
      });

      expect(m.audit).toHaveBeenCalledWith(tx, ACTOR, [
        expect.objectContaining({
          accion: "parametro.actualizado",
          entidadTipo: "Parametro",
          entidadId: null,
        }),
      ]);
      expect(m.revalidatePath).toHaveBeenCalledTimes(1);
      expect(m.revalidatePath).toHaveBeenCalledWith("/parameters");
      expect(m.redirect).not.toHaveBeenCalled();
    });

    it("unchanged: no audit row, nothing revalidated", async () => {
      m.write.mockResolvedValue({ kind: "unchanged" });

      expect(await action(IDLE, form(validFields))).toEqual({
        kind: "unchanged",
      });

      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    });

    it("invalid from the write: a field error on its key, the values kept, no audit row", async () => {
      m.write.mockResolvedValue({
        kind: "invalid",
        clave: "umbral_reincidencia",
        reason: "schema",
      });

      const state = await action(IDLE, form(validFields));

      expect(state).toEqual({
        kind: "invalid",
        fieldErrors: { umbral_reincidencia: "parameters.errors.invalid" },
        values: validFields,
      });
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    });

    it("busy: its own outcome, nothing revalidated and no audit row", async () => {
      m.transaction.mockRejectedValue(busyError());

      expect(await action(IDLE, form(validFields))).toEqual({ kind: "busy" });

      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    });

    it("unexpected: the generic message, one sanitised log line, nothing revalidated", async () => {
      m.write.mockRejectedValue(new Error("SENTINEL-DB-TEXT"));

      expect(await action(IDLE, form(validFields))).toEqual({
        kind: "error",
        message: "parameters.errors.unexpected",
      });

      expect(m.revalidatePath).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(String(consoleError.mock.calls[0])).not.toContain(
        "SENTINEL-DB-TEXT",
      );
    });
  });
}

// ---- saveScalarParametersAction (unit 18) ----------------------------------

const SCALARS = {
  plazo_remision_dias: "3",
  alerta_dias: "1",
  presentacion_tardia_dias: "2",
  ventana_presentacion_dias: "30",
  umbral_reincidencia: "3",
  tamano_maximo_mib: "10",
};

const SCALAR_CHANGES = [
  { clave: "plazo_remision_dias", valor: 3 },
  { clave: "alerta_dias", valor: 1 },
  { clave: "presentacion_tardia_dias", valor: 2 },
  { clave: "ventana_presentacion_dias", valor: 30 },
  { clave: "umbral_reincidencia", valor: 3 },
  { clave: "tamano_maximo_mib", valor: 10 },
];

describe("saveScalarParametersAction", () => {
  sharedBehaviour(saveScalarParametersAction, SCALARS, SCALAR_CHANGES);

  describe("NP-7: errors together, values kept (table-driven)", () => {
    it.each([
      ["plazo_remision_dias", "", "required", { min: 1, max: 10 }],
      ["ventana_presentacion_dias", "abc", "not_integer", { min: 1, max: 365 }],
      ["tamano_maximo_mib", "11", "too_high", { min: 1, max: 10 }],
      ["umbral_reincidencia", "1", "too_low", { min: 2, max: 20 }],
      ["alerta_dias", "2.5", "not_integer", { min: 0, max: 10 }],
      ["presentacion_tardia_dias", "-1", "too_low", { min: 1, max: 10 }],
      ["ventana_presentacion_dias", "366", "too_high", { min: 1, max: 365 }],
    ] as const)(
      "%s submitted as %j: %s, naming the allowed range, nothing stored",
      async (field, submitted, code, range) => {
        const body = { ...SCALARS, [field]: submitted };

        const state = await saveScalarParametersAction(IDLE, form(body));

        expect(state).toEqual({
          kind: "invalid",
          fieldErrors: {
            [field]: `parameters.errors.${code}:${JSON.stringify(range)}`,
          },
          values: body,
        });
        expectNothingWritten();
      },
    );

    it("a field missing from the body is required", async () => {
      const body = Object.fromEntries(
        Object.entries(SCALARS).filter(
          ([key]) => key !== "umbral_reincidencia",
        ),
      );

      const state = await saveScalarParametersAction(IDLE, form(body));

      expect(state).toMatchObject({
        kind: "invalid",
        fieldErrors: {
          umbral_reincidencia: 'parameters.errors.required:{"min":2,"max":20}',
        },
        values: { ...body, umbral_reincidencia: "" },
      });
      expectNothingWritten();
    });

    it("shows every error at once and keeps every typed value", async () => {
      const body = {
        ...SCALARS,
        plazo_remision_dias: "",
        ventana_presentacion_dias: "abc",
        tamano_maximo_mib: "11",
        umbral_reincidencia: "1",
      };

      const state = await saveScalarParametersAction(IDLE, form(body));

      expect(state).toEqual({
        kind: "invalid",
        fieldErrors: {
          plazo_remision_dias: 'parameters.errors.required:{"min":1,"max":10}',
          ventana_presentacion_dias:
            'parameters.errors.not_integer:{"min":1,"max":365}',
          tamano_maximo_mib: 'parameters.errors.too_high:{"min":1,"max":10}',
          umbral_reincidencia: 'parameters.errors.too_low:{"min":2,"max":20}',
        },
        values: body,
      });
      expectNothingWritten();
    });

    it("states the registry range of every scalar in its messages", async () => {
      for (const [key, entry] of Object.entries(PARAMETER_REGISTRY)) {
        if (!entry.range) continue;
        const state = await saveScalarParametersAction(
          IDLE,
          form({ ...SCALARS, [key]: "x" }),
        );

        expect(state).toMatchObject({
          fieldErrors: {
            [key]: `parameters.errors.not_integer:${JSON.stringify(entry.range)}`,
          },
        });
      }
    });
  });

  describe("closed field set (mass assignment)", () => {
    it("ignores a key outside the six scalars: the registry's other keys and an unknown one change nothing", async () => {
      const body = {
        ...SCALARS,
        calendario: "[]",
        causas: "[]",
        tipo_documento_causa: "{}",
        inventada: "5",
      };

      await saveScalarParametersAction(IDLE, form(body));

      expect(m.write).toHaveBeenCalledWith(tx, SCALAR_CHANGES, TODAY);
      expect(reads).not.toEqual(
        expect.arrayContaining(["calendario", "inventada"]),
      );
    });

    it("a hand-crafted body with only a key outside the six is refused as required fields", async () => {
      const state = await saveScalarParametersAction(
        IDLE,
        form({ calendario: "[]", inventada: "5" }),
      );

      expect(state).toMatchObject({ kind: "invalid" });
      expectNothingWritten();
    });
  });

  describe("the alert stays below the remission deadline (NP-2, A16)", () => {
    it("shows the refusal on the field the write names and writes nothing", async () => {
      m.write.mockResolvedValue({
        kind: "invalid",
        clave: "alerta_dias",
        reason: "alert_not_below_remission",
      });
      const body = { ...SCALARS, plazo_remision_dias: "2", alerta_dias: "2" };

      const state = await saveScalarParametersAction(IDLE, form(body));

      expect(state).toEqual({
        kind: "invalid",
        fieldErrors: {
          alerta_dias: "parameters.errors.alert_not_below_remission",
        },
        values: body,
      });
      expect(m.audit).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    });
  });
});

describe("the action module", () => {
  it("is a use-server module whose guard is the first await and whose source has no try around a redirect", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/parameters/actions.ts"),
      "utf8",
    );

    expect(source.startsWith('"use server";')).toBe(true);
    for (const body of source.split("export async function").slice(1)) {
      expect(body.slice(body.indexOf("await "))).toMatch(
        /^await requireParameterAccess\(\)/,
      );
    }
    expect(source).not.toMatch(/redirect\(/);
  });
});
