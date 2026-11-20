import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionFor } from "@/app/(dashboard)/review/test-support";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  scopeMock,
  saveMock,
  revalidatePathMock,
  revalidateTagMock,
  refreshMock,
  loadSignalsMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  saveMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  refreshMock: vi.fn(),
  loadSignalsMock: vi.fn(() => {
    throw new Error("the signals module must never be called by a save");
  }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
  refresh: refreshMock,
}));
// The REAL dal runs on a mocked session source (RNF-01: the action re-checks).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/document-data", () => ({ saveDocumentData: saveMock }));
// A save never reads the signals or the verdict (MD-9, RN-15).
vi.mock("@/lib/data/signals", () => ({ loadSignals: loadSignalsMock }));

import { saveDocumentDataAction } from "@/app/(dashboard)/review/[id]/document-data-actions";

// manual-document-data: MD-7 (callers), MD-9 (no signals read), MD-11 (no
// value in a log), MD-24 (redirect to the same route, never a revalidation),
// MD-3 (the validation runs before the write).

const SCOPE = { kind: "facultad", facultadId: 4 } as const;
const NOT_FOUND = { ok: false, reason: "not_found" };

type Fields = Record<string, string | File>;

const FILLED: Fields = {
  solicitudId: "12",
  documentoId: "31",
  studentName: "Ana Lopez",
  issuer: "Clinica Santa Fe",
  issueDate: "2026-11-02",
  restFrom: "2026-11-03",
  restTo: "2026-11-05",
  type: "constancia_medica",
  hasSignature: "yes",
  hasSeal: "no",
};

function form(fields: Fields = FILLED): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

function without(...names: string[]): Fields {
  const copy: Fields = { ...FILLED };
  for (const name of names) delete copy[name];
  return copy;
}

const EMPTY_DATA = {
  studentName: null,
  issuer: null,
  issueDate: null,
  restFrom: null,
  restTo: null,
  type: null,
  hasSignature: null,
  hasSeal: null,
};

beforeEach(() => {
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
  revalidateTagMock.mockClear();
  refreshMock.mockClear();
  loadSignalsMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  saveMock.mockReset();
  saveMock.mockResolvedValue({ ok: true, changed: true });
});

