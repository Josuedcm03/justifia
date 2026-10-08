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
vi.mock("@/lib/data/users", () => ({ getCatalogActor: getCatalogActorMock }));
vi.mock("@/lib/data/grupos", () => ({ listGrupos: listMock }));

// The real catalogs through next-intl's own translator: a missing key throws.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: state.locale,
      messages: state.locale === "es" ? esMessages : enMessages,
      namespace: namespace as "catalog.grupos.list",
      onError: (error: Error) => {
        throw error;
      },
    }),
}));

const BASE = "/catalog/grupos";

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
    id: 21,
    asignaturaId: 12,
    asignaturaCodigo: "MAT101",
    asignaturaNombre: "Calculus",
    periodo: "2026-S1",
    numeroGrupo: "A",
    docenteId: 5,
    docenteNombre: "Ana Pérez",
    activo: true,
    origen: "manual",
    dias: ["lunes", "jueves"],
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

/** The cell of a body row under the column whose header reads `header`. */
function cellOf(tableRow: HTMLElement, header: string) {
  const heads = within(screen.getByRole("table")).getAllByRole("columnheader");
  const index = heads.findIndex((h) => h.textContent === header);
  expect(index, `column ${header}`).toBeGreaterThanOrEqual(0);
  return within(tableRow).getAllByRole("cell")[index];
}

const en = enMessages.catalog.grupos.list;
const shared = enMessages.catalog.shared;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/grupos/page")).default;
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

