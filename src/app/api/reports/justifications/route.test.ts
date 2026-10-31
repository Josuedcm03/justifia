// @vitest-environment node
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import type { RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  scopeMock,
  exportMock,
  docentesMock,
  auditMock,
  buildSpy,
  cookieState,
  order,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  exportMock: vi.fn(),
  docentesMock: vi.fn(),
  auditMock: vi.fn(),
  buildSpy: vi.fn(),
  cookieState: { locale: undefined as string | undefined },
  order: [] as string[],
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
// The REAL dal runs on top of a mocked session source, so the guard order is
// the production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
// The locale cookie is read by the REAL `getUserLocale` through `cookies()`,
// the same call a route handler makes in production (design open question 1).
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "NEXT_LOCALE" && cookieState.locale !== undefined
        ? { name, value: cookieState.locale }
        : undefined,
  }),
}));
vi.mock("@/lib/data/report-scope", () => ({ resolveReportScope: scopeMock }));
vi.mock("@/lib/data/report-requests", () => ({
  listReportExport: exportMock,
  listReportDocentes: docentesMock,
}));
vi.mock("@/lib/data/report-reads", () => ({ recordReportDownload: auditMock }));
vi.mock("@/lib/reports/build-workbook", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/reports/build-workbook")>();
  buildSpy.mockImplementation(
    async (...args: Parameters<typeof actual.buildWorkbook>) => {
      order.push("build");
      return actual.buildWorkbook(...args);
    },
  );
  return { ...actual, buildWorkbook: buildSpy };
});

import { GET } from "@/app/api/reports/justifications/route";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CARRERA = 3;
const SCOPE = { kind: "carrera", carreraId: CARRERA } as const;
const URL_BASE = "http://localhost/api/reports/justifications";

function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

function exported(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    estudianteNombre: `Student ${id}`,
    estudianteCif: `2021-00${id}`,
    causa: "medica",
    estado: "pendiente",
    fechaInicio: "2026-03-02",
    fechaFin: "2026-03-04",
    presentadaEn: new Date("2026-03-05T03:00:00Z"),
    classes: [
      {
        solicitudId: id,
        codigo: "MAT101",
        asignatura: "Calculo I",
        periodo: "2026-S1",
        docente: "Marta Ruiz",
      },
    ],
    ...overrides,
  };
}

function call(query = "") {
  return GET(new Request(`${URL_BASE}${query}`));
}

async function workbookOf(res: Response) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(await res.arrayBuffer()) as unknown as ExcelJS.Buffer,
  );
  return workbook;
}

/** The summary sheet as `label -> value`. */
function summaryOf(workbook: ExcelJS.Workbook) {
  const sheet = workbook.worksheets[1];
  return Object.fromEntries(
    Array.from({ length: sheet.rowCount }, (_, at) => {
      const row = sheet.getRow(at + 1);
      return [row.getCell(1).value, row.getCell(2).value];
    }),
  );
}

