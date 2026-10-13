import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../i18n/en.json";
import esMessages from "../../../../i18n/es.json";
import type { RolUsuario } from "@/lib/validations/auth";

const { requireRoleMock, listUsuariosMock, deliveredRows } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  listUsuariosMock: vi.fn(),
  /** Rows handed to the table component, one entry per render. */
  deliveredRows: [] as unknown[][],
}));

vi.mock("@/lib/auth/dal", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data/users", () => ({
  listUsuarios: listUsuariosMock,
}));

// Spy on the rows the page hands to the table; the real component still renders.
vi.mock("@/components/data-table", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/data-table")>();
  return {
    ...actual,
    DataTable: ((props: Parameters<typeof actual.DataTable>[0]) => {
      deliveredRows.push([...props.rows]);
      return actual.DataTable(props);
    }) as typeof actual.DataTable,
  };
});

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getFormatter: async () => ({ dateTime: () => "1 ene 2026" }),
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

function emptyResult(pageSize: number) {
  return { data: [], total: 0, page: 1, pageSize, degraded: false };
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
    requireRoleMock.mockReset();
    listUsuariosMock.mockClear();
    deliveredRows.length = 0;
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
      status: "all",
      sort: { key: "created", dir: "desc" },
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

  it("forwards status, sort, dir and size parsed (UL:sort, UL:status, UL:pag)", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue(emptyResult(25));

    await renderUsersPage(
      searchParamsOf({
        q: "Ana",
        status: "inactive",
        sort: "name",
        dir: "desc",
        size: "25",
        page: "2",
      }),
    );

    expect(listUsuariosMock).toHaveBeenCalledWith({
      viewerRol: "administrador",
      q: "Ana",
      status: "inactive",
      sort: { key: "name", dir: "desc" },
      page: 2,
      pageSize: 25,
    });
  });

  it.each([
    ["a SQL injection in sort", { sort: '\'; DROP TABLE "Usuario"; --' }],
    ["an oversized page size", { size: "9999" }],
    ["a role override", { role: "administrador" }],
    ["a scope override", { scope: "all" }],
    ["a private column as sort", { sort: "hashClave", dir: "desc" }],
    ["an unknown status", { status: "everything" }],
    [
      "all of them together",
      {
        sort: '\'; DROP TABLE "Usuario"; --',
        size: "9999",
        role: "administrador",
        scope: "all",
        status: "bogus",
        dir: "sideways",
      },
    ],
  ])(
    "hostile %s reaches listUsuarios as the defaults (UL:scope)",
    async (_label, params) => {
      requireRoleMock.mockResolvedValue(sessionFor("secretaria"));
      listUsuariosMock.mockResolvedValue(emptyResult(10));

      await renderUsersPage(searchParamsOf(params));

      expect(listUsuariosMock).toHaveBeenCalledTimes(1);
      expect(listUsuariosMock).toHaveBeenCalledWith({
        viewerRol: "secretaria",
        q: "",
        status: "all",
        sort: { key: "created", dir: "desc" },
        page: 1,
        pageSize: 10,
      });
    },
  );

  it("page links keep status, sort and size (DT-URL-2: paging keeps the view)", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue({
      data: [usuarioRow()],
      total: 60,
      page: 1,
      pageSize: 25,
      degraded: false,
    });

    await renderUsersPage(
      searchParamsOf({
        q: "ana",
        status: "inactive",
        sort: "name",
        dir: "desc",
        size: "25",
      }),
    );

    expect(
      screen.getByRole("link", { name: "pagination.next" }),
    ).toHaveAttribute(
      "href",
      "/users?q=ana&status=inactive&sort=name&dir=desc&size=25&page=2",
    );
  });

  it("a denied role is redirected before any read happens", async () => {
    requireRoleMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      renderUsersPage(
        searchParamsOf({ sort: "name", status: "active", size: "50" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(listUsuariosMock).not.toHaveBeenCalled();
  });

  it("runs the guard before the read", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue(emptyResult(10));

    await renderUsersPage(searchParamsOf({}));

    expect(requireRoleMock.mock.invocationCallOrder[0]).toBeLessThan(
      listUsuariosMock.mock.invocationCallOrder[0],
    );
  });

  it("degraded with every parameter shows the alert only (UL:soft)", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("administrador"));
    listUsuariosMock.mockResolvedValue({ ...emptyResult(25), degraded: true });

    await renderUsersPage(
      searchParamsOf({
        status: "inactive",
        sort: "name",
        dir: "desc",
        size: "25",
        page: "2",
      }),
    );

    expect(screen.getByText("degraded")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("count")).not.toBeInTheDocument();
    expect(screen.queryByText("empty")).not.toBeInTheDocument();
    expect(screen.queryByText("noResults.title")).not.toBeInTheDocument();
    expect(deliveredRows).toHaveLength(0);
  });

  describe("the browser receives only displayed fields (UL:fields)", () => {
    const secrets = {
      hashClave: "HASH-SECRET-VALUE",
      cif: "CIF-SECRET-VALUE",
      telefono: "TEL-SECRET-VALUE",
      correo: "mail-secret@example.org",
    };

    const forbidden = Object.entries(secrets).map(([key, value]) => ({
      key,
      value,
    }));

    const cases = (
      ["administrador", "secretaria", "coordinacion"] as const
    ).flatMap((rol) => [
      { rol, q: "" },
      { rol, q: "mail-secret" },
    ]);

    it.each(cases)(
      "delivers exactly six fields for $rol with q=$q",
      async ({ rol, q }) => {
        requireRoleMock.mockResolvedValue(sessionFor(rol));
        listUsuariosMock.mockResolvedValue({
          ...emptyResult(10),
          data: [
            usuarioRow({ ...secrets, id: 7, rol: "docente" }),
            usuarioRow({ ...secrets, id: 8, activo: false }),
          ],
          total: 2,
        });

        await renderUsersPage(searchParamsOf(q ? { q } : {}));

        expect(deliveredRows).toHaveLength(1);
        const rows = deliveredRows[0];
        expect(rows).toHaveLength(2);
        for (const row of rows) {
          expect(Object.keys(row as object).sort()).toEqual(
            [
              "activo",
              "creadoEnLabel",
              "id",
              "login",
              "nombreCompleto",
              "rol",
            ].sort(),
          );
        }
        expect(rows[0]).toEqual({
          id: 7,
          nombreCompleto: "Ana Lopez",
          login: "alopez",
          rol: "docente",
          activo: true,
          creadoEnLabel: "1 ene 2026",
        });
      },
    );

    it.each(forbidden)(
      "the serialized rows contain neither the $key key nor its value",
      async ({ key, value }) => {
        requireRoleMock.mockResolvedValue(sessionFor("administrador"));
        listUsuariosMock.mockResolvedValue({
          ...emptyResult(10),
          data: [usuarioRow(secrets)],
          total: 1,
        });

        await renderUsersPage(searchParamsOf({ q: "mail-secret" }));

        expect(deliveredRows).toHaveLength(1);
        const serialized = JSON.stringify(deliveredRows[0]);
        expect(serialized).toContain("alopez");
        expect(serialized).not.toContain(key);
        expect(serialized).not.toContain(value);
      },
    );

    it("the rendered markup does not carry the secret values either", async () => {
      requireRoleMock.mockResolvedValue(sessionFor("administrador"));
      listUsuariosMock.mockResolvedValue({
        ...emptyResult(10),
        data: [usuarioRow(secrets)],
        total: 1,
      });

      const { container } = await renderUsersPage(searchParamsOf({}));

      expect(container.textContent).toContain("alopez");
      for (const value of Object.values(secrets)) {
        expect(container.innerHTML).not.toContain(value);
      }
    });
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
