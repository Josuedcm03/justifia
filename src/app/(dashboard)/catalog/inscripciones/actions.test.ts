// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import type { RequestScope } from "@/lib/intake/request-scope";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

// The REAL guard (`requireEnrollmentAccess`) and the REAL dal run on a mocked
// session source and a mocked scope read, so the guard order is the production
// one. The writers are doubles: this suite proves what the action hands them.
const h = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSession: vi.fn(),
  resolveScope: vi.fn(),
  revalidatePath: vi.fn(),
  staffDropGroup: vi.fn(),
  staffEnrollInGroup: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
// A translator that echoes the key: the tests pin WHICH message an action
// chooses, not its text.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/auth/cookies", () => ({ getSession: h.getSession }));
vi.mock("@/lib/data/request-scope", () => ({
  resolveRequestScope: h.resolveScope,
}));
vi.mock("@/lib/data/enrollment-write", () => ({
  staffDropGroup: h.staffDropGroup,
  staffEnrollInGroup: h.staffEnrollInGroup,
}));

import { assignInscripcionAction, setInscripcionActivoAction } from "./actions";

const ACTOR = 41;
const STUDENT = 7;
const GROUP = 5;
const FACULTAD: RequestScope = { kind: "facultad", facultadId: 3 };
const NONE: RequestScope = { kind: "none" };
const IDLE = { kind: "idle" } as const;
const PATH = "/catalog/inscripciones";
const BOUND = { estudianteId: STUDENT };

function session(rol: string, extra: Record<string, unknown> = {}) {
  return { sub: String(ACTOR), login: "sec", rol, nombre: "Sec", ...extra };
}

let guardResolved = false;

type Fields = Record<string, string | undefined>;

/** A FormData stand-in whose `get` throws until the guard has resolved, and
 *  that records every key read (CM-ACC-2: nothing of the body before the
 *  guard). */
function form(fields: Fields) {
  const get = vi.fn((key: string) => {
    if (!guardResolved) {
      throw new Error(`form field "${key}" read before the guard`);
    }
    return fields[key] ?? null;
  });
  return { get, data: { get } as unknown as FormData };
}

const deactivate = (id = String(GROUP)): Fields => ({
  id,
  intent: "deactivate",
});
const reactivate = (id = String(GROUP)): Fields => ({
  id,
  intent: "reactivate",
});

/** The action as the table binds it: `.bind(null, estudianteId)`. */
function run(fields: Fields, bound: { estudianteId: unknown } = BOUND) {
  const action = setInscripcionActivoAction.bind(
    null,
    bound.estudianteId as number,
  );
  return action(IDLE, form(fields).data);
}

function expectNothingWritten() {
  expect(h.staffDropGroup).not.toHaveBeenCalled();
  expect(h.staffEnrollInGroup).not.toHaveBeenCalled();
  expect(h.revalidatePath).not.toHaveBeenCalled();
}

beforeEach(() => {
  for (const mock of Object.values(h)) mock.mockReset();
  guardResolved = false;
  h.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  h.getSession.mockResolvedValue(session("secretaria"));
  h.resolveScope.mockImplementation(async () => {
    await Promise.resolve();
    guardResolved = true;
    return FACULTAD;
  });
  h.staffDropGroup.mockResolvedValue({ ok: true, grupoId: GROUP });
  h.staffEnrollInGroup.mockResolvedValue({
    ok: true,
    kind: "reactivated",
    grupoId: GROUP,
    replaced: [],
  });
});

