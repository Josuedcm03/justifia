import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AsignaturasTable,
  type AsignaturaRow,
} from "@/app/(dashboard)/catalog/asignaturas/asignaturas-table";
import {
  parseAsignaturasListParams,
  type AsignaturasSortKey,
  type CatalogListState,
} from "@/lib/catalog/list-params";
import { messages, renderWithIntl, type TestLocale } from "@/test/intl";
import { resetNavigationMock, router } from "@/test/navigation-mock";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation-mock")).module,
);
vi.mock(
  "next/link",
  async () => (await import("@/test/navigation-mock")).linkModule,
);

beforeEach(() => {
  resetNavigationMock();
});

type State = CatalogListState<AsignaturasSortKey>;

const BASE = "/catalog/asignaturas";

function row(overrides: Partial<AsignaturaRow> = {}): AsignaturaRow {
  return {
    id: 12,
    codigo: "MAT101",
    nombre: "Calculus",
    carreraNombre: "Engineering",
    horasTotales: 64,
    activo: true,
    grupos: null,
    gruposCoincidentes: [],
    gruposCoincidentesTotal: 0,
    ...overrides,
  };
}

function match(
  id: number,
  overrides: Partial<AsignaturaRow["gruposCoincidentes"][number]> = {},
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

const ROWS: AsignaturaRow[] = [
  row({ grupos: "1, 2" }),
  row({
    id: 13,
    codigo: "FIS200",
    nombre: "Physics",
    carreraNombre: "Sciences",
    horasTotales: 48,
    activo: false,
  }),
];

const DEFAULT_STATE = parseAsignaturasListParams({});

const stateOf = (overrides: Partial<State> = {}): State => ({
  ...DEFAULT_STATE,
  ...overrides,
});

function renderTable({
  rows = ROWS,
  total = rows.length,
  state = DEFAULT_STATE,
  locale = "en",
}: {
  rows?: readonly AsignaturaRow[];
  total?: number;
  state?: State;
  locale?: TestLocale;
} = {}) {
  return renderWithIntl(
    <AsignaturasTable rows={rows} total={total} state={state} />,
    locale,
  );
}

describe.each(["es", "en"] as const)("AsignaturasTable in %s", (locale) => {
  const copy = messages[locale].catalog.asignaturas;
  const shared = messages[locale].catalog.shared;

  it("names the table and shows each field as text (DT-A11Y-1)", () => {
    renderTable({ locale });

    expect(
      screen.getByRole("table", { name: new RegExp(copy.tableCaption) }),
    ).toBeVisible();
    const [, first, second] = screen.getAllByRole("row");
    for (const text of ["MAT101", "Calculus", "Engineering", "64", "1, 2"]) {
      expect(within(first).getByText(text)).toBeVisible();
    }
    expect(within(first).getByText(shared.status.active)).toBeVisible();
    for (const text of ["FIS200", "Physics", "Sciences", "48"]) {
      expect(within(second).getByText(text)).toBeVisible();
    }
    expect(within(second).getByText(shared.status.inactive)).toBeVisible();
  });

  it("keeps the seven columns in today's order", () => {
    renderTable({ locale });

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      expect.stringContaining(copy.columns.code),
      expect.stringContaining(copy.columns.name),
      copy.columns.career,
      expect.stringContaining(copy.columns.hours),
      copy.columns.groups,
      expect.stringContaining(copy.columns.status),
      copy.columns.actions,
    ]);
  });

  it("makes exactly code, name, hours and status sortable, never career, groups or actions", () => {
    renderTable({ locale });

    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(7);
    const sortable = [0, 1, 3, 5];
    const labels = [
      copy.columns.code,
      copy.columns.name,
      copy.columns.hours,
      copy.columns.status,
    ];
    sortable.forEach((index, position) => {
      expect(
        within(headers[index]).getByRole("button", { name: labels[position] }),
      ).toBeVisible();
    });
    for (const index of [2, 4, 6]) {
      expect(within(headers[index]).queryByRole("button")).toBeNull();
      expect(headers[index]).not.toHaveAttribute("aria-sort");
    }
  });
});

