// @vitest-environment node
//
// Node (not jsdom) so `File`/`FormData` and the real exceljs parser share one
// realm. Real: guards, parse, plan, summary logging. Mocked: the DAL, the
// snapshot read, `runImportApply` and everything that touches a database.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { makeSnapshot } from "@/lib/import/__fixtures__/plan-fixtures";
import { MAX_FILE_BYTES } from "@/lib/import/limits";
import type {
  EntityCounts,
  ImportPlan,
  ImportSummary,
  TemporaryCredential,
} from "@/lib/import/types";
import type { RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  calls: [] as string[],
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireRole: vi.fn(),
  loadCatalogSnapshot: vi.fn(),
  runImportApply: vi.fn(),
  hashPassword: vi.fn(),
  insertAuditEvents: vi.fn(),
  transaction: vi.fn(),
  parseWorkbook: vi.fn(),
  planImport: vi.fn(),
  logImportSummary: vi.fn(),
  canImportCatalog: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: object) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@/db", () => ({ db: { transaction: h.transaction } }));
vi.mock("@/lib/auth/dal", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: h.hashPassword }));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: h.insertAuditEvents }));
vi.mock("@/lib/data/catalog", () => ({
  loadCatalogSnapshot: h.loadCatalogSnapshot,
}));
vi.mock("@/lib/import/apply", () => ({
  runImportApply: h.runImportApply,
  ImportRejectedError: class ImportRejectedError extends Error {
    constructor(readonly errors: unknown[]) {
      super("rejected");
    }
  },
  CatalogBusyError: class CatalogBusyError extends Error {},
}));
vi.mock("@/lib/auth/permissions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/permissions")>();
  h.canImportCatalog.mockImplementation((rol) => {
    h.calls.push("canImportCatalog");
    return actual.canImportCatalog(rol);
  });
  return { ...actual, canImportCatalog: h.canImportCatalog };
});
vi.mock("@/lib/import/parse", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/import/parse")>();
  h.parseWorkbook.mockImplementation(actual.parseWorkbook);
  return { ...actual, parseWorkbook: h.parseWorkbook };
});
vi.mock("@/lib/import/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/import/plan")>();
  h.planImport.mockImplementation(actual.planImport);
  return { ...actual, planImport: h.planImport };
});
vi.mock("@/lib/import/summary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/import/summary")>();
  h.logImportSummary.mockImplementation((summary: ImportSummary) => {
    h.calls.push("logImportSummary");
    actual.logImportSummary(summary);
  });
  return { ...actual, logImportSummary: h.logImportSummary };
});

import { hashPassword } from "@/lib/auth/password";
import { generateTemporaryPassword } from "@/lib/import/temp-password";

import { applyAction, previewAction } from "./actions";

const FIXTURES = resolve(__dirname, "../../../../lib/import/__fixtures__");
const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve(FIXTURES, name)));
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const VALID = fixture("valid.xlsx");
const IDLE = { kind: "idle" } as const;
const CLAVE = "ZK9TQ2M4XW7HB3PD";
const CREDENTIALS: TemporaryCredential[] = [
  { login: "juan.perez@uni.edu", nombreCompleto: "Juan Perez", clave: CLAVE },
];
const zero: EntityCounts = {
  create: 0,
  update: 0,
  unchanged: 0,
  deactivate: 0,
  error: 0,
};
const SUMMARY: ImportSummary = {
  actor: "caller",
  at: "2026-10-04T10:00:00.000Z",
  fileSha256: sha256(VALID),
  counts: { Asignatura: zero, Usuario: zero, Grupo: zero },
  accountsCreated: 1,
  accountsUpdated: 0,
  asignaturasReactivated: 0,
  manualGruposDeactivated: 0,
};

let session: { sub: string; login: string; rol: RolUsuario } | null = null;
const signInAs = (rol: RolUsuario) => {
  session = { sub: "7", login: "caller", rol };
};

function form(
  bytes: Uint8Array | null,
  name = "catalogo.xlsx",
  extra: Record<string, string> = {},
) {
  const fd = new FormData();
  if (bytes) fd.set("file", new File([new Uint8Array(bytes)], name));
  for (const [key, value] of Object.entries(extra)) fd.set(key, value);
  return fd;
}

