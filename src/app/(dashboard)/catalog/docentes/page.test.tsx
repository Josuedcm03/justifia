import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { CATALOG_PAGE_SIZE, catalogListHref } from "@/lib/catalog/list-params";
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

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// The REAL dal and the REAL requireCatalogAccess run on a mocked session
// source and a mocked actor read, so the guard order is the production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/users", () => ({
  getCatalogActor: getCatalogActorMock,
  listDocentes: listMock,
}));

// The real catalogs through next-intl's own translator: a missing key throws.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: state.locale,
      messages: state.locale === "es" ? esMessages : enMessages,
      namespace: namespace as "catalog.docentes",
      onError: (error: Error) => {
        throw error;
      },
    }),
}));

const BASE = "/catalog/docentes";

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
    id: 5,
    nombreCompleto: "Ana Pérez",
    login: "aperez",
    correo: "ana@uni.edu",
    activo: true,
    ...overrides,
  };
}

function result(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: [],
    total: 0,
    page: 1,
    pageSize: CATALOG_PAGE_SIZE,
    degraded: false,
    ...overrides,
  };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
let Page: (props: PageProps) => Promise<React.ReactNode>;

function buildPage(params: Record<string, string | string[] | undefined> = {}) {
  return Page({ searchParams: Promise.resolve(params) });
}