describe("setInscripcionActivoAction access (EA-ACC-1)", () => {
  const denied: [string, () => void, string][] = [
    ...rolesUsuario
      .filter((rol) => rol !== "secretaria")
      .map((rol): [string, () => void, string] => [
        rol,
        () => h.getSession.mockResolvedValue(session(rol)),
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      ]),
    [
      "anonymous",
      () => h.getSession.mockResolvedValue(null),
      "REDIRECT:/login",
    ],
    [
      "secretaria with a pending password change",
      () =>
        h.getSession.mockResolvedValue(
          session("secretaria", { debeCambiarClave: true }),
        ),
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    ],
  ];

  it("covers the six denied identities of the spec table", () => {
    expect(denied).toHaveLength(6);
  });

  it.each(denied)(
    "denies %s before reading the scope or the payload, on both intents",
    async (_identity, arrange, destination) => {
      for (const fields of [deactivate(), reactivate()]) {
        arrange();

        await expect(run(fields)).rejects.toThrow(destination);
      }

      expect(h.resolveScope).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("takes the actor and the scope from the session, never from the payload", async () => {
    const forged = {
      ...deactivate(),
      actorId: "99",
      estudianteId: "99",
      scope: "all",
    };
    const body = form(forged);

    await setInscripcionActivoAction.bind(null, STUDENT)(IDLE, body.data);

    expect(h.staffDropGroup).toHaveBeenCalledTimes(1);
    expect(h.staffDropGroup).toHaveBeenCalledWith(
      { actorId: ACTOR, scope: FACULTAD },
      STUDENT,
      GROUP,
    );
    // Only the group id and the closed intent are read from the form.
    expect(body.get.mock.calls.map(([key]) => key).sort()).toEqual([
      "id",
      "intent",
    ]);
  });

  it("hands the writer exactly the two guard fields, no session object", async () => {
    await run(reactivate());

    const [staff] = h.staffEnrollInGroup.mock.calls[0];
    expect(Object.keys(staff).sort()).toEqual(["actorId", "scope"]);
  });
});

describe("setInscripcionActivoAction input (EA-SCOPE-1, CS-9)", () => {
  it.each([
    ["no id", {}],
    ["an empty id", { id: "" }],
    ["a zero id", { id: "0" }],
    ["a negative id", { id: "-3" }],
    ["a decimal id", { id: "1.5" }],
    ["a text id", { id: "abc" }],
    ["an oversize id", { id: "1".repeat(20) }],
  ])("refuses %s with the error copy and writes nothing", async (_l, base) => {
    for (const intent of ["deactivate", "reactivate"]) {
      await expect(run({ ...base, intent })).resolves.toEqual({
        kind: "error",
        message: "inscripciones.errors.unexpected",
      });
    }

    expectNothingWritten();
  });

  it.each([
    ["zero", 0],
    ["a negative", -1],
    ["a decimal", 1.5],
    ["a string", "7"],
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
  ])(
    "re-validates a forged bound student id (%s) and writes nothing",
    async (_label, forged) => {
      await expect(
        run(deactivate(), { estudianteId: forged }),
      ).resolves.toEqual({
        kind: "error",
        message: "inscripciones.errors.unexpected",
      });
      await expect(
        run(reactivate(), { estudianteId: forged }),
      ).resolves.toEqual({
        kind: "error",
        message: "inscripciones.errors.unexpected",
      });

      expectNothingWritten();
    },
  );

  it.each([undefined, "", "toggle", "DEACTIVATE", "delete"])(
    "answers gone to the intent %j and writes nothing",
    async (intent) => {
      await expect(run({ id: "5", intent })).resolves.toEqual({
        kind: "gone",
      });

      expectNothingWritten();
    },
  );

  it("answers gone to a scope with no facultad and never calls a writer", async () => {
    h.resolveScope.mockImplementation(async () => {
      guardResolved = true;
      return NONE;
    });

    await expect(run(deactivate())).resolves.toEqual({ kind: "gone" });
    await expect(run(reactivate())).resolves.toEqual({ kind: "gone" });

    expectNothingWritten();
  });
});

describe("setInscripcionActivoAction deactivate (EA-DEACT-1)", () => {
  it("drops through the staff writer only and revalidates the list once", async () => {
    await expect(run(deactivate())).resolves.toEqual({
      kind: "done",
      activo: false,
    });

    expect(h.staffDropGroup).toHaveBeenCalledTimes(1);
    expect(h.staffEnrollInGroup).not.toHaveBeenCalled();
    expect(h.revalidatePath).toHaveBeenCalledTimes(1);
    expect(h.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("maps not_enrolled to unchanged without revalidating", async () => {
    h.staffDropGroup.mockResolvedValue({ ok: false, reason: "not_enrolled" });

    await expect(run(deactivate())).resolves.toEqual({ kind: "unchanged" });

    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps not_student (out of scope, unknown) to gone without revalidating", async () => {
    h.staffDropGroup.mockResolvedValue({ ok: false, reason: "not_student" });

    await expect(run(deactivate())).resolves.toEqual({ kind: "gone" });

    expect(h.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setInscripcionActivoAction reactivate (EA-REACT-1)", () => {
  it("reactivates through the staff writer only and revalidates once", async () => {
    await expect(run(reactivate())).resolves.toEqual({
      kind: "done",
      activo: true,
    });

    expect(h.staffEnrollInGroup).toHaveBeenCalledTimes(1);
    // Exactly three arguments, no option: the writer's default is reactivate
    // only, and the replace is the assign page's confirmed flow (EA-SIB-1).
    expect(h.staffEnrollInGroup).toHaveBeenCalledWith(
      { actorId: ACTOR, scope: FACULTAD },
      STUDENT,
      GROUP,
    );
    expect(h.staffDropGroup).not.toHaveBeenCalled();
    expect(h.revalidatePath).toHaveBeenCalledTimes(1);
    expect(h.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it.each(["not_eligible", "already_enrolled"] as const)(
    "maps the %s refusal to its error copy without revalidating",
    async (reason) => {
      h.staffEnrollInGroup.mockResolvedValue({ ok: false, reason });

      await expect(run(reactivate())).resolves.toEqual({
        kind: "error",
        message: `inscripciones.errors.${reason}`,
      });

      expect(h.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("maps not_student to gone without revalidating", async () => {
    h.staffEnrollInGroup.mockResolvedValue({
      ok: false,
      reason: "not_student",
    });

    await expect(run(reactivate())).resolves.toEqual({ kind: "gone" });

    expect(h.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setInscripcionActivoAction failure (EA-WRITE-1)", () => {
  it.each([
    ["deactivate", () => h.staffDropGroup, deactivate],
    ["reactivate", () => h.staffEnrollInGroup, reactivate],
  ] as const)(
    "turns a thrown %s writer error into the unexpected copy, with no revalidate and no raw text",
    async (_intent, writer, fields) => {
      writer().mockRejectedValue(new Error("connection refused 10.0.0.1"));

      const answer = await run(fields());

      expect(answer).toEqual({
        kind: "error",
        message: "inscripciones.errors.unexpected",
      });
      expect(JSON.stringify(answer)).not.toContain("10.0.0.1");
      expect(h.revalidatePath).not.toHaveBeenCalled();
    },
  );
});

// ---------------------------------------------------------------------------
// assignInscripcionAction (EA-CRE-1, EA-CHG-1, EA-SIB-1, EA-ACC-1, EA-SCOPE-1,
// CS-9). The client calls it as `(estudianteId, grupoId, expectedReplaced)`
// after its own confirmation step (S3b-2): the third argument is the group the
// user saw and confirmed as replaced (or null). All three are client-visible,
// so the action authorizes first and re-validates them, and the writer refuses
// a replace that no longer matches (the optimistic check).
// ---------------------------------------------------------------------------

/** The opt-in the action hands the writer when the user saw no replaced group. */
const FULL = { allowReplaceAndCreate: true, expectedReplaced: null };
const REPLACING = (expectedReplaced: number) => ({
  allowReplaceAndCreate: true,
  expectedReplaced,
});
const STAFF = { actorId: ACTOR, scope: FACULTAD };

/** The action as the client calls it. Forged values are typed away on purpose. */
function assign(
  ...args: [] | [student: unknown, group: unknown, expectedReplaced: unknown]
) {
  // No defaults: a default parameter would swallow a forged `undefined`.
  const [student, group, expected] =
    args.length === 3 ? args : [STUDENT, GROUP, null];
  return assignInscripcionAction(
    student as number,
    group as number,
    expected as number | null,
  );
}

const BAD_IDS: [string, unknown][] = [
  ["zero", 0],
  ["a negative", -1],
  ["a decimal", 1.5],
  ["a numeric string", "5"],
  ["null", null],
  ["undefined", undefined],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["an object", { id: 5, actorId: 99 }],
];

describe("assignInscripcionAction access (EA-ACC-1)", () => {
  const denied: [string, () => void, string][] = [
    ...rolesUsuario
      .filter((rol) => rol !== "secretaria")
      .map((rol): [string, () => void, string] => [
        rol,
        () => h.getSession.mockResolvedValue(session(rol)),
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      ]),
    [
      "anonymous",
      () => h.getSession.mockResolvedValue(null),
      "REDIRECT:/login",
    ],
    [
      "secretaria with a pending password change",
      () =>
        h.getSession.mockResolvedValue(
          session("secretaria", { debeCambiarClave: true }),
        ),
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    ],
  ];

  it("covers the six denied identities of the spec table", () => {
    expect(denied).toHaveLength(6);
  });

  it.each(denied)(
    "denies %s before reading the scope or validating the arguments, with a valid and a forged payload",
    async (_identity, arrange, destination) => {
      // A forged payload would answer the error copy if validation ran first;
      // the redirect proves the guard resolved before it.
      for (const [student, group, expected] of [
        [STUDENT, GROUP, null],
        [0, "x", "y"],
      ]) {
        arrange();

        await expect(assign(student, group, expected)).rejects.toThrow(
          destination,
        );
      }

      expect(h.resolveScope).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("takes the actor and the scope from the session, never from the payload", async () => {
    const call = assignInscripcionAction as unknown as (
      ...args: unknown[]
    ) => Promise<unknown>;

    await call(STUDENT, GROUP, null, {
      actorId: 99,
      scope: "all",
      rol: "administrador",
    });

    expect(h.staffEnrollInGroup).toHaveBeenCalledTimes(1);
    expect(h.staffEnrollInGroup).toHaveBeenCalledWith(
      STAFF,
      STUDENT,
      GROUP,
      FULL,
    );
  });

  it("hands the writer exactly the two guard fields, no session object", async () => {
    await assign();

    const [staff] = h.staffEnrollInGroup.mock.calls[0];
    expect(Object.keys(staff).sort()).toEqual(["actorId", "scope"]);
  });
});

describe("assignInscripcionAction opt-in (EA-SIB-1)", () => {
  it("passes { allowReplaceAndCreate: true, expectedReplaced } to the staff writer, and only those two keys", async () => {
    await assign();

    expect(h.staffEnrollInGroup).toHaveBeenCalledTimes(1);
    const args = h.staffEnrollInGroup.mock.calls[0];
    expect(args).toHaveLength(4);
    expect(args[3]).toStrictEqual({
      allowReplaceAndCreate: true,
      expectedReplaced: null,
    });
    expect(h.staffDropGroup).not.toHaveBeenCalled();
  });

  it("opts in for every student and group it is called with", async () => {
    await assign(12, 34, null);

    expect(h.staffEnrollInGroup).toHaveBeenCalledWith(STAFF, 12, 34, FULL);
  });

  it.each([5, 77])(
    "hands the writer the group the user saw as replaced (%s), unchanged",
    async (expected) => {
      await assign(STUDENT, GROUP, expected);

      expect(h.staffEnrollInGroup).toHaveBeenCalledWith(
        STAFF,
        STUDENT,
        GROUP,
        REPLACING(expected),
      );
    },
  );
});

describe("assignInscripcionAction input (EA-SCOPE-1, CS-9)", () => {
  it.each(BAD_IDS)(
    "refuses %s as the group id with the error copy and writes nothing",
    async (_label, forged) => {
      await expect(assign(STUDENT, forged, null)).resolves.toEqual({
        kind: "error",
        message: "inscripciones.errors.unexpected",
      });

      expectNothingWritten();
    },
  );

  it.each(BAD_IDS)(
    "re-validates %s as the student id and writes nothing",
    async (_label, forged) => {
      await expect(assign(forged, GROUP, null)).resolves.toEqual({
        kind: "error",
        message: "inscripciones.errors.unexpected",
      });

      expectNothingWritten();
    },
  );

  // null is the one valid non-id: the page showed no current group.
  it.each(BAD_IDS.filter(([label]) => label !== "null"))(
    "re-validates %s as the group the user saw as replaced and writes nothing",
    async (_label, forged) => {
      await expect(assign(STUDENT, GROUP, forged)).resolves.toEqual({
        kind: "error",
        message: "inscripciones.errors.unexpected",
      });

      expectNothingWritten();
    },
  );

  it("answers gone to a scope with no facultad and never calls a writer", async () => {
    h.resolveScope.mockImplementation(async () => {
      guardResolved = true;
      return NONE;
    });

    await expect(assign()).resolves.toEqual({ kind: "gone" });

    expectNothingWritten();
  });

  // The out-of-scope decision is the writer's, inside its transaction under the
  // lock; the action forwards the (possibly forged) id with the session scope
  // and shows the same answer as for an unknown student (CS-2).
  it.each([
    ["change group of an out-of-scope student", 99, 5],
    ["create for an out-of-scope student", 1234, 8],
    ["create for an unknown student", 987654, 8],
  ])(
    "%s answers gone, writes nothing and revalidates nothing",
    async (_label, student, group) => {
      h.staffEnrollInGroup.mockResolvedValue({
        ok: false,
        reason: "not_student",
      });

      await expect(assign(student, group, null)).resolves.toEqual({
        kind: "gone",
      });

      expect(h.staffEnrollInGroup).toHaveBeenCalledWith(
        STAFF,
        student,
        group,
        FULL,
      );
      expect(h.revalidatePath).not.toHaveBeenCalled();
    },
  );
});

describe("assignInscripcionAction outcomes (EA-CRE-1, EA-CHG-1, EA-SIB-1)", () => {
  it.each([
    ["created", { kind: "created", replaced: [] }, "created", 0],
    ["reactivated", { kind: "reactivated", replaced: [] }, "reactivated", 0],
    [
      "replaced (one sibling)",
      { kind: "reactivated", replaced: [4] },
      "reactivated",
      1,
    ],
    [
      "replaced (two siblings)",
      { kind: "created", replaced: [4, 6] },
      "created",
      2,
    ],
  ])(
    "maps %s to done and revalidates the list once",
    async (_label, written, outcome, replaced) => {
      h.staffEnrollInGroup.mockResolvedValue({
        ok: true,
        grupoId: GROUP,
        ...written,
      });

      await expect(assign()).resolves.toEqual({
        kind: "done",
        outcome,
        replaced,
      });

      expect(h.revalidatePath).toHaveBeenCalledTimes(1);
      expect(h.revalidatePath).toHaveBeenCalledWith(PATH);
    },
  );

  it("never leaks the replaced group ids to the browser", async () => {
    h.staffEnrollInGroup.mockResolvedValue({
      ok: true,
      kind: "created",
      grupoId: GROUP,
      replaced: [4242, 4343],
    });

    const answer = await assign();

    expect(answer).toEqual({ kind: "done", outcome: "created", replaced: 2 });
    expect(JSON.stringify(answer)).not.toMatch(/4242|4343/);
  });

  it.each([
    ["already_enrolled", "inscripciones.errors.assign_already_enrolled"],
    ["not_eligible", "inscripciones.errors.assign_not_eligible"],
  ] as const)(
    "maps the %s refusal to its error copy without revalidating",
    async (reason, message) => {
      h.staffEnrollInGroup.mockResolvedValue({ ok: false, reason });

      await expect(assign()).resolves.toEqual({ kind: "error", message });

      expect(h.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("maps a stale replace to its own copy, without revalidating", async () => {
    h.staffEnrollInGroup.mockResolvedValue({ ok: false, reason: "stale" });

    await expect(assign(STUDENT, GROUP, 5)).resolves.toEqual({
      kind: "error",
      message: "inscripciones.errors.assign_stale",
    });

    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps not_student to gone without revalidating", async () => {
    h.staffEnrollInGroup.mockResolvedValue({
      ok: false,
      reason: "not_student",
    });

    await expect(assign()).resolves.toEqual({ kind: "gone" });

    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("turns a thrown writer error into the unexpected copy, with no revalidate and no raw text", async () => {
    h.staffEnrollInGroup.mockRejectedValue(
      new Error("connection refused 10.0.0.1"),
    );

    const answer = await assign();

    expect(answer).toEqual({
      kind: "error",
      message: "inscripciones.errors.unexpected",
    });
    expect(JSON.stringify(answer)).not.toContain("10.0.0.1");
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });
});