function spyOnGet(fd: FormData) {
  const original = fd.get.bind(fd);
  return vi.spyOn(fd, "get").mockImplementation((key) => {
    h.calls.push("formData.get");
    return original(key);
  });
}

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;
const consoleSpies = {} as Record<
  (typeof CONSOLE_METHODS)[number],
  ReturnType<typeof vi.spyOn>
>;

beforeEach(() => {
  h.calls.length = 0;
  for (const mock of [h.redirect, h.hashPassword, h.insertAuditEvents]) {
    mock.mockClear();
  }
  for (const mock of [h.transaction, h.parseWorkbook, h.planImport]) {
    mock.mockClear();
  }
  h.logImportSummary.mockClear();
  h.canImportCatalog.mockClear();
  h.runImportApply.mockReset();
  h.loadCatalogSnapshot.mockReset().mockResolvedValue(makeSnapshot());
  h.requireRole.mockReset().mockImplementation(async (...roles: string[]) => {
    h.calls.push("requireRole");
    if (!session) h.redirect("/login");
    if (!roles.includes(session!.rol)) h.redirect(ACCESS_DENIED_PATH);
    return session;
  });
  signInAs("secretaria");
  for (const method of CONSOLE_METHODS) {
    consoleSpies[method] = vi
      .spyOn(console, method)
      .mockImplementation(() => {});
  }
});

afterEach(() => {
  for (const method of CONSOLE_METHODS) consoleSpies[method].mockRestore();
});

describe.each([
  ["previewAction", previewAction],
  ["applyAction", applyAction],
])(
  "%s authorization (CEI: Authorization precedes reading the body)",
  (_n, action) => {
    it.each([
      "administrador",
      "coordinacion",
      "docente",
      "estudiante",
    ] as const)(
      "redirects %s to /denied without touching the request body",
      async (rol) => {
        signInAs(rol);
        const fd = form(VALID);
        const get = spyOnGet(fd);

        await expect(action(IDLE, fd)).rejects.toThrow(
          `REDIRECT:${ACCESS_DENIED_PATH}`,
        );

        expect(get).not.toHaveBeenCalled();
        expect(h.parseWorkbook).not.toHaveBeenCalled();
        expect(h.loadCatalogSnapshot).not.toHaveBeenCalled();
        expect(h.runImportApply).not.toHaveBeenCalled();
      },
    );

    it("sends an anonymous caller to /login before reading anything", async () => {
      session = null;
      const fd = form(VALID);
      const get = spyOnGet(fd);

      await expect(action(IDLE, fd)).rejects.toThrow("REDIRECT:/login");

      expect(get).not.toHaveBeenCalled();
      expect(h.parseWorkbook).not.toHaveBeenCalled();
    });

    it("runs requireRole, then canImportCatalog, then the first formData.get", async () => {
      const fd = form(VALID);
      spyOnGet(fd);

      await action(IDLE, fd);

      expect(h.calls.slice(0, 3)).toEqual([
        "requireRole",
        "canImportCatalog",
        "formData.get",
      ]);
    });
  },
);

const GUARD_CASES: [string, Uint8Array | null, string, string][] = [
  ["no file field", null, "catalogo.xlsx", "errors.noFile"],
  ["an empty file", new Uint8Array(), "catalogo.xlsx", "errors.noFile"],
  ["a legacy .xls", VALID, "catalog.xls", "errors.wrongExtension"],
  ["a .csv", VALID, "catalog.csv", "errors.wrongExtension"],
  [
    "plain text named .xlsx",
    new TextEncoder().encode("not a workbook"),
    "catalogo.xlsx",
    "errors.invalidWorkbook",
  ],
  [
    "a file over the size cap",
    Object.assign(new Uint8Array(MAX_FILE_BYTES + 1), [0x50, 0x4b, 3, 4]),
    "catalogo.xlsx",
    "errors.tooLarge",
  ],
];

const PARSE_CASES: [string, string, string][] = [
  ["a corrupt zip named .xlsx", "corrupt-zip.xlsx", "errors.invalidWorkbook"],
  ["rows above the row cap", "row-cap-exceeded.xlsx", "errors.tooManyRows"],
  [
    "a missing sheet",
    "missing-sheet.xlsx",
    'errors.sheetMissing:{"sheet":"Grupos"}',
  ],
  [
    "a renamed header",
    "renamed-header.xlsx",
    'errors.columnMissing:{"sheet":"Asignaturas","column":"Codigo"}',
  ],
];