describe("GruposPage access (CM-ACC-1: matrix, denial destinations)", () => {
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

describe("GruposPage scope (CM-SCOPE-1: Lists limited; CM-SCOPE-2: Empty state)", () => {
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

describe("GruposPage list params (CM-LST-1: Default, Search, Pagination, Unrecognised status)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("passes status, q and page through with the shared page size and no days parameter", async () => {
    await renderPage({
      status: "inactive",
      q: "  Ana Pérez  ",
      page: "2",
      dias: "lunes",
    });

    // The docente name travels in `q` (the data layer matches it). An exact
    // object: any extra key, such as a days filter, would fail here.
    expect(listMock).toHaveBeenCalledWith({
      scope: { kind: "all" },
      status: "inactive",
      q: "Ana Pérez",
      page: 2,
      pageSize: CATALOG_PAGE_SIZE,
    });
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

  it("renders the page the data layer clamped to, not the one requested", async () => {
    listMock.mockResolvedValue(
      result({ total: 12, page: 2, data: [row()], pageSize: 10 }),
    );

    await renderPage({ page: "99" });

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("offers no days filter or search control, only q and status", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage({ status: "all" });

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(document.querySelector('[name="dias"]')).toBeNull();
    const form = screen.getByRole("search");
    const names = [...form.querySelectorAll("input")].map((i) => i.name);
    expect(names.sort()).toEqual(["q", "status"]);
  });
});

describe("GruposPage rows (CM-LST-1: Filter, state in words; CM-UX-1)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("renders the columns in order, with Days between the teacher and the status", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage();

    const heads = within(screen.getByRole("table")).getAllByRole(
      "columnheader",
    );
    expect(heads.map((h) => h.textContent)).toEqual([
      en.columns.code,
      en.columns.subject,
      en.columns.periodo,
      en.columns.numeroGrupo,
      en.columns.docente,
      en.columns.dias,
      en.columns.status,
      en.columns.actions,
    ]);
  });

  it("shows code, subject name, period, group, teacher and the state word, mixed under status=all", async () => {
    listMock.mockResolvedValue(
      result({
        total: 2,
        data: [
          row(),
          row({
            id: 22,
            asignaturaCodigo: "FIS200",
            asignaturaNombre: "Physics",
            periodo: "2025-S2",
            numeroGrupo: "B2",
            docenteNombre: "Luis Gómez",
            activo: false,
          }),
        ],
      }),
    );

    await renderPage({ status: "all" });

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    for (const text of ["MAT101", "Calculus", "2026-S1", "A", "Ana Pérez"]) {
      expect(within(rows[1]).getByText(text)).toBeInTheDocument();
    }
    expect(within(rows[1]).getByText(shared.status.active)).toBeInTheDocument();
    for (const text of ["FIS200", "Physics", "2025-S2", "B2", "Luis Gómez"]) {
      expect(within(rows[2]).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(rows[2]).getByText(shared.status.inactive),
    ).toBeInTheDocument();
  });

  it("offers one Edit link per row, also for inactive rows, and no other control", async () => {
    listMock.mockResolvedValue(
      result({
        total: 2,
        data: [row(), row({ id: 22, numeroGrupo: "B", activo: false })],
      }),
    );

    await renderPage({ status: "all" });

    const table = screen.getByRole("table");
    expect(within(table).queryAllByRole("button")).toHaveLength(0);
    const links = within(table).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      `${BASE}/21/edit`,
      `${BASE}/22/edit`,
    ]);
    // The name tells two groups of one subject apart.
    expect(links[0]).toHaveAccessibleName(`${en.edit} MAT101 2026-S1 A`);
    expect(links[1]).toHaveAccessibleName(`${en.edit} MAT101 2026-S1 B`);
  });

  it("keeps the order received", async () => {
    listMock.mockResolvedValue(
      result({
        total: 3,
        data: [
          row({ id: 3, numeroGrupo: "C" }),
          row({ id: 1, numeroGrupo: "A" }),
          row({ id: 2, numeroGrupo: "B" }),
        ],
      }),
    );

    await renderPage();

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(
      rows.slice(1).map((r) => cellOf(r, en.columns.numeroGrupo).textContent),
    ).toEqual(["C", "A", "B"]);
  });

  it("gives the table a caption and exposes the count politely", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage();

    expect(screen.getByRole("table")).toHaveAccessibleName(en.tableCaption);
    const count = screen.getByText("1 group");
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

describe("GruposPage days column (CM-GRP-7: shown in the list; CM-I18N-1: Day names)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  async function daysCell(dias: readonly string[], locale: "en" | "es" = "en") {
    state.locale = locale;
    listMock.mockResolvedValue(result({ total: 1, data: [row({ dias })] }));
    await renderPage();
    const body = within(screen.getByRole("table")).getAllByRole("row")[1];
    return cellOf(
      body,
      (locale === "es" ? esMessages : enMessages).catalog.grupos.list.columns
        .dias,
    );
  }

  it("shows the short names in week order for sighted users and the long ones to assistive technology, never both", async () => {
    const cell = await daysCell(["lunes", "jueves"]);

    const visible = within(cell).getByText("Mon, Thu");
    expect(visible).toHaveAttribute("aria-hidden", "true");
    const spoken = within(cell).getByText("Monday, Thursday");
    expect(spoken).toHaveClass("sr-only");
    expect(spoken).not.toHaveAttribute("aria-hidden");
    expect(cell).toHaveAccessibleName("Monday, Thursday");
    expect(cell).not.toHaveTextContent(shared.dias.notSet);
  });

  it("shows all seven days and never a number or a mask", async () => {
    const cell = await daysCell([
      "lunes",
      "martes",
      "miercoles",
      "jueves",
      "viernes",
      "sabado",
      "domingo",
    ]);

    expect(
      within(cell).getByText("Mon, Tue, Wed, Thu, Fri, Sat, Sun"),
    ).toBeInTheDocument();
    expect(cell.textContent).not.toMatch(/\d/);
  });

  it.each([
    ["en", "Sat", "Saturday"],
    ["es", "Sáb", "Sábado"],
  ] as const)(
    "shows a Saturday group in %s as %s / %s",
    async (locale, short, long) => {
      const cell = await daysCell(["sabado"], locale);

      expect(within(cell).getByText(short)).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(within(cell).getByText(long)).toHaveClass("sr-only");
    },
  );

  it.each([
    ["en", enMessages.catalog.shared.dias.notSet],
    ["es", esMessages.catalog.shared.dias.notSet],
  ] as const)(
    "shows the muted %s text, a plain note, for an empty set",
    async (locale, text) => {
      const cell = await daysCell([], locale);

      expect(cell).toHaveTextContent(text);
      const note = within(cell).getByText(text);
      expect(note).toHaveClass("text-muted-foreground");
      for (const attr of ["role", "aria-live", "aria-hidden", "aria-invalid"]) {
        expect(note).not.toHaveAttribute(attr);
      }
      expect(note.className).not.toMatch(/destructive/);
      expect(cell.querySelector(".sr-only")).toBeNull();
    },
  );
});

describe("GruposPage states (CM-LST-1: Empty states, Database unavailable)", () => {
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

describe("GruposPage structure and copy (CM-NFR-3; CM-I18N-1)", () => {
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

  it("renders the title, the Days header and the state word in Spanish", async () => {
    state.locale = "es";
    listMock.mockResolvedValue(
      result({ total: 1, data: [row({ activo: false })] }),
    );

    await renderPage({ status: "inactive" });

    const es = esMessages.catalog.grupos.list;
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      es.title,
    );
    expect(
      screen.getByRole("columnheader", { name: es.columns.dias }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(esMessages.catalog.shared.status.inactive),
    ).toBeInTheDocument();
  });
});