function renderUi(ui: React.ReactNode) {
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

async function renderPage(
  params: Record<string, string | string[] | undefined> = {},
) {
  return renderUi(await buildPage(params));
}

/** Everything a node hands to its children as props, as JSON text. */
function serializedProps(node: unknown, seen = new Set<unknown>()): string {
  if (typeof node === "function" || node === undefined) return "";
  if (node === null || typeof node !== "object") return JSON.stringify(node);
  if (seen.has(node)) return "";
  seen.add(node);
  if (Array.isArray(node)) {
    return node.map((child) => serializedProps(child, seen)).join(" ");
  }
  const record = node as Record<string, unknown>;
  const source = "$$typeof" in record ? record.props : record;
  return Object.entries((source ?? {}) as Record<string, unknown>)
    .map(([key, value]) => `${key}:${serializedProps(value, seen)}`)
    .join(" ");
}

/** The cell of a body row under the column whose header reads `header`. */
function cellOf(tableRow: HTMLElement, header: string) {
  const heads = within(screen.getByRole("table")).getAllByRole("columnheader");
  const index = heads.findIndex((h) => h.textContent === header);
  expect(index, `column ${header}`).toBeGreaterThanOrEqual(0);
  return within(tableRow).getAllByRole("cell")[index];
}

const en = enMessages.catalog.docentes;
const shared = enMessages.catalog.shared;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/docentes/page")).default;
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

describe("DocentesPage access (CM-ACC-1: Docentes list column, denial destinations)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "renders the list and the link to /users for %s",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({
        carreraId: rol === "coordinacion" ? 3 : null,
      });

      await renderPage();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        en.title,
      );
      expect(screen.getByRole("link", { name: en.usersLink })).toHaveAttribute(
        "href",
        "/users",
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

describe("DocentesPage is not Carrera-scoped (CM-LST-1: Docentes list is read-only and unscoped)", () => {
  it.each([
    ["with a Carrera", 3],
    ["without a Carrera", null],
  ] as const)(
    "lists docentes for a coordinacion actor %s, with no scope in the query",
    async (_label, carreraId) => {
      getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
      getCatalogActorMock.mockResolvedValue({ carreraId });
      listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

      await renderPage({ carreraId: "9", scope: "carrera" });

      expect(listMock).toHaveBeenCalledWith({
        status: "active",
        q: "",
        page: 1,
        pageSize: CATALOG_PAGE_SIZE,
      });
      expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
      expect(screen.queryByText(shared.noCarrera.title)).toBeNull();
      expect(screen.queryByText(shared.noCarrera.message)).toBeNull();
    },
  );
});

describe("DocentesPage list params (CM-LST-1: Default, Search, Pagination, Unrecognised status)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("passes status, q and page through with the shared page size", async () => {
    await renderPage({ status: "inactive", q: "  Ana  ", page: "2" });

    expect(listMock).toHaveBeenCalledWith({
      status: "inactive",
      q: "Ana",
      page: 2,
      pageSize: CATALOG_PAGE_SIZE,
    });
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

  it("renders the page the data layer clamped to, not the one requested", async () => {
    listMock.mockResolvedValue(
      result({ total: 12, page: 2, data: [row()], pageSize: 10 }),
    );

    await renderPage({ page: "99" });

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
});

describe("DocentesPage rows (CM-LST-1: Filter, state in words; CM-UX-1)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("renders Name, Username, Email and Status, and no actions column", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage();

    const heads = within(screen.getByRole("table")).getAllByRole(
      "columnheader",
    );
    expect(heads.map((h) => h.textContent)).toEqual([
      en.columns.name,
      en.columns.login,
      en.columns.email,
      en.columns.status,
    ]);
  });

  it("shows name, username, email and the state word, mixed under status=all", async () => {
    listMock.mockResolvedValue(
      result({
        total: 3,
        data: [
          row(),
          row({
            id: 6,
            nombreCompleto: "Luis Gómez",
            login: "lgomez",
            correo: "luis@uni.edu",
            activo: false,
          }),
          row({ id: 7, nombreCompleto: "Eva Ríos", correo: null }),
        ],
      }),
    );

    await renderPage({ status: "all" });

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    for (const text of ["Ana Pérez", "aperez", "ana@uni.edu"]) {
      expect(within(rows[1]).getByText(text)).toBeInTheDocument();
    }
    expect(within(rows[1]).getByText(shared.status.active)).toBeInTheDocument();
    for (const text of ["Luis Gómez", "lgomez", "luis@uni.edu"]) {
      expect(within(rows[2]).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(rows[2]).getByText(shared.status.inactive),
    ).toBeInTheDocument();
    // A docente without a Correo reads as text, not as an empty cell.
    expect(cellOf(rows[3], en.columns.email)).toHaveTextContent(en.noEmail);
  });

  it("keeps the order received", async () => {
    listMock.mockResolvedValue(
      result({
        total: 2,
        data: [
          row({ id: 2, nombreCompleto: "Zoe" }),
          row({ id: 1, nombreCompleto: "Ada" }),
        ],
      }),
    );

    await renderPage();

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(
      rows.slice(1).map((r) => cellOf(r, en.columns.name).textContent),
    ).toEqual(["Zoe", "Ada"]);
  });

  it("gives the table a caption and exposes the count politely", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage();

    expect(screen.getByRole("table")).toHaveAccessibleName(en.tableCaption);
    const count = screen.getByText("1 teacher");
    expect(count).toHaveAttribute("role", "status");
    expect(count).toHaveAttribute("aria-live", "polite");
  });

  it("builds pagination links that keep q and status", async () => {
    listMock.mockResolvedValue(
      result({ total: 25, page: 2, data: [row()], pageSize: 10 }),
    );

    await renderPage({ status: "all", q: "ana", page: "2" });

    const nav = screen.getByRole("navigation", { name: en.pagination.region });
    expect(
      within(nav).getByRole("link", { name: en.pagination.previous }),
    ).toHaveAttribute(
      "href",
      catalogListHref(BASE, { q: "ana", status: "all" }),
    );
    expect(
      within(nav).getByRole("link", { name: en.pagination.next }),
    ).toHaveAttribute(
      "href",
      catalogListHref(BASE, { q: "ana", status: "all", page: 3 }),
    );
  });
});