describe("GET /api/reports/justifications", () => {
  beforeEach(() => {
    order.length = 0;
    cookieState.locale = undefined;
    redirectMock.mockClear();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    scopeMock.mockReset();
    scopeMock.mockImplementation(async () => {
      order.push("scope");
      return SCOPE;
    });
    exportMock.mockReset();
    exportMock.mockImplementation(async () => {
      order.push("export");
      return [exported(2), exported(1)];
    });
    docentesMock.mockReset();
    docentesMock.mockImplementation(async () => {
      order.push("docentes");
      return [{ id: 12, name: "Marta Ruiz" }];
    });
    auditMock.mockReset();
    auditMock.mockImplementation(async () => {
      order.push("audit");
    });
    buildSpy.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("access (CR-ACC-1, CR-XLS-1)", () => {
    it("gives an in-career coordinator the workbook with the three headers", async () => {
      const res = await call();

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(XLSX_TYPE);
      expect(res.headers.get("Content-Disposition")).toBe(
        'attachment; filename="ReporteJustificaciones.xlsx"',
      );
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    });

    it.each(["administrador", "secretaria", "docente", "estudiante"] as const)(
      "denies %s: no read, no bytes, no audit row",
      async (rol) => {
        getSessionMock.mockResolvedValue(sessionFor(rol));

        await expect(call()).rejects.toThrow(`REDIRECT:${ACCESS_DENIED_PATH}`);

        expect(scopeMock).not.toHaveBeenCalled();
        expect(exportMock).not.toHaveBeenCalled();
        expect(buildSpy).not.toHaveBeenCalled();
        expect(auditMock).not.toHaveBeenCalled();
      },
    );

    it("sends an anonymous caller to /login and does nothing else", async () => {
      getSessionMock.mockResolvedValue(null);

      await expect(call()).rejects.toThrow("REDIRECT:/login");

      expect(exportMock).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    });

    it("sends a flagged coordinator to the password change", async () => {
      getSessionMock.mockResolvedValue(sessionFor("coordinacion", true));

      await expect(call()).rejects.toThrow(`REDIRECT:${PASSWORD_CHANGE_PATH}`);

      expect(exportMock).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    });

    it("redirects a coordinator without a career: nothing read, no row", async () => {
      scopeMock.mockResolvedValue({ kind: "none" });

      await expect(call()).rejects.toThrow(`REDIRECT:${ACCESS_DENIED_PATH}`);

      expect(exportMock).not.toHaveBeenCalled();
      expect(buildSpy).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    });

    it("resolves the scope for the session user and role", async () => {
      await call();

      expect(scopeMock).toHaveBeenCalledWith(7, "coordinacion");
    });
  });

  describe("the same filters as the detail (CR-XLS-1, RF-13 d)", () => {
    it("reads every period when none is given (no hidden default)", async () => {
      await call();

      expect(exportMock).toHaveBeenCalledWith(SCOPE, {
        periodo: null,
        docenteId: null,
        q: "",
        causa: null,
      });
    });

    it("passes the resolved period and every filter through the shared parser", async () => {
      await call("?period=2026-S1&docente=12&causa=medica&q=Ana");

      expect(exportMock).toHaveBeenCalledWith(SCOPE, {
        periodo: "2026-S1",
        docenteId: 12,
        q: "Ana",
        causa: "medica",
      });
    });

    it("ignores what the parser cannot read, like the screen does", async () => {
      await call("?period=2026-S9&docente=0&causa=nope&q=Ana&q=Eva&page=4");

      expect(exportMock).toHaveBeenCalledWith(SCOPE, {
        periodo: null,
        docenteId: null,
        q: "",
        causa: null,
      });
    });

    it("never pages: the file is not given a page", async () => {
      await call("?page=2");

      expect(exportMock.mock.calls[0]).toHaveLength(2);
    });
  });

  describe("audit gate (CR-XLS-4, RNF-06)", () => {
    it("writes one row after authorization and the read, once the file exists, before the response", async () => {
      await call("?period=2026-S1&docente=12&causa=medica&q=Ana");

      expect(auditMock).toHaveBeenCalledTimes(1);
      expect(auditMock).toHaveBeenCalledWith(
        7,
        CARRERA,
        "2026-S1",
        12,
        "medica",
        true,
        2,
      );
      expect(order).toEqual(["scope", "export", "docentes", "build", "audit"]);
    });

    it("audits the period as all, a false search and the total of the file", async () => {
      exportMock.mockResolvedValue([exported(3), exported(2), exported(1)]);

      await call();

      expect(auditMock).toHaveBeenCalledWith(
        7,
        CARRERA,
        "all",
        null,
        null,
        false,
        3,
      );
    });

    it("never hands the typed term to the audit writer", async () => {
      await call("?q=Maria+Lopez");

      expect(JSON.stringify(auditMock.mock.calls)).not.toContain("Maria");
      expect(auditMock.mock.calls[0][5]).toBe(true);
    });

    it("writes one row per download: two downloads, two rows", async () => {
      await call();
      await call();

      expect(auditMock).toHaveBeenCalledTimes(2);
    });

    it("answers 500 with no bytes when the audit insert fails", async () => {
      auditMock.mockRejectedValue(new Error("audit down"));

      const res = await call();

      expect(res.status).toBe(500);
      expect(res.headers.get("Content-Type")).not.toBe(XLSX_TYPE);
      expect(res.headers.get("Content-Disposition")).toBeNull();
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await res.json()).toEqual({ error: "export_failed" });
    });

    it("answers 500 and writes no row when the read fails", async () => {
      exportMock.mockRejectedValue(new Error("down"));

      const res = await call();

      expect(res.status).toBe(500);
      expect(buildSpy).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    });

    it("answers 500 and writes no row when the workbook cannot be built", async () => {
      buildSpy.mockRejectedValueOnce(new Error("no memory"));

      const res = await call();

      expect(res.status).toBe(500);
      expect(auditMock).not.toHaveBeenCalled();
    });

    it("logs the failure without its message, which could carry the search term", async () => {
      exportMock.mockRejectedValue(new Error('where ilike "%Maria Lopez%"'));

      await call("?q=Maria+Lopez");

      const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
      expect(logged).toContain("reports.export.failed");
      expect(logged).not.toContain("Maria");
    });
  });

  describe("workbook content (CR-XLS-2)", () => {
    it("holds one data row per request with the CR-DET-1 columns, in English for the en cookie", async () => {
      cookieState.locale = "en";

      const workbook = await workbookOf(await call());
      const data = workbook.worksheets[0];

      expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
        "Requests",
        "Summary",
      ]);
      expect((data.getRow(1).values as unknown[]).slice(1)).toEqual([
        "Student",
        "CIF",
        "Cause",
        "State",
        "Absence dates",
        "Submitted",
        "Classes",
      ]);
      expect(data.rowCount).toBe(3);
      expect((data.getRow(2).values as unknown[]).slice(1)).toEqual([
        "Student 2",
        "2021-002",
        "Medical",
        "Pending review",
        "2026-03-02 to 2026-03-04",
        // 03:00Z is still the 4th at 21:00 in the business zone (America/Managua).
        "2026-03-04",
        "Calculo I · Marta Ruiz · 2026-S1",
      ]);
    });

    it("joins several classes of a request into its one cell", async () => {
      cookieState.locale = "en";
      exportMock.mockResolvedValue([
        exported(1, {
          classes: [
            {
              solicitudId: 1,
              codigo: "MAT101",
              asignatura: "Calculo I",
              periodo: "2026-S1",
              docente: "Marta Ruiz",
            },
            {
              solicitudId: 1,
              codigo: "FIS101",
              asignatura: "Fisica",
              periodo: "2026-S2",
              docente: "Luis Pena",
            },
          ],
        }),
      ]);

      const data = (await workbookOf(await call())).worksheets[0];

      expect(data.rowCount).toBe(2);
      expect(data.getRow(2).getCell(7).value).toBe(
        "Calculo I · Marta Ruiz · 2026-S1\nFisica · Luis Pena · 2026-S2",
      );
    });

    it("keeps a student named like a formula as text in the downloaded file", async () => {
      exportMock.mockResolvedValue([
        exported(1, { estudianteNombre: "=1+1", estudianteCif: "@x" }),
        exported(2, { estudianteNombre: "-1", estudianteCif: "+1" }),
      ]);

      const data = (await workbookOf(await call())).worksheets[0];
      const cells = [
        data.getRow(2).getCell(1),
        data.getRow(2).getCell(2),
        data.getRow(3).getCell(1),
        data.getRow(3).getCell(2),
      ];

      expect(cells.map((cell) => cell.value)).toEqual([
        "=1+1",
        "@x",
        "-1",
        "+1",
      ]);
      expect(cells.map((cell) => cell.type)).toEqual(
        Array(4).fill(ExcelJS.ValueType.String),
      );
      expect(cells.map((cell) => cell.formula)).toEqual(
        Array(4).fill(undefined),
      );
    });

    it("lists the applied filters and the total in the summary", async () => {
      cookieState.locale = "en";

      const summary = summaryOf(
        await workbookOf(
          await call("?period=2026-S1&docente=12&causa=medica&q=Ana"),
        ),
      );

      expect(summary).toEqual({
        "Academic period": "2026-S1",
        Teacher: "Marta Ruiz",
        Student: "Ana",
        Cause: "Medical",
        "Total requests": 2,
      });
    });

    it("says every filter is open when none is applied", async () => {
      cookieState.locale = "en";

      const summary = summaryOf(await workbookOf(await call()));

      expect(summary).toEqual({
        "Academic period": "All periods",
        Teacher: "All teachers",
        Student: "All students",
        Cause: "All causes",
        "Total requests": 2,
      });
      expect(docentesMock).not.toHaveBeenCalled();
    });

    it("names a teacher outside the career generically, never by a looked-up name", async () => {
      cookieState.locale = "en";
      exportMock.mockResolvedValue([]);

      const summary = summaryOf(await workbookOf(await call("?docente=99")));

      expect(summary.Teacher).toBe("Teacher outside your career");
    });

    it("still downloads when nothing matches: headers and a total of 0", async () => {
      cookieState.locale = "en";
      exportMock.mockResolvedValue([]);

      const res = await call("?causa=medica");
      const workbook = await workbookOf(res);

      expect(res.status).toBe(200);
      expect(workbook.worksheets[0].rowCount).toBe(1);
      expect(summaryOf(workbook)["Total requests"]).toBe(0);
      expect(auditMock).toHaveBeenCalledWith(
        7,
        CARRERA,
        "all",
        null,
        "medica",
        false,
        0,
      );
    });
  });

  // Design open question 1, settled here: a route handler reads the user's
  // locale from the NEXT_LOCALE cookie through `cookies()` (the call the app's
  // own `getUserLocale` makes), and falls back to Spanish.
  describe("locale (CR-I18N-1, design open question 1)", () => {
    it("writes Spanish for the es cookie", async () => {
      cookieState.locale = "es";

      const res = await call("?period=2026-S1");
      const workbook = await workbookOf(res);

      expect(res.headers.get("Content-Disposition")).toContain(
        "ReporteJustificaciones.xlsx",
      );
      expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
        "Solicitudes",
        "Resumen",
      ]);
      expect(
        (workbook.worksheets[0].getRow(1).values as unknown[]).slice(1, 4),
      ).toEqual(["Estudiante", "CIF", "Causa"]);
      expect(workbook.worksheets[0].getRow(2).getCell(3).value).toBe(
        "Causa médica",
      );
      expect(summaryOf(workbook)["Total de solicitudes"]).toBe(2);
    });

    it("writes English for the en cookie, with an English file name", async () => {
      cookieState.locale = "en";

      const res = await call();

      expect(res.headers.get("Content-Disposition")).toBe(
        'attachment; filename="JustificationsReport.xlsx"',
      );
    });

    it.each([
      ["no cookie", undefined],
      ["an unsupported locale", "fr"],
      ["an empty value", ""],
    ])("falls back to Spanish with %s", async (_name, value) => {
      cookieState.locale = value;

      const workbook = await workbookOf(await call());

      expect(workbook.worksheets[0].name).toBe("Solicitudes");
    });
  });
});