describe("AsignaturasTable sorting (CM-LST-1, DT-SORT-2)", () => {
  it("marks only the sorted column with aria-sort, the default being code ascending", () => {
    renderTable();

    const sorted = screen
      .getAllByRole("columnheader")
      .filter((header) => header.hasAttribute("aria-sort"));
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(sorted[0]).getByRole("button", { name: "Code" }),
    ).toBeVisible();
  });

  it("shows no visible sort state text, only the icon", () => {
    renderTable({ state: stateOf({ sort: { key: "hours", dir: "desc" } }) });

    const header = screen.getByRole("columnheader", { name: /Hours/ });
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(header.textContent).toMatch(/^(Email|Hours)$/);
  });

  it("activating an unsorted header replaces the entry with that column ascending", async () => {
    const user = userEvent.setup();
    renderTable({ state: stateOf({ page: 3 }), total: 60 });

    await user.click(screen.getByRole("button", { name: "Hours" }));

    expect(router.replace).toHaveBeenCalledWith(`${BASE}?sort=hours&dir=asc`, {
      scroll: false,
    });
  });

  it("activating the active header reverses its direction", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Code" }));

    expect(router.replace).toHaveBeenCalledWith(`${BASE}?sort=code&dir=desc`, {
      scroll: false,
    });
  });

  it("keeps the search, the status filter and the page size when sorting", async () => {
    const user = userEvent.setup();
    renderTable({
      state: stateOf({ q: "calc", status: "all", size: 25, page: 2 }),
      total: 60,
    });

    await user.click(screen.getByRole("button", { name: "Name" }));

    expect(router.replace).toHaveBeenCalledWith(
      `${BASE}?q=calc&status=all&sort=name&dir=asc&size=25`,
      { scroll: false },
    );
  });
});

describe("AsignaturasTable cells (CM-LST-1, CM-ASG-9, UG-6)", () => {
  const cell = (rowIndex: number, cellIndex: number) =>
    within(screen.getAllByRole("row")[rowIndex]).getAllByRole("cell")[
      cellIndex
    ];

  it("shows the active group numbers and a hyphen for none or empty", () => {
    renderTable({
      rows: [
        row({ grupos: "1, 2" }),
        row({ id: 13, codigo: "FIS200", grupos: null }),
        row({ id: 14, codigo: "QUI300", grupos: "" }),
      ],
    });

    expect(cell(1, 4)).toHaveTextContent(/^1, 2$/);
    expect(cell(2, 4)).toHaveTextContent(/^-$/);
    expect(cell(3, 4)).toHaveTextContent(/^-$/);
  });

  it("names up to three matching groups under the name, an inactive one in words, and the remainder", () => {
    renderTable({
      rows: [
        row({
          gruposCoincidentes: [
            match(1),
            match(2, { activo: false, periodo: "2025-S2" }),
            match(3, { docenteNombre: "Luis Soto" }),
          ],
          gruposCoincidentesTotal: 4,
        }),
      ],
      state: stateOf({ q: "2026" }),
    });

    expect(cell(1, 1)).toHaveTextContent("Calculus");
    const list = within(cell(1, 1)).getByRole("list", {
      name: messages.en.catalog.asignaturas.matches.label,
    });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "2026-S1 · Group 1 · Ana Pérez",
      "2025-S2 · Group 2 · Ana Pérez (inactive)",
      "2026-S1 · Group 3 · Luis Soto",
      "+1 more",
    ]);
  });

  it("renders no list and no placeholder for a row that matched only by code or name", () => {
    renderTable({ rows: [row()], state: stateOf({ q: "calc" }) });

    expect(within(cell(1, 1)).queryByRole("list")).toBeNull();
    expect(cell(1, 1)).toHaveTextContent(/^Calculus$/);
  });

  it("renders the match lines in Spanish", () => {
    renderTable({
      rows: [
        row({
          gruposCoincidentes: [match(1, { activo: false })],
          gruposCoincidentesTotal: 1,
        }),
      ],
      locale: "es",
    });

    expect(cell(1, 1)).toHaveTextContent(
      "2026-S1 · Grupo 1 · Ana Pérez (inactivo)",
    );
  });

  it("offers one Edit link per row, also for inactive rows, and no other control in the body", () => {
    renderTable();

    const body = screen.getAllByRole("row").slice(1);
    for (const tr of body) {
      expect(within(tr).queryByRole("button")).toBeNull();
      expect(within(tr).getAllByRole("link")).toHaveLength(1);
    }
    const links = body.map((tr) => within(tr).getByRole("link"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      `${BASE}/12/edit`,
      `${BASE}/13/edit`,
    ]);
    expect(links[0]).toHaveAccessibleName("Edit MAT101");
    expect(links[1]).toHaveAccessibleName("Edit FIS200");
  });
});