describe.each([
  ["previewAction", previewAction],
  ["applyAction", applyAction],
])("%s file guards (CEI: File guards)", (_n, action) => {
  it.each(GUARD_CASES)(
    "rejects %s before parsing",
    async (_c, bytes, name, key) => {
      const state = await action(IDLE, form(bytes, name));

      expect(state).toEqual({ kind: "error", message: key });
      expect(h.parseWorkbook).not.toHaveBeenCalled();
      expect(h.loadCatalogSnapshot).not.toHaveBeenCalled();
      expect(h.runImportApply).not.toHaveBeenCalled();
    },
  );

  it.each(PARSE_CASES)("rejects %s without planning", async (_c, file, key) => {
    const state = await action(IDLE, form(fixture(file)));

    expect(state).toEqual({ kind: "error", message: key });
    expect(h.parseWorkbook).toHaveBeenCalledTimes(1);
    expect(h.planImport).not.toHaveBeenCalled();
    expect(h.runImportApply).not.toHaveBeenCalled();
  });

  it("accepts the extension case-insensitively", async () => {
    const state = await action(IDLE, form(VALID, "CATALOG.XLSX"));

    expect(state.kind).not.toBe("error");
  });
});

describe("previewAction (CEI: Dry-run report persists nothing)", () => {
  it("returns per-entity counts, the new-account count and the sha256 of the bytes", async () => {
    const state = await previewAction(IDLE, form(VALID));

    expect(state).toEqual({
      kind: "preview",
      fileSha256: sha256(VALID),
      accountsToCreate: 2,
      asignaturasToReactivate: 0,
      manualGruposToDeactivate: 0,
      errors: [],
      counts: {
        Asignatura: { ...zero, create: 2 },
        Usuario: { ...zero, create: 2 },
        Grupo: { ...zero, create: 2 },
      },
    });
  });

  it("reports the reactivation and manual-group figures of the plan (CEI-PREV)", async () => {
    h.loadCatalogSnapshot.mockResolvedValue(
      makeSnapshot({
        asignaturas: [
          {
            id: 1,
            codigo: "CS101",
            nombre: "Introduccion a la Programacion",
            carreraId: 1,
            horasTotales: 64,
            activo: false,
          },
          {
            id: 10,
            codigo: "OLD1",
            nombre: "Old",
            carreraId: 1,
            horasTotales: 8,
            activo: true,
          },
        ],
        grupos: [
          {
            id: 5,
            asignaturaId: 10,
            periodo: "2026-S1",
            numeroGrupo: "9",
            docenteId: 3,
            activo: true,
            origen: "manual",
          },
        ],
      }),
    );

    expect(await previewAction(IDLE, form(VALID))).toMatchObject({
      kind: "preview",
      asignaturasToReactivate: 1,
      manualGruposToDeactivate: 1,
    });
  });

  it("never takes the catalog lock: actions.ts imports nothing from catalog-write", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");

    expect(source).not.toMatch(/catalog-write|acquireCatalogWriteLock/);
  });

  it("reports row errors with sheet, row and reason (all of them)", async () => {
    h.loadCatalogSnapshot.mockResolvedValue(makeSnapshot({ carreras: [] }));

    const state = await previewAction(IDLE, form(VALID));

    expect(state).toMatchObject({ kind: "preview" });
    if (state.kind !== "preview") return;
    expect(
      state.errors.filter((e) => e.reason === "carrera.unresolved"),
    ).toEqual([
      expect.objectContaining({ sheet: "Asignaturas", row: 2 }),
      expect.objectContaining({ sheet: "Asignaturas", row: 3 }),
    ]);
    expect(state.counts.Asignatura.error).toBe(2);
  });

  it("shows deactivations of absent grupos explicitly", async () => {
    h.loadCatalogSnapshot.mockResolvedValue(
      makeSnapshot({
        asignaturas: [
          {
            id: 10,
            codigo: "OLD1",
            nombre: "Old",
            carreraId: 1,
            horasTotales: 8,
            activo: true,
          },
        ],
        grupos: [
          {
            id: 5,
            asignaturaId: 10,
            periodo: "2026-S1",
            numeroGrupo: "9",
            docenteId: 3,
            activo: true,
            origen: "importacion",
          },
        ],
      }),
    );

    const state = await previewAction(IDLE, form(VALID));

    expect(state).toMatchObject({
      kind: "preview",
      counts: { Grupo: { deactivate: 1 } },
    });
  });

  it("surfaces a planner cap as a validation error, not a failure", async () => {
    const capped: ImportPlan = {
      ok: false,
      errors: [
        { sheet: "Docentes", row: 0, reason: "accountsToCreate.capExceeded" },
      ],
      counts: { Asignatura: zero, Usuario: zero, Grupo: zero },
      accountsToCreate: 251,
      writes: { asignaturas: [], usuarios: [], grupos: [] },
      deactivateGrupoIds: [],
      asignaturasToReactivate: 0,
      manualGruposToDeactivate: 0,
    };
    h.planImport.mockReturnValueOnce(capped);

    const state = await previewAction(IDLE, form(VALID));

    expect(state).toMatchObject({
      kind: "preview",
      accountsToCreate: 251,
      errors: [{ reason: "accountsToCreate.capExceeded" }],
    });
  });

  it("re-reads the database on every call (nothing is cached between calls)", async () => {
    const first = await previewAction(IDLE, form(VALID));
    h.loadCatalogSnapshot.mockResolvedValue(
      makeSnapshot({
        asignaturas: [
          {
            id: 1,
            codigo: "CS101",
            nombre: "Introduccion a la Programacion",
            carreraId: 1,
            horasTotales: 64,
            activo: true,
          },
        ],
      }),
    );
    const second = await previewAction(IDLE, form(VALID));

    expect(h.loadCatalogSnapshot).toHaveBeenCalledTimes(2);
    expect(first).toMatchObject({ counts: { Asignatura: { create: 2 } } });
    expect(second).toMatchObject({
      counts: { Asignatura: { create: 1, unchanged: 1 } },
    });
  });

  it("writes nothing, hashes nothing and returns no credential", async () => {
    const state = await previewAction(IDLE, form(VALID));

    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.runImportApply).not.toHaveBeenCalled();
    expect(h.hashPassword).not.toHaveBeenCalled();
    expect(h.insertAuditEvents).not.toHaveBeenCalled();
    expect(h.logImportSummary).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).not.toMatch(
      /clave|password|credential|hash/i,
    );
    expect(state).not.toHaveProperty("credentials");
  });
});

