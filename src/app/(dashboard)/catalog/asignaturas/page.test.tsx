import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { catalogListHref } from "@/lib/catalog/list-params";
import { DEFAULT_PAGE_SIZE } from "@/lib/list-params";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock, getCatalogActorMock, listMock, state } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    getSessionMock: vi.fn(),
    getCatalogActorMock: vi.fn(),
    listMock: vi.fn(),
    state: { locale: "en" as "en" | "es" },
  }));

// `redirect` is the guard's; the router and link stand-ins serve the client
// table the page renders.
vi.mock("next/navigation", async () => ({
  ...(await import("@/test/navigation-mock")).module,
  redirect: redirectMock,
}));
vi.mock(
  "next/link",
  async () => (await import("@/test/navigation-mock")).linkModule,
);

// The REAL dal and the REAL requireCatalogAccess run on a mocked session
// source and a mocked actor read, so the guard order is the production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/users", () => ({ getCatalogActor: getCatalogActorMock }));
vi.mock("@/lib/data/asignaturas", () => ({ listAsignaturas: listMock }));

// The real catalogs through next-intl's own translator: a missing key throws.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: state.locale,
      messages: state.locale === "es" ? esMessages : enMessages,
      namespace: namespace as "catalog.asignaturas",
      onError: (error: Error) => {
        throw error;
      },
    }),
}));

const BASE = "/catalog/asignaturas";

function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    codigo: "MAT101",
    nombre: "Calculus",
    carreraId: 3,
    carreraNombre: "Engineering",
    horasTotales: 64,
    activo: true,
    grupos: null,
    gruposCoincidentes: [],
    gruposCoincidentesTotal: 0,
    ...overrides,
  };
}

function grupoMatch(
  id: number,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    periodo: "2026-S1",
    numeroGrupo: String(id),
    docenteNombre: "Ana Pérez",
    activo: true,
    ...overrides,
  };
}

function result(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    degraded: false,
    ...overrides,
  };
}