describe("AsignaturasTable controls (CM-LST-1, DT-URL-2, DT-NAV-1)", () => {
  it("offers the status filter as links that keep the view and reset the page", () => {
    renderTable({
      state: stateOf({
        q: "calc",
        sort: { key: "name", dir: "desc" },
        size: 25,
        page: 2,
      }),
      total: 60,
    });

    const filter = screen.getByRole("group", { name: "Filter by status" });
    expect(
      within(filter).getByRole("link", { name: "Inactive" }),
    ).toHaveAttribute(
      "href",
      `${BASE}?q=calc&status=inactive&sort=name&dir=desc&size=25`,
    );
    expect(
      within(filter).getByRole("link", { name: "Active" }),
    ).toHaveAttribute("aria-current");
  });

  it("shows the footer with first and last when the total exceeds one page", () => {
    renderTable({ total: 60 });

    const footer = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(footer).getByRole("link", { name: "Last" })).toHaveAttribute(
      "href",
      `${BASE}?page=6`,
    );
  });

  it("omits the footer when everything fits on one page", () => {
    renderTable({ total: 2 });

    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
  });
});

describe("AsignaturasTable states (DT-STATE-1, BS-STATE-1)", () => {
  const copy = messages.en.catalog.asignaturas;

  it("shows the empty sentence with the new-asignatura action and no table", () => {
    renderTable({ rows: [], total: 0 });

    expect(screen.getByText(copy.empty)).toBeVisible();
    expect(screen.getByRole("link", { name: copy.newButton })).toHaveAttribute(
      "href",
      `${BASE}/new`,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows no-results naming the term, with a clear link that keeps sort and size", () => {
    renderTable({
      rows: [],
      total: 0,
      state: stateOf({
        q: "zzz",
        status: "inactive",
        sort: { key: "name", dir: "desc" },
        size: 25,
      }),
    });

    expect(screen.getByText("No results for “zzz”")).toBeVisible();
    expect(screen.getByText(copy.noResults.hint)).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      `${BASE}?sort=name&dir=desc&size=25`,
    );
  });

  it("words a filter-only no-results without a search term, with the same hint", () => {
    renderTable({ rows: [], total: 0, state: stateOf({ status: "inactive" }) });

    expect(screen.getByText(copy.noResults.titleStatus)).toBeVisible();
    expect(screen.getByText(copy.noResults.hint)).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      BASE,
    );
  });

  it("says in Spanish that nothing matches the filter", () => {
    renderTable({
      rows: [],
      total: 0,
      state: stateOf({ status: "all" }),
      locale: "es",
    });

    expect(
      screen.getByText(messages.es.catalog.asignaturas.noResults.titleStatus),
    ).toBeVisible();
  });
});

describe("AsignaturasTable displayed fields only (DT-DATA-1)", () => {
  it("renders nothing beyond the delivered fields, even if a row carried more", () => {
    const leaky = [
      {
        ...row(),
        carreraId: 777_001,
        hashClave: "HASH-SECRET-VALUE",
        cif: "CIF-SECRET-VALUE",
      },
    ] as unknown as AsignaturaRow[];

    const { container } = renderTable({ rows: leaky });

    expect(container.textContent).toContain("MAT101");
    for (const secret of ["HASH-SECRET-VALUE", "CIF-SECRET-VALUE", "777001"]) {
      expect(container.innerHTML).not.toContain(secret);
    }
  });
});