describe("DocentesPage is read-only (CM-LST-1: read-only; CM-ACC-1)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("offers only search, the status filter, pagination and the link to /users", async () => {
    listMock.mockResolvedValue(
      result({
        total: 25,
        data: [row(), row({ id: 6, activo: false })],
        pageSize: 10,
      }),
    );

    await renderPage({ status: "all" });

    const table = screen.getByRole("table");
    expect(within(table).queryAllByRole("link")).toHaveLength(0);
    expect(within(table).queryAllByRole("button")).toHaveLength(0);
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href") ?? "");
    for (const href of hrefs) {
      expect(href === "/users" || href.startsWith(BASE), href).toBe(true);
    }
    expect(
      hrefs.filter((h) =>
        /new|edit|create|deactivate|reactivate|toggle/i.test(h),
      ),
    ).toEqual([]);
    expect(hrefs.filter((h) => h === "/users")).toHaveLength(1);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      en.search.submit,
    ]);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(document.querySelector("form")?.getAttribute("method")).not.toBe(
      "post",
    );
  });

  it("renders and passes on no credential field, even if the data layer returned them", async () => {
    listMock.mockResolvedValue(
      result({
        total: 1,
        data: [
          row({
            hashClave: "$2b$12$LEAKEDHASH",
            cif: "CIF-0001",
            telefono: "555-0100",
            password: "hunter2",
            temporaryPassword: "Temp-1234",
          }),
        ],
      }),
    );

    const ui = await buildPage({ status: "all" });
    const { container } = renderUi(ui);

    const haystacks = [container.innerHTML, serializedProps(ui)];
    for (const text of haystacks) {
      expect(text.length).toBeGreaterThan(0);
      for (const leak of [
        "HashClave",
        "hashClave",
        "LEAKEDHASH",
        "Cif",
        "CIF-0001",
        "555-0100",
        "hunter2",
        "Temp-1234",
      ]) {
        expect(text).not.toContain(leak);
      }
      expect(text).not.toMatch(/password/i);
    }
    expect(serializedProps(ui)).toContain("aperez");
  });
});

describe("DocentesPage states (CM-LST-1: Empty states, Database unavailable)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("shows one sentence, no table and no create control when there is nothing at all", async () => {
    await renderPage();

    expect(screen.getByText(en.empty)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.getAllByRole("link").map((a) => a.getAttribute("href")),
    ).not.toContain(`${BASE}/new`);
  });

  it("shows no results and a clear control that keeps the status when a search matches nothing", async () => {
    await renderPage({ q: "zz", status: "inactive" });

    expect(screen.getByText(`No results for “zz”`)).toBeInTheDocument();
    expect(screen.getByText(en.noResults.hint)).toBeInTheDocument();
    expect(screen.queryByText(en.empty)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.search.clear })).toHaveAttribute(
      "href",
      `${BASE}?status=inactive`,
    );
  });

  it("shows no results, not the empty sentence, for a status filter that matches nothing", async () => {
    await renderPage({ status: "inactive" });

    expect(screen.getByText(en.noResults.titleStatus)).toBeInTheDocument();
    expect(screen.queryByText(en.empty)).not.toBeInTheDocument();
  });

  it("renders the status filter as a labelled nav", async () => {
    await renderPage({ status: "inactive", q: "ana" });

    const nav = screen.getByRole("navigation", { name: shared.filter.label });
    expect(
      within(nav).getByRole("link", { name: shared.filter.all }),
    ).toHaveAttribute(
      "href",
      catalogListHref(BASE, { q: "ana", status: "all" }),
    );
  });

  it("renders a status notice and no table, count or raw error when degraded", async () => {
    listMock.mockResolvedValue(result({ degraded: true }));

    const { container } = await renderPage({ q: "zz", page: "3" });

    expect(screen.getByRole("status")).toHaveTextContent(en.degraded);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(en.empty)).not.toBeInTheDocument();
    expect(screen.queryByText(en.noResults.hint)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/error|exception|ECONN/i);
  });
});

describe("DocentesPage structure and copy (CM-NFR-3; CM-I18N-1)", () => {
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

  it("renders the title, the link, a header and the state word in Spanish", async () => {
    state.locale = "es";
    listMock.mockResolvedValue(
      result({ total: 1, data: [row({ activo: false })] }),
    );

    await renderPage({ status: "inactive" });

    const es = esMessages.catalog.docentes;
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      es.title,
    );
    expect(screen.getByRole("link", { name: es.usersLink })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(
      screen.getByRole("columnheader", { name: es.columns.email }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(esMessages.catalog.shared.status.inactive),
    ).toBeInTheDocument();
  });
});