let Page: (props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => Promise<React.ReactNode>;

async function renderPage(
  params: Record<string, string | string[] | undefined> = {},
) {
  const ui = await Page({ searchParams: Promise.resolve(params) });
  return render(
    <NextIntlClientProvider
      locale={state.locale}
      messages={state.locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

const en = enMessages.catalog.asignaturas;
const shared = enMessages.catalog.shared;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/asignaturas/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getCatalogActorMock.mockReset();
  getCatalogActorMock.mockResolvedValue({ carreraId: null });
  listMock.mockReset();
  listMock.mockResolvedValue(result());
});

describe("AsignaturasPage access (CM-ACC-1: matrix, denial destinations)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "renders the list for %s",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({
        carreraId: rol === "coordinacion" ? 3 : null,
      });

      await renderPage();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        en.title,
      );
      expect(redirectMock).not.toHaveBeenCalled();
      expect(listMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each(rolesUsuario.filter((r) => r === "docente" || r === "estudiante"))(
    "sends %s to /denied and makes no data-layer call",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(listMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login with no data-layer call", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    expect(getCatalogActorMock).not.toHaveBeenCalled();
    expect(listMock).not.toHaveBeenCalled();
  });

  it.each(["secretaria", "docente"] as const)(
    "sends a flagged %s to the change screen before anything else",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol, true));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${PASSWORD_CHANGE_PATH}`,
      );

      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(listMock).not.toHaveBeenCalled();
    },
  );
});

describe("AsignaturasPage scope (CM-SCOPE-1: Lists limited; CM-SCOPE-2: Empty state)", () => {
  it.each(["administrador", "secretaria"] as const)(
    "lists with scope all for %s, whatever the URL says",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await renderPage({ carreraId: "9", scope: "carrera" });

      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({ scope: { kind: "all" } }),
      );
    },
  );

  it("lists with the own carrera for coordinacion, never a URL value", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });

    await renderPage({ carreraId: "9", scope: "all" });

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { kind: "carrera", carreraId: 3 } }),
    );
  });

  it("explains a coordinacion without a Carrera, with no create button and no query", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });

    await renderPage();

    expect(listMock).not.toHaveBeenCalled();
    expect(screen.getByText(shared.noCarrera.title)).toBeInTheDocument();
    expect(screen.getByText(shared.noCarrera.message)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.title,
    );
    // Distinct from "no results" and from "empty".
    expect(screen.queryByText(en.empty)).not.toBeInTheDocument();
    expect(screen.queryByText(en.noResults.hint)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en.newButton })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("search")).toBeNull();
  });
});

describe("AsignaturasPage list params (CM-LST-1: Default, Search, Pagination, Unrecognised status)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("passes status, q, page, sort and size through, parsed (CM-LST-1, DT-URL-1)", async () => {
    await renderPage({
      status: "inactive",
      q: "  calc  ",
      page: "2",
      sort: "hours",
      dir: "desc",
      size: "25",
    });

    expect(listMock).toHaveBeenCalledWith({
      scope: { kind: "all" },
      status: "inactive",
      q: "calc",
      page: 2,
      pageSize: 25,
      sort: { key: "hours", dir: "desc" },
    });
  });

  it("passes today's order and the default size when no sort or size is given", async () => {
    await renderPage();

    expect(listMock).toHaveBeenCalledWith({
      scope: { kind: "all" },
      status: "active",
      q: "",
      page: 1,
      pageSize: 10,
      sort: { key: "code", dir: "asc" },
    });
  });

  it.each([
    [{ sort: "groups", dir: "desc" }],
    [{ sort: "hashClave" }],
    [{ sort: "name;drop", dir: "asc" }],
    [{ sort: "Name", dir: "desc" }],
    [{ sort: ["name", "hours"] }],
    [{ size: "7" }],
    [{ size: "9999" }],
    [{ size: ["25", "50"] }],
  ] as const)(
    "gives the data layer the defaults for the hostile values %j",
    async (params) => {
      await renderPage({ ...params } as Record<string, string | string[]>);

      const call = listMock.mock.calls[0][0] as {
        sort: { key: string; dir: string };
        pageSize: number;
      };
      expect(call.pageSize).toBe(10);
      expect(call.sort).toEqual({ key: "code", dir: "asc" });
    },
  );

  it("keeps a valid sort key and falls back to ascending for an unknown direction", async () => {
    await renderPage({ sort: "name", dir: "sideways" });

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: { key: "name", dir: "asc" } }),
    );
  });

  it("never widens the Carrera scope with carreraId, carrera or scope in the URL", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });

    await renderPage({ carreraId: "9", carrera: "Y", scope: "all" });

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { kind: "carrera", carreraId: 3 } }),
    );
  });

  it("defaults to active, page 1 and an empty search", async () => {
    await renderPage();

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", q: "", page: 1 }),
    );
  });

  it("treats status=bogus as active", async () => {
    await renderPage({ status: "bogus" });

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );
  });

  it.each(["x", "0"])("treats page=%s as page 1", async (page) => {
    await renderPage({ page });

    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });
});

describe("AsignaturasPage rows (CM-LST-1: Filter, state in words; CM-UX-1)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("shows code, name, carrera, hours and the state word, mixed under status=all", async () => {
    listMock.mockResolvedValue(
      result({
        total: 2,
        data: [
          row(),
          row({
            id: 13,
            codigo: "FIS200",
            nombre: "Physics",
            carreraNombre: "Sciences",
            horasTotales: 48,
            activo: false,
          }),
        ],
      }),
    );

    await renderPage({ status: "all" });

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    const active = rows[1];
    const inactive = rows[2];
    for (const text of ["MAT101", "Calculus", "Engineering", "64"]) {
      expect(within(active).getByText(text)).toBeInTheDocument();
    }
    expect(within(active).getByText(shared.status.active)).toBeInTheDocument();
    for (const text of ["FIS200", "Physics", "Sciences", "48"]) {
      expect(within(inactive).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(inactive).getByText(shared.status.inactive),
    ).toBeInTheDocument();
  });

  it("shows the active group numbers, a hyphen for none, between hours and status", async () => {
    listMock.mockResolvedValue(
      result({
        total: 3,
        data: [
          row({ grupos: "1, 2" }),
          row({ id: 13, codigo: "FIS200", grupos: null }),
          row({ id: 14, codigo: "QUI300", grupos: "" }),
        ],
      }),
    );

    await renderPage();

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      expect.stringContaining(en.columns.code),
      expect.stringContaining(en.columns.name),
      en.columns.career,
      expect.stringContaining(en.columns.hours),
      en.columns.groups,
      expect.stringContaining(en.columns.status),
      en.columns.actions,
    ]);
    // Only code, name, hours and status sort; Career, Groups and the action
    // column carry no button (CM-LST-1).
    expect(headers.map((h) => h.querySelector("button") !== null)).toEqual([
      true,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
    const rows = within(table).getAllByRole("row");
    const cellOf = (index: number) =>
      within(rows[index]).getAllByRole("cell")[4];
    expect(cellOf(1)).toHaveTextContent(/^1, 2$/);
    expect(cellOf(2)).toHaveTextContent(/^-$/);
    expect(cellOf(3)).toHaveTextContent(/^-$/);
  });

  describe("groups that matched the search (CM-ASG-9, UG-6)", () => {
    const nameCell = (rowIndex: number) =>
      within(
        within(screen.getByRole("table")).getAllByRole("row")[rowIndex],
      ).getAllByRole("cell")[1];

    it("names up to three matching groups under the subject name, an inactive one in words, and the remainder", async () => {
      listMock.mockResolvedValue(
        result({
          total: 1,
          data: [
            row({
              gruposCoincidentes: [
                grupoMatch(1),
                grupoMatch(2, { activo: false, periodo: "2025-S2" }),
                grupoMatch(3, { docenteNombre: "Luis Soto" }),
              ],
              gruposCoincidentesTotal: 4,
            }),
          ],
        }),
      );

      await renderPage({ q: "2026" });

      const cell = nameCell(1);
      expect(cell).toHaveTextContent("Calculus");
      const list = within(cell).getByRole("list", { name: en.matches.label });
      const items = within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent);
      expect(items).toEqual([
        "2026-S1 · Group 1 · Ana Pérez",
        "2025-S2 · Group 2 · Ana Pérez (inactive)",
        "2026-S1 · Group 3 · Luis Soto",
        "+1 more",
      ]);
      const table = screen.getByRole("table");
      expect(
        within(table)
          .getAllByRole("link")
          .map((a) => a.getAttribute("href")),
      ).toEqual([`${BASE}/12/edit`]);
      expect(table.querySelector("form")).toBeNull();
    });

    it("adds no remainder line when every match is named", async () => {
      listMock.mockResolvedValue(
        result({
          total: 1,
          data: [
            row({
              gruposCoincidentes: [grupoMatch(1), grupoMatch(2)],
              gruposCoincidentesTotal: 2,
            }),
          ],
        }),
      );

      await renderPage({ q: "perez" });

      const items = within(
        within(nameCell(1)).getByRole("list", { name: en.matches.label }),
      ).getAllByRole("listitem");
      expect(items).toHaveLength(2);
      expect(nameCell(1)).not.toHaveTextContent(/more/);
    });

    it("renders no list and no placeholder for a row that matched only by code or name", async () => {
      listMock.mockResolvedValue(
        result({
          total: 2,
          data: [
            row(),
            row({
              id: 13,
              codigo: "FIS200",
              nombre: "Physics",
              gruposCoincidentes: [grupoMatch(7)],
              gruposCoincidentesTotal: 1,
            }),
          ],
        }),
      );

      await renderPage({ q: "calc" });

      expect(within(nameCell(1)).queryByRole("list")).toBeNull();
      expect(nameCell(1)).toHaveTextContent(/^Calculus$/);
      expect(within(nameCell(2)).getAllByRole("listitem")).toHaveLength(1);
    });

    it("renders the lines in Spanish", async () => {
      state.locale = "es";
      listMock.mockResolvedValue(
        result({
          total: 1,
          data: [
            row({
              gruposCoincidentes: [grupoMatch(1, { activo: false })],
              gruposCoincidentesTotal: 1,
            }),
          ],
        }),
      );

      await renderPage({ q: "perez" });

      const list = within(nameCell(1)).getByRole("list", {
        name: esMessages.catalog.asignaturas.matches.label,
      });
      expect(list).toHaveTextContent(
        "2026-S1 · Grupo 1 · Ana Pérez (inactivo)",
      );
    });
  });

  it("renders the Groups header and the cell in Spanish", async () => {
    state.locale = "es";
    listMock.mockResolvedValue(
      result({ total: 1, data: [row({ grupos: "3" })] }),
    );

    await renderPage();

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", {
        name: esMessages.catalog.asignaturas.columns.groups,
      }),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole("cell")[4]).toHaveTextContent(/^3$/);
  });

  it("offers one Edit link per row, also for inactive rows, and no other control", async () => {
    listMock.mockResolvedValue(
      result({
        total: 2,
        data: [row(), row({ id: 13, codigo: "FIS200", activo: false })],
      }),
    );

    await renderPage({ status: "all" });

    const table = screen.getByRole("table");
    for (const tr of within(table).getAllByRole("row").slice(1)) {
      expect(within(tr).queryAllByRole("button")).toHaveLength(0);
    }
    const links = within(table).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      `${BASE}/12/edit`,
      `${BASE}/13/edit`,
    ]);
    expect(links[0]).toHaveAccessibleName(`${en.edit} MAT101`);
    expect(links[1]).toHaveAccessibleName(`${en.edit} FIS200`);
  });

  it("gives the table a caption and exposes the count politely", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage();

    expect(screen.getByRole("table")).toHaveAccessibleName(
      new RegExp(en.tableCaption),
    );
    const count = screen.getByText("1 result");
    expect(count).toHaveAttribute("role", "status");
    expect(count).toHaveAttribute("aria-live", "polite");
  });

  it("builds pagination links that keep q and status", async () => {
    listMock.mockResolvedValue(
      result({ total: 25, page: 2, data: [row()], pageSize: 10 }),
    );

    await renderPage({ status: "all", q: "calc", page: "2" });

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      catalogListHref(BASE, { q: "calc", status: "all" }),
    );
    expect(within(nav).getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      catalogListHref(BASE, { q: "calc", status: "all", page: 3 }),
    );
  });
});

describe("AsignaturasPage states (CM-LST-1: Empty states, Database unavailable)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("shows one sentence and the create button when there is nothing at all", async () => {
    await renderPage();

    expect(screen.getByText(en.empty)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    for (const button of screen.getAllByRole("link", { name: en.newButton })) {
      expect(button).toHaveAttribute("href", `${BASE}/new`);
    }
  });

  it("shows no results and a clear link that returns to the default view, keeping sort and size", async () => {
    await renderPage({
      q: "zz",
      status: "inactive",
      sort: "name",
      dir: "desc",
      size: "25",
      page: "2",
    });

    expect(screen.getByText(`No results for “zz”`)).toBeInTheDocument();
    expect(screen.getByText(en.noResults.hint)).toBeInTheDocument();
    expect(screen.queryByText(en.empty)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      `${BASE}?sort=name&dir=desc&size=25`,
    );
  });

  it("shows no results for a term alone and clears to the plain list", async () => {
    await renderPage({ q: "zz" });

    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      BASE,
    );
  });

  it("shows no results, not the empty sentence, for a status filter that matches nothing", async () => {
    await renderPage({ status: "inactive" });

    expect(screen.getByText(en.noResults.titleStatus)).toBeInTheDocument();
    expect(screen.queryByText(en.empty)).not.toBeInTheDocument();
  });

  it.each(["inactive", "all"] as const)(
    "carries status=%s in the search form as a hidden field",
    async (status) => {
      listMock.mockResolvedValue(result({ total: 1, data: [row()] }));
      await renderPage({ status });

      const form = screen.getByRole("search");
      const hidden = form.querySelector('input[type="hidden"][name="status"]');
      expect(hidden).toHaveAttribute("value", status);
      expect(form).toHaveAttribute("action", BASE);
    },
  );

  it("renders the status filter as a labelled group of links", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));
    await renderPage({ status: "inactive", q: "calc" });

    const filter = screen.getByRole("group", { name: "Filter by status" });
    expect(within(filter).getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      catalogListHref(BASE, { q: "calc", status: "all" }),
    );
  });

  it("renders a status notice and no table, count or raw error when degraded", async () => {
    listMock.mockResolvedValue(result({ degraded: true }));

    const { container } = await renderPage({
      q: "zz",
      page: "2",
      sort: "name",
      dir: "desc",
      size: "25",
    });

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(en.degraded);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("search")).toBeNull();
    expect(
      screen.queryByRole("group", { name: "Filter by status" }),
    ).toBeNull();
    expect(screen.queryByText(en.empty)).not.toBeInTheDocument();
    expect(screen.queryByText(en.noResults.hint)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/error|exception|ECONN/i);
  });
});

describe("AsignaturasPage structure and copy (CM-NFR-3; CM-I18N-1)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it.each(["empty", "rows", "no-results", "degraded"] as const)(
    "has exactly one h1 and no skipped levels (%s)",
    async (variant) => {
      listMock.mockResolvedValue(
        variant === "rows"
          ? result({ total: 1, data: [row()] })
          : result({ degraded: variant === "degraded" }),
      );

      await renderPage(variant === "no-results" ? { q: "zz" } : {});

      const levels = screen
        .getAllByRole("heading")
        .map((h) => Number(h.tagName.slice(1)));
      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);
      levels.slice(1).forEach((level, i) => {
        expect(level - levels[i]).toBeLessThanOrEqual(1);
      });
    },
  );

  it("wraps its content in the page frame and renders exactly one h1", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage();

    const frames = document.querySelectorAll('[data-slot="page-frame"]');
    expect(frames).toHaveLength(1);
    const frame = frames[0] as HTMLElement;
    expect(frame).toHaveClass("flex", "flex-col", "gap-8");
    expect(within(frame).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders the title and the state word in Spanish", async () => {
    state.locale = "es";
    listMock.mockResolvedValue(
      result({ total: 1, data: [row({ activo: false })] }),
    );

    await renderPage({ status: "inactive" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      esMessages.catalog.asignaturas.title,
    );
    expect(
      screen.getByText(esMessages.catalog.shared.status.inactive),
    ).toBeInTheDocument();
  });
});