describe("saveDocumentDataAction authorisation (MD-7, RNF-01)", () => {
  it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
    "sends %s to /denied before reading the scope or writing",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(saveDocumentDataAction(form())).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(saveMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(saveDocumentDataAction(form())).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("answers not_found, and writes nothing, for a secretaria without a faculty", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await expect(saveDocumentDataAction(form())).resolves.toEqual(NOT_FOUND);

    expect(saveMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("re-checks the scope of the session user", async () => {
    await expect(saveDocumentDataAction(form())).rejects.toThrow("REDIRECT:");

    expect(scopeMock).toHaveBeenCalledWith(7, "secretaria");
  });

  it.each([
    ["solicitudId", "0"],
    ["solicitudId", "-3"],
    ["solicitudId", "1.5"],
    ["solicitudId", "12abc"],
    ["solicitudId", ""],
    ["solicitudId", "9007199254740993"],
    ["documentoId", "0"],
    ["documentoId", "x"],
    ["documentoId", " 31"],
  ])(
    "answers not_found for %s = %j after re-checking the scope",
    async (name, value) => {
      await expect(
        saveDocumentDataAction(form({ ...FILLED, [name]: value })),
      ).resolves.toEqual(NOT_FOUND);

      expect(scopeMock).toHaveBeenCalledWith(7, "secretaria");
      expect(saveMock).not.toHaveBeenCalled();
    },
  );

  it.each(["solicitudId", "documentoId"])(
    "answers not_found when %s is missing",
    async (name) => {
      await expect(
        saveDocumentDataAction(form(without(name))),
      ).resolves.toEqual(NOT_FOUND);
      expect(saveMock).not.toHaveBeenCalled();
    },
  );

  it("answers not_found when an id is a file", async () => {
    const file = new File(["12"], "12.txt");

    await expect(
      saveDocumentDataAction(form({ ...FILLED, solicitudId: file })),
    ).resolves.toEqual(NOT_FOUND);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it.each([
    null,
    undefined,
    "text",
    12,
    [],
    { solicitudId: 12, documentoId: 31 },
  ])(
    "answers not_found for the payload %j, which is not a form",
    async (payload) => {
      await expect(saveDocumentDataAction(payload)).resolves.toEqual(NOT_FOUND);
      expect(saveMock).not.toHaveBeenCalled();
    },
  );
});

describe("saveDocumentDataAction validation (MD-3)", () => {
  it.each<[string, Fields, Record<string, string>]>([
    [
      "a name over 160 characters",
      { ...FILLED, studentName: "a".repeat(161) },
      { studentName: "text_too_long" },
    ],
    [
      "an issuer over 200 characters",
      { ...FILLED, issuer: "b".repeat(201) },
      { issuer: "text_too_long" },
    ],
    [
      "an impossible issue date",
      { ...FILLED, issueDate: "2026-02-30" },
      { issueDate: "date_invalid" },
    ],
    [
      "a lone rest start",
      { ...FILLED, restTo: "" },
      { rest: "rest_incomplete" },
    ],
    [
      "a rest that ends before it starts",
      { ...FILLED, restFrom: "2026-11-09", restTo: "2026-11-08" },
      { rest: "rest_order" },
    ],
    [
      "a type outside the list",
      { ...FILLED, type: "formato_especial" },
      { type: "type_invalid" },
    ],
    [
      "a firma outside the three states",
      { ...FILLED, hasSignature: "maybe" },
      { hasSignature: "mark_invalid" },
    ],
    [
      "a sello outside the three states",
      { ...FILLED, hasSeal: "1" },
      { hasSeal: "mark_invalid" },
    ],
  ])(
    "returns invalid on the field, and calls no data module, for %s",
    async (_label, fields, errors) => {
      await expect(saveDocumentDataAction(form(fields))).resolves.toEqual({
        ok: false,
        reason: "invalid",
        errors,
      });

      expect(saveMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("names every invalid field at once and echoes no submitted value", async () => {
    const result = await saveDocumentDataAction(
      form({
        ...FILLED,
        studentName: "Ana".repeat(80),
        issueDate: "not a date",
        hasSeal: "maybe",
      }),
    );

    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      errors: {
        studentName: "text_too_long",
        issueDate: "date_invalid",
        hasSeal: "mark_invalid",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/Ana|not a date|maybe/);
  });
});

describe("saveDocumentDataAction success (MD-9, MD-24)", () => {
  it("saves the whole form of one document as the session user and redirects to the same route", async () => {
    await expect(saveDocumentDataAction(form())).rejects.toThrow(
      "REDIRECT:/review/12",
    );

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith({
      actorId: 7,
      scope: SCOPE,
      solicitudId: 12,
      documentoId: 31,
      data: {
        studentName: "Ana Lopez",
        issuer: "Clinica Santa Fe",
        issueDate: "2026-11-02",
        restFrom: "2026-11-03",
        restTo: "2026-11-05",
        type: "constancia_medica",
        hasSignature: true,
        hasSeal: false,
      },
    });
  });

  it("redirects also when nothing changed (a no-op save is a success)", async () => {
    saveMock.mockResolvedValue({ ok: true, changed: false });

    await expect(saveDocumentDataAction(form())).rejects.toThrow(
      "REDIRECT:/review/12",
    );
  });

  it("redirects to the request of the form, not a fixed one", async () => {
    await expect(
      saveDocumentDataAction(form({ ...FILLED, solicitudId: "88" })),
    ).rejects.toThrow("REDIRECT:/review/88");
  });

  it("trims text, turns an empty value into null and maps the radios to true, false or null", async () => {
    await expect(
      saveDocumentDataAction(
        form({
          ...FILLED,
          studentName: "  Ana Lopez  ",
          issuer: "   ",
          issueDate: "",
          restFrom: "",
          restTo: "",
          type: "unregistered",
          hasSignature: "unregistered",
          hasSeal: "yes",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ...EMPTY_DATA,
          studentName: "Ana Lopez",
          hasSeal: true,
        },
      }),
    );
  });

  it("reads a missing field as empty, so clearing a whole form saves null everywhere", async () => {
    await expect(
      saveDocumentDataAction(form({ solicitudId: "12", documentoId: "31" })),
    ).rejects.toThrow("REDIRECT:");

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: EMPTY_DATA }),
    );
  });

  it("coerces a file in a text, date or choice field to an empty value instead of throwing", async () => {
    const file = new File(["Ana Lopez"], "name.txt");

    await expect(
      saveDocumentDataAction(
        form({
          ...FILLED,
          studentName: file,
          issuer: file,
          issueDate: file,
          restFrom: file,
          restTo: file,
          type: file,
          hasSignature: file,
          hasSeal: file,
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: EMPTY_DATA }),
    );
  });

  it("uses the session user and the resolved scope even when the body claims others", async () => {
    const data = form();
    data.set("actorId", "99");
    data.set("rol", "administrador");
    data.set("scope", "all");
    data.set("facultadId", "1");

    await expect(saveDocumentDataAction(data)).rejects.toThrow("REDIRECT:");

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 7, scope: SCOPE }),
    );
    expect(saveMock.mock.calls[0][0]).not.toHaveProperty("rol");
  });

  it("never revalidates or refreshes the page, and never reads the signals", async () => {
    await expect(saveDocumentDataAction(form())).rejects.toThrow("REDIRECT:");

    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(loadSignalsMock).not.toHaveBeenCalled();
  });
});

describe("saveDocumentDataAction data refusals", () => {
  it.each([
    ["not_found", { ok: false, reason: "not_found" }],
    ["not_editable", { ok: false, reason: "not_editable" }],
  ] as const)(
    "returns the refusal %s without a redirect, so the form shows it",
    async (_label, outcome) => {
      saveMock.mockResolvedValue(outcome);

      await expect(saveDocumentDataAction(form())).resolves.toEqual(outcome);

      expect(redirectMock).not.toHaveBeenCalled();
    },
  );
});

describe("saveDocumentDataAction failures (MD-11)", () => {
  afterEach(() => vi.restoreAllMocks());

  const SECRETS = ["Ana Lopez", "Clinica Santa Fe", "2026-11-02", "constancia"];

  /** A Postgres CHECK error: its message and detail embed the row values. */
  function checkViolation() {
    const error = new Error(
      'new row for relation "DocumentoDatoManual" violates check constraint ' +
        '"CK_DatoManual_Texto": Failing row contains (31, Ana Lopez, Clinica Santa Fe)',
    );
    Object.assign(error, {
      code: "23514",
      detail: "Failing row contains (31, Ana Lopez, Clinica Santa Fe)",
      cause: new Error("Ana Lopez, Clinica Santa Fe, 2026-11-02"),
    });
    return error;
  }

  function logged(spies: ReturnType<typeof vi.spyOn>[]): string {
    return JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
  }

  it("answers unexpected, with no redirect, when the write throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    saveMock.mockRejectedValue(checkViolation());

    await expect(saveDocumentDataAction(form())).resolves.toEqual({
      ok: false,
      reason: "unexpected",
    });

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each([
    ["an Error carrying values", checkViolation],
    ["a thrown string", () => "Ana Lopez, Clinica Santa Fe"],
    [
      "a thrown object",
      () => ({ detail: "Ana Lopez", name: "Clinica Santa Fe" }),
    ],
  ])(
    "logs no message, stack, cause or value for %s, only a code and the ids",
    async (_label, thrown) => {
      const spies = (["error", "warn", "log", "info", "debug"] as const).map(
        (method) => vi.spyOn(console, method).mockImplementation(() => {}),
      );
      saveMock.mockRejectedValue(thrown());

      await saveDocumentDataAction(form());

      const text = logged(spies);
      expect(text.length).toBeGreaterThan(2);
      for (const secret of SECRETS) expect(text).not.toContain(secret);
      expect(text).not.toMatch(/violates|Failing row|CK_DatoManual|stack|at /);
      expect(spies[0]).toHaveBeenCalledTimes(1);
      expect(spies[0].mock.calls[0]).toEqual([
        "document_data_save_failed",
        { solicitudId: 12, documentoId: 31 },
      ]);
    },
  );

  it("logs nothing at all for a refusal or a success", async () => {
    const spies = (["error", "warn", "log", "info", "debug"] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => {}),
    );

    saveMock.mockResolvedValue({ ok: false, reason: "not_editable" });
    await saveDocumentDataAction(form());
    saveMock.mockResolvedValue({ ok: true, changed: true });
    await expect(saveDocumentDataAction(form())).rejects.toThrow("REDIRECT:");
    await saveDocumentDataAction(form({ ...FILLED, issueDate: "bad" }));

    expect(logged(spies)).toBe("[]");
  });

  it("does not turn the denial redirect of the guard into unexpected", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));

    await expect(saveDocumentDataAction(form())).rejects.toThrow(
      `REDIRECT:${ACCESS_DENIED_PATH}`,
    );

    expect(console.error).not.toHaveBeenCalled();
  });
});
