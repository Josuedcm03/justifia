// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { parseWorkbook } from "@/lib/import/parse";
import type { RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock, buildTemplateSpy } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  buildTemplateSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// The REAL dal runs on top of a mocked session source, so the guard order
// (flag, then role, then canImportCatalog) is the production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/import/template", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/import/template")>();
  buildTemplateSpy.mockImplementation(actual.buildTemplate);
  return { ...actual, buildTemplate: buildTemplateSpy };
});

import { GET } from "@/app/api/catalog/template/route";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

describe("GET /api/catalog/template", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getSessionMock.mockReset();
    buildTemplateSpy.mockClear();
  });

  it("gives secretaria an xlsx attachment with the three sheets", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(XLSX_TYPE);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="PlantillaCatalogo.xlsx"',
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    // parse.ts rejects a workbook missing any of the three sheets, so an ok
    // result with empty sheets proves the downloaded file is the template.
    const parsed = await parseWorkbook(bytes);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.workbook.sheets)).toEqual([
      "Asignaturas",
      "Docentes",
      "Grupos",
    ]);
    expect(Object.values(parsed.workbook.sheets).flat()).toHaveLength(0);
  });

  it("sets headers that stop an intermediary from caching the file", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));

    const res = await GET();

    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it.each(["administrador", "coordinacion", "docente", "estudiante"] as const)(
    "denies %s and builds no bytes",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(GET()).rejects.toThrow(`REDIRECT:${ACCESS_DENIED_PATH}`);

      expect(buildTemplateSpy).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and builds no bytes", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(GET()).rejects.toThrow("REDIRECT:/login");

    expect(buildTemplateSpy).not.toHaveBeenCalled();
  });

  it("sends a flagged secretaria to the password change and builds no bytes", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria", true));

    await expect(GET()).rejects.toThrow(`REDIRECT:${PASSWORD_CHANGE_PATH}`);

    expect(buildTemplateSpy).not.toHaveBeenCalled();
  });

  it("serves a secretaria whose flag is explicitly false", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria", false));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(buildTemplateSpy).toHaveBeenCalledTimes(1);
  });
});