describe("applyAction (CEI: Stateless confirm, All-or-nothing apply)", () => {
  const confirm = (bytes = VALID, hash = sha256(bytes), extra = {}) =>
    form(bytes, "catalogo.xlsx", { fileSha256: hash, ...extra });

  beforeEach(() => {
    h.runImportApply.mockImplementation(async () => {
      h.calls.push("runImportApply");
      return { summary: SUMMARY, credentials: CREDENTIALS };
    });
  });

  it("applies the re-parsed upload as the session actor and returns the credentials once", async () => {
    const state = await applyAction(IDLE, confirm());

    expect(state).toEqual({
      kind: "applied",
      summary: SUMMARY,
      credentials: CREDENTIALS,
    });
    expect(h.runImportApply).toHaveBeenCalledTimes(1);
    const input = h.runImportApply.mock.calls[0][0];
    expect(Object.keys(input).sort()).toEqual(
      ["actor", "db", "generate", "hash", "parsed", "sha256"].sort(),
    );
    expect(input.sha256).toBe(sha256(VALID));
    expect(input.parsed.fileSha256).toBe(sha256(VALID));
    expect(input.parsed.sheets.Asignaturas).toHaveLength(2);
    expect(input.hash).toBe(hashPassword);
    expect(input.generate).toBe(generateTemporaryPassword);
  });

  it("returns the summary with the reactivation and manual-group counts", async () => {
    const summary = {
      ...SUMMARY,
      asignaturasReactivated: 2,
      manualGruposDeactivated: 3,
    };
    h.runImportApply.mockResolvedValue({ summary, credentials: [] });

    expect(await applyAction(IDLE, confirm())).toEqual({
      kind: "applied",
      summary,
      credentials: [],
    });
  });

  it("answers a busy catalog with the busy state, no trace, and a retry succeeds (CEI-BUSY)", async () => {
    const { CatalogBusyError } = await import("@/lib/import/apply");
    h.runImportApply.mockRejectedValueOnce(new CatalogBusyError());

    const busy = await applyAction(IDLE, confirm());

    expect(busy).toEqual({ kind: "busy" });
    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(h.logImportSummary).not.toHaveBeenCalled();
    expect(await applyAction(IDLE, confirm())).toMatchObject({
      kind: "applied",
    });
  });

  it("takes the actor from the session, never from the form", async () => {
    await applyAction(
      IDLE,
      confirm(VALID, sha256(VALID), {
        actor: "evil",
        actorId: "999",
        login: "x",
      }),
    );

    expect(h.runImportApply.mock.calls[0][0].actor).toEqual({
      id: 7,
      login: "caller",
    });
  });

  it.each([
    ["a different hidden hash", { fileSha256: "f".repeat(64) }],
    ["no hidden hash", {}],
  ])("re-previews and applies nothing for %s (D15)", async (_c, extra) => {
    const state = await applyAction(IDLE, form(VALID, "catalogo.xlsx", extra));

    expect(state).toMatchObject({
      kind: "preview",
      fileSha256: sha256(VALID),
      counts: { Asignatura: { create: 2 } },
    });
    expect(h.runImportApply).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.logImportSummary).not.toHaveBeenCalled();
  });

  it("validates and plans file B on its own when the hidden hash is file A's", async () => {
    const fileB = fixture("formula-cell.xlsx");

    const state = await applyAction(IDLE, confirm(fileB, sha256(VALID)));

    expect(state).toMatchObject({ kind: "preview", fileSha256: sha256(fileB) });
    expect(h.runImportApply).not.toHaveBeenCalled();
  });

  it("returns a fresh preview with the errors when the apply is rejected", async () => {
    const { ImportRejectedError } = await import("@/lib/import/apply");
    h.loadCatalogSnapshot.mockResolvedValue(makeSnapshot({ carreras: [] }));
    h.runImportApply.mockRejectedValue(
      new ImportRejectedError([
        { sheet: "Asignaturas", row: 2, reason: "carrera.unresolved" },
      ]),
    );

    const state = await applyAction(IDLE, confirm());

    expect(state).toMatchObject({
      kind: "preview",
      errors: expect.arrayContaining([
        expect.objectContaining({ reason: "carrera.unresolved" }),
      ]),
    });
    expect(state).not.toHaveProperty("credentials");
    expect(h.logImportSummary).not.toHaveBeenCalled();
  });

  it("returns an error without credentials or a summary log when the apply throws", async () => {
    h.runImportApply.mockRejectedValue(
      new Error(`insert failed, params: ${CLAVE} $2b$12$abcdefghijk`),
    );

    const state = await applyAction(IDLE, confirm());

    expect(state).toEqual({ kind: "error", message: "errors.applyFailed" });
    expect(h.logImportSummary).not.toHaveBeenCalled();
    expect(JSON.stringify(consoleSpies.error.mock.calls)).not.toContain(CLAVE);
  });
});

