import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { IMPORT_MAX_DURATION_SECONDS } from "@/lib/import/limits";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock, importFormMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  importFormMock: vi.fn(() => <p>import-form</p>),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// The REAL dal runs on a mocked session source, so the guard order (flag,
// role, then canImportCatalog) is the production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));

vi.mock("@/app/(dashboard)/catalog/import/import-form", () => ({
  ImportForm: importFormMock,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) =>
    (enMessages.catalog.import as Record<string, unknown>)[key] ?? key,
}));

import * as pageModule from "@/app/(dashboard)/catalog/import/page";
import { canImportCatalog } from "@/lib/auth/permissions";

const Page = pageModule.default;

function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  importFormMock.mockClear();
});

describe("CatalogImportPage (CEI: Only secretaria may import)", () => {
  it("renders the title, the subtitle and the import form for secretaria", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));

    render(await Page());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      enMessages.catalog.import.title,
    );
    expect(
      screen.getByText(enMessages.catalog.import.subtitle),
    ).toBeInTheDocument();
    expect(importFormMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each(rolesUsuario.filter((rol) => !canImportCatalog(rol)))(
    "sends %s to /denied without rendering the form",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(Page()).rejects.toThrow(`REDIRECT:${ACCESS_DENIED_PATH}`);

      expect(importFormMock).not.toHaveBeenCalled();
    },
  );

  it("covers every role: exactly one may open the page", () => {
    expect(rolesUsuario.filter(canImportCatalog)).toEqual(["secretaria"]);
    expect(rolesUsuario.filter((rol) => !canImportCatalog(rol))).toHaveLength(
      4,
    );
  });

  it("sends an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(Page()).rejects.toThrow("REDIRECT:/login");

    expect(importFormMock).not.toHaveBeenCalled();
  });

  it("sends a secretaria who must change the password to the change screen", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria", true));

    await expect(Page()).rejects.toThrow(`REDIRECT:${PASSWORD_CHANGE_PATH}`);

    expect(importFormMock).not.toHaveBeenCalled();
  });
});

describe("CatalogImportPage route segment config (design F4)", () => {
  it("raises the Server Actions timeout to the decided ceiling", () => {
    expect(pageModule.maxDuration).toBe(IMPORT_MAX_DURATION_SECONDS);
    expect(pageModule.maxDuration).toBe(300);
  });
});
