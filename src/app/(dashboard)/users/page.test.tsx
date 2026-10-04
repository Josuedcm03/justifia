import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../i18n/en.json";
import esMessages from "../../../../i18n/es.json";
import type { RolUsuario } from "@/lib/validations/auth";

const { requireRoleMock, listUsuariosMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  listUsuariosMock: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data/users", () => ({
  listUsuarios: listUsuariosMock,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getFormatter: async () => ({ dateTime: () => "" }),
}));

import { rolesQueCreanUsuarios } from "@/lib/auth/permissions";
import { USERS_PAGE_SIZE } from "@/lib/users/list-params";

function sessionFor(rol: RolUsuario) {
  return { sub: "1", login: "caller", rol, nombre: "Caller" };
}

function usuarioRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    nombreCompleto: "Ana Lopez",
    login: "alopez",
    rol: "docente",
    activo: true,
    creadoEn: new Date("2026-01-01"),
    ...overrides,
  };
}

function searchParamsOf(params: Record<string, string>) {
  return Promise.resolve(params);
}

async function renderUsersPage(searchParams: Promise<Record<string, string>>) {
  const { default: UsersPage } = await import("@/app/(dashboard)/users/page");
  return render(await UsersPage({ searchParams }));
}

describe("UsersPage", () => {
  // The first dynamic import transforms the whole page tree. Paying for it
  // inside the first test made that test race the 5s default under load.
  beforeAll(async () => {
    await import("@/app/(dashboard)/users/page");
  }, 60_000);

  // Calls from earlier tests must not satisfy later toHaveBeenCalledWith.
  beforeEach(() => {
    requireRoleMock.mockClear();
    listUsuariosMock.mockClear();
  });

  it("guards with exactly rolesQueCreanUsuarios", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("secretaria"));
    listUsuariosMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: USERS_PAGE_SIZE,
      degraded: false,
    });

    await renderUsersPage(searchParamsOf({}));

    expect(requireRoleMock).toHaveBeenCalledWith(...rolesQueCreanUsuarios);
  });

  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "passes the SESSION role to listUsuarios for %s, never a URL value",
    async (rol) => {
      requireRoleMock.mockResolvedValue(sessionFor(rol));
      listUsuariosMock.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: USERS_PAGE_SIZE,
        degraded: false,
      });

      await renderUsersPage(
        searchParamsOf({ viewerRol: "administrador", rol: "administrador" }),
      );

      expect(listUsuariosMock).toHaveBeenCalledWith(
        expect.objectContaining({ viewerRol: rol }),
      );
    },
  );

  it("forwards q and page from parseUsersListParams, with USERS_PAGE_SIZE", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 2,
      pageSize: USERS_PAGE_SIZE,
      degraded: false,
    });

    await renderUsersPage(searchParamsOf({ q: "  Ana  ", page: "2" }));

    expect(listUsuariosMock).toHaveBeenCalledWith({
      viewerRol: "administrador",
      q: "Ana",
      page: 2,
      pageSize: USERS_PAGE_SIZE,
    });
  });

  it("renders the degraded pill and no misleading count or empty message", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: USERS_PAGE_SIZE,
      degraded: true,
    });

    await renderUsersPage(searchParamsOf({ q: "zz", page: "3" }));

    expect(screen.getByText("degraded")).toBeInTheDocument();
    expect(screen.queryByText("empty")).not.toBeInTheDocument();
    expect(screen.queryByText("noResults.title")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /count/i }),
    ).not.toBeInTheDocument();
  });

  it("renders users.empty when the scope has zero rows and no search term", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: USERS_PAGE_SIZE,
      degraded: false,
    });

    await renderUsersPage(searchParamsOf({}));

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("renders users.noResults.* and a clear control when a search has no results", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: USERS_PAGE_SIZE,
      degraded: false,
    });

    await renderUsersPage(searchParamsOf({ q: "zz" }));

    expect(screen.getByText("noResults.title")).toBeInTheDocument();
    expect(screen.getByText("noResults.hint")).toBeInTheDocument();

    const clear = screen.getByRole("link", { name: "search.clear" });
    expect(clear).toHaveAttribute("href", "/users");
  });

  it("exposes the result count in a polite status region", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue({
      data: [usuarioRow()],
      total: 5,
      page: 1,
      pageSize: USERS_PAGE_SIZE,
      degraded: false,
    });

    await renderUsersPage(searchParamsOf({}));

    const status = screen.getByText("count");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("shows the new-user button to every creator", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("secretaria"));
    listUsuariosMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: USERS_PAGE_SIZE,
      degraded: false,
    });

    await renderUsersPage(searchParamsOf({}));

    const buttons = screen.getAllByRole("link", { name: "newButton" });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toHaveAttribute("href", "/users/new");
    }
  });

  it("gives the DataTable a caption and shows the role as its code", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue({
      data: [usuarioRow({ rol: "secretaria" })],
      total: 1,
      page: 1,
      pageSize: USERS_PAGE_SIZE,
      degraded: false,
    });

    await renderUsersPage(searchParamsOf({}));

    expect(screen.getByText("tableCaption")).toBeInTheDocument();
    expect(screen.getByText("secretaria")).toBeInTheDocument();
  });

  it("keeps the es and en users-list keys in sync and non-empty", () => {
    const es = esMessages.users as Record<string, unknown>;
    const en = enMessages.users as Record<string, unknown>;

    function keysOf(value: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(value).flatMap(([key, v]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          return keysOf(v as Record<string, unknown>, path);
        }
        return [path];
      });
    }

    const newKeyPrefixes = [
      "search.",
      "count",
      "tableCaption",
      "noResults.",
      "pagination.",
    ];
    const isNewKey = (key: string) =>
      newKeyPrefixes.some((prefix) => key.startsWith(prefix));

    const esKeys = keysOf(es).filter(isNewKey).sort();
    const enKeys = keysOf(en).filter(isNewKey).sort();

    expect(esKeys.length).toBeGreaterThan(0);
    expect(esKeys).toEqual(enKeys);

    for (const key of esKeys) {
      const [head, ...rest] = key.split(".");
      let esValue: unknown = es[head];
      let enValue: unknown = en[head];
      for (const part of rest) {
        esValue = (esValue as Record<string, unknown>)[part];
        enValue = (enValue as Record<string, unknown>)[part];
      }
      expect(esValue).not.toBe("");
      expect(enValue).not.toBe("");
    }
  });
});