describe("applyAction summary log and credential containment (D16, IAP)", () => {
  const confirm = () =>
    form(VALID, "catalogo.xlsx", { fileSha256: sha256(VALID) });

  beforeEach(() => {
    h.runImportApply.mockImplementation(async () => {
      h.calls.push("runImportApply");
      return { summary: SUMMARY, credentials: CREDENTIALS };
    });
  });

  it("logs the summary exactly once, after the apply resolved", async () => {
    await applyAction(IDLE, confirm());

    expect(h.logImportSummary).toHaveBeenCalledTimes(1);
    expect(h.logImportSummary).toHaveBeenCalledWith(SUMMARY);
    expect(h.calls.indexOf("logImportSummary")).toBeGreaterThan(
      h.calls.indexOf("runImportApply"),
    );
    expect(consoleSpies.info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleSpies.info.mock.calls[0][0] as string)).toEqual({
      event: "catalog.import.applied",
      ...SUMMARY,
    });
  });

  it("never logs on rejection or on a thrown apply", async () => {
    h.runImportApply.mockRejectedValueOnce(new Error("boom"));
    await applyAction(IDLE, confirm());
    h.runImportApply.mockRejectedValueOnce(new Error("boom"));
    await applyAction(IDLE, confirm());

    expect(h.logImportSummary).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
  });

  it("still returns the credentials when the log line cannot be written", async () => {
    consoleSpies.info.mockImplementationOnce(() => {
      throw new Error("log sink down");
    });

    const state = await applyAction(IDLE, confirm());

    expect(state).toEqual({
      kind: "applied",
      summary: SUMMARY,
      credentials: CREDENTIALS,
    });
  });

  it("passes no credential, password or hash to any console method", async () => {
    h.runImportApply.mockRejectedValueOnce(new Error(`leak ${CLAVE}`));
    await applyAction(IDLE, confirm());
    await applyAction(IDLE, confirm());
    await previewAction(IDLE, confirm());

    for (const method of CONSOLE_METHODS) {
      const logged = JSON.stringify(consoleSpies[method].mock.calls);
      expect(logged).not.toContain(CLAVE);
      expect(logged).not.toMatch(/hashClave|\$2[aby]\$/);
    }
  });

  it("keeps credentials out of cookies, disk, browser storage and module state", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");

    expect(source).not.toMatch(
      /next\/headers|cookies|node:fs|fs\/promises|localStorage|sessionStorage/,
    );
    expect(source).not.toMatch(/^(let|var) /m);
  });
});

