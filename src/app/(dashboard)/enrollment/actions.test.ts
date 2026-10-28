// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSession: vi.fn(),
  revalidatePath: vi.fn(),
  enrollInGroup: vi.fn(),
  dropGroup: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
// The REAL dal runs on a mocked session source, so the guard order is the
// production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: h.getSession }));
vi.mock("@/lib/data/enrollment-write", () => ({
  enrollInGroup: h.enrollInGroup,
  dropGroup: h.dropGroup,
}));

import { dropAction, enrollAction } from "./actions";

const STUDENT = 7;

function session(rol: string, extra: Record<string, unknown> = {}) {
  return { sub: String(STUDENT), login: "ana", rol, nombre: "Ana", ...extra };
}

function expectUntouched() {
  expect(h.enrollInGroup).not.toHaveBeenCalled();
  expect(h.dropGroup).not.toHaveBeenCalled();
  expect(h.revalidatePath).not.toHaveBeenCalled();
}

beforeEach(() => {
  for (const mock of Object.values(h)) mock.mockReset();
  h.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  h.getSession.mockResolvedValue(session("estudiante"));
  h.enrollInGroup.mockResolvedValue({
    ok: true,
    kind: "created",
    grupoId: 5,
    replaced: [],
  });
  h.dropGroup.mockResolvedValue({ ok: true, grupoId: 5 });
});

const actions = [
  ["enrollAction", enrollAction],
  ["dropAction", dropAction],
] as const;

describe.each(actions)("%s access (RNF-01)", (_name, action) => {
  it.each(rolesUsuario.filter((rol) => rol !== "estudiante"))(
    "denies %s before reading the payload or writing",
    async (rol) => {
      h.getSession.mockResolvedValue(session(rol));

      await expect(action({ grupoId: 5 })).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expectUntouched();
    },
  );

  it("denies an anonymous call", async () => {
    h.getSession.mockResolvedValue(null);

    await expect(action({ grupoId: 5 })).rejects.toThrow("REDIRECT:/login");

    expectUntouched();
  });

  it("sends a flagged student to the password change first", async () => {
    h.getSession.mockResolvedValue(
      session("estudiante", { debeCambiarClave: true }),
    );

    await expect(action({ grupoId: 5 })).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );

    expectUntouched();
  });

  it("takes the student from the session, never from a forged payload", async () => {
    await action({ grupoId: 5, estudianteId: 99 });

    const writer = action === enrollAction ? h.enrollInGroup : h.dropGroup;
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith(STUDENT, 5);
  });

  it.each([
    ["a zero id", { grupoId: 0 }],
    ["a decimal id", { grupoId: 1.5 }],
    ["a string id", { grupoId: "5" }],
    ["a missing id", {}],
    ["no payload", undefined],
  ])(
    "refuses %s with the invalid key and writes nothing",
    async (_l, input) => {
      await expect(action(input)).resolves.toEqual({
        ok: false,
        error: "invalid",
      });

      expectUntouched();
    },
  );

  it("turns a thrown writer error into the unexpected key without revalidating", async () => {
    h.enrollInGroup.mockRejectedValue(new Error("boom"));
    h.dropGroup.mockRejectedValue(new Error("boom"));

    await expect(action({ grupoId: 5 })).resolves.toEqual({
      ok: false,
      error: "unexpected",
    });

    expect(h.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("enrollAction outcomes", () => {
  it.each([
    ["created", { kind: "created", replaced: [] }],
    ["reactivated", { kind: "reactivated", replaced: [] }],
    ["a replace", { kind: "created", replaced: [3] }],
  ])("succeeds on %s and revalidates /enrollment once", async (_l, extra) => {
    h.enrollInGroup.mockResolvedValue({ ok: true, grupoId: 5, ...extra });

    await expect(enrollAction({ grupoId: 5 })).resolves.toEqual({ ok: true });

    expect(h.revalidatePath).toHaveBeenCalledTimes(1);
    expect(h.revalidatePath).toHaveBeenCalledWith("/enrollment");
  });

  it.each(["not_student", "not_eligible", "already_enrolled"] as const)(
    "maps the %s refusal to its key without revalidating",
    async (reason) => {
      h.enrollInGroup.mockResolvedValue({ ok: false, reason });

      await expect(enrollAction({ grupoId: 5 })).resolves.toEqual({
        ok: false,
        error: reason,
      });

      expect(h.revalidatePath).not.toHaveBeenCalled();
    },
  );
});

describe("dropAction outcomes", () => {
  it("succeeds and revalidates /enrollment once", async () => {
    await expect(dropAction({ grupoId: 5 })).resolves.toEqual({ ok: true });

    expect(h.dropGroup).toHaveBeenCalledWith(STUDENT, 5);
    expect(h.revalidatePath).toHaveBeenCalledTimes(1);
    expect(h.revalidatePath).toHaveBeenCalledWith("/enrollment");
  });

  it.each(["not_student", "not_enrolled"] as const)(
    "maps the %s refusal to its key without revalidating",
    async (reason) => {
      h.dropGroup.mockResolvedValue({ ok: false, reason });

      await expect(dropAction({ grupoId: 5 })).resolves.toEqual({
        ok: false,
        error: reason,
      });

      expect(h.revalidatePath).not.toHaveBeenCalled();
    },
  );
});