describe("applyAction failure trace (post-review of 9.9/9.10)", () => {
  const HASH = "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234";
  const confirm = () =>
    form(VALID, "catalogo.xlsx", { fileSha256: sha256(VALID) });

  beforeEach(() => {
    h.runImportApply.mockImplementation(async () => ({
      summary: SUMMARY,
      credentials: CREDENTIALS,
    }));
  });

  it("emits one sanitized line with actor, digest, error name and code", async () => {
    h.runImportApply.mockRejectedValueOnce(
      Object.assign(new Error("insert failed"), { code: "23505" }),
    );

    const state = await applyAction(IDLE, confirm());

    expect(state).toEqual({ kind: "error", message: "errors.applyFailed" });
    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleSpies.error.mock.calls[0][0] as string)).toEqual({
      event: "catalog.import.failed",
      actor: "caller",
      fileSha256: sha256(VALID),
      errorName: "Error",
      errorCode: "23505",
    });
  });

  it("emits nothing on success or when the apply is rejected by the plan", async () => {
    const { ImportRejectedError } = await import("@/lib/import/apply");

    await applyAction(IDLE, confirm());
    h.runImportApply.mockRejectedValueOnce(new ImportRejectedError([]));
    await applyAction(IDLE, confirm());

    expect(consoleSpies.error).not.toHaveBeenCalled();
  });

  it("keeps a hash and a plaintext password out of the line", async () => {
    h.runImportApply.mockRejectedValueOnce(
      new Error(`insert failed, params: ${CLAVE} ${HASH}`, {
        cause: new Error(`inner ${CLAVE}`),
      }),
    );

    await applyAction(IDLE, confirm());

    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(consoleSpies.error.mock.calls);
    expect(logged).not.toContain(CLAVE);
    expect(logged).not.toContain(HASH);
    expect(logged).not.toContain("$2b$");
  });

  it("returns the same state when the log sink itself fails", async () => {
    h.runImportApply.mockRejectedValueOnce(new Error("boom"));
    consoleSpies.error.mockImplementationOnce(() => {
      throw new Error("log sink down");
    });

    const state = await applyAction(IDLE, confirm());

    expect(state).toEqual({ kind: "error", message: "errors.applyFailed" });
  });
});

describe("error copy exists in both catalogs", () => {
  const KEYS = [
    "noFile",
    "wrongExtension",
    "invalidWorkbook",
    "tooLarge",
    "tooManyRows",
    "sheetMissing",
    "columnMissing",
    "applyFailed",
  ];
  const errorsOf = (catalog: typeof esMessages) =>
    (
      catalog as unknown as {
        catalog: { import: { errors: Record<string, string> } };
      }
    ).catalog.import.errors;

  it.each(KEYS)("has a non-empty %s message in es and en", (key) => {
    expect(errorsOf(esMessages)[key]).toEqual(expect.any(String));
    expect(errorsOf(esMessages)[key].length).toBeGreaterThan(0);
    expect(errorsOf(enMessages)[key].length).toBeGreaterThan(0);
  });

  it.each(["sheetMissing", "columnMissing"])(
    "%s interpolates the sheet name in both locales",
    (key) => {
      expect(errorsOf(esMessages)[key]).toContain("{sheet}");
      expect(errorsOf(enMessages)[key]).toContain("{sheet}");
    },
  );
});
