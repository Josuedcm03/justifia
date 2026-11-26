import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DocentesTable,
  type DocenteRow,
} from "@/app/(dashboard)/catalog/docentes/docentes-table";
import {
  parseDocentesListParams,
  type CatalogListState,
  type DocentesSortKey,
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

type State = CatalogListState<DocentesSortKey>;

const BASE = "/catalog/docentes";

function row(overrides: Partial<DocenteRow> = {}): DocenteRow {
  return {
    id: 5,
    nombreCompleto: "Ana Pérez",
    correo: "ana@uni.edu",
    activo: true,
    ...overrides,
  };
}

const ROWS: DocenteRow[] = [
  row(),
  row({
    id: 6,
    nombreCompleto: "Luis Gómez",
    correo: "luis@uni.edu",
    activo: false,
  }),
  row({ id: 7, nombreCompleto: "Eva Ríos", correo: null }),
];

const DEFAULT_STATE = parseDocentesListParams({});

const stateOf = (overrides: Partial<State> = {}): State => ({
  ...DEFAULT_STATE,
  ...overrides,
});

function renderTable({
  rows = ROWS,
  total = rows.length,
  state = DEFAULT_STATE,
  locale = "en",
  canEdit,
}: {
  rows?: readonly DocenteRow[];
  total?: number;
  state?: State;
  locale?: TestLocale;
  canEdit?: boolean;
} = {}) {
  return renderWithIntl(
    <DocentesTable rows={rows} total={total} state={state} canEdit={canEdit} />,
    locale,
  );
}

describe.each(["es", "en"] as const)("DocentesTable in %s", (locale) => {
  const copy = messages[locale].catalog.docentes;
  const shared = messages[locale].catalog.shared;

  it("names the table and shows each field as text (DT-A11Y-1)", () => {
    renderTable({ locale });

    expect(
      screen.getByRole("table", { name: new RegExp(copy.tableCaption) }),
    ).toBeVisible();
    const [, first, second, third] = screen.getAllByRole("row");
    for (const text of ["Ana Pérez", "ana@uni.edu"]) {
      expect(within(first).getByText(text)).toBeVisible();
    }
    expect(within(first).getByText(shared.status.active)).toBeVisible();
    for (const text of ["Luis Gómez", "luis@uni.edu"]) {
      expect(within(second).getByText(text)).toBeVisible();
    }
    expect(within(second).getByText(shared.status.inactive)).toBeVisible();
    // A docente without a Correo reads as words, not as an empty cell.
    expect(within(third).getByText(copy.noEmail)).toBeVisible();
  });

  it("has three columns, name, email and status, all sortable, and no login column (FE-24)", () => {
    renderTable({ locale });

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      expect.stringContaining(copy.columns.name),
      expect.stringContaining(copy.columns.email),
      expect.stringContaining(copy.columns.status),
    ]);
    // The catalog also holds the secretaria's "actions" header; it is drawn
    // only with `canEdit` (see the actions column describe below).
    expect(Object.keys(copy.columns)).toEqual([
      "name",
      "email",
      "status",
      "actions",
    ]);
    expect(screen.queryByText("aperez")).not.toBeInTheDocument();
    const labels = [copy.columns.name, copy.columns.email, copy.columns.status];
    headers.forEach((header, index) => {
      expect(
        within(header).getByRole("button", { name: labels[index] }),
      ).toBeVisible();
    });
  });
});

describe("DocentesTable sorting (CM-LST-1, DT-SORT-2)", () => {
  it("marks only the sorted column with aria-sort, the default being name ascending", () => {
    renderTable();

    const sorted = screen
      .getAllByRole("columnheader")
      .filter((header) => header.hasAttribute("aria-sort"));
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(sorted[0]).getByRole("button", { name: "Name" }),
    ).toBeVisible();
  });

  it("shows no visible sort state text, only the icon", () => {
    renderTable({ state: stateOf({ sort: { key: "email", dir: "desc" } }) });

    const header = screen.getByRole("columnheader", { name: /Email/ });
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(header.textContent).toMatch(/^(Email|Hours)$/);
  });

  it("activating an unsorted header replaces the entry with that column ascending", async () => {
    const user = userEvent.setup();
    renderTable({ state: stateOf({ page: 3 }), total: 60 });

    await user.click(screen.getByRole("button", { name: "Email" }));

    expect(router.replace).toHaveBeenCalledWith(`${BASE}?sort=email&dir=asc`, {
      scroll: false,
    });
  });

  it("activating the active header reverses its direction", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Name" }));

    expect(router.replace).toHaveBeenCalledWith(`${BASE}?sort=name&dir=desc`, {
      scroll: false,
    });
  });

  it("keeps the search, the status filter and the page size when sorting", async () => {
    const user = userEvent.setup();
    renderTable({
      state: stateOf({ q: "ana", status: "all", size: 25, page: 2 }),
      total: 60,
    });

    await user.click(screen.getByRole("button", { name: "Status" }));

    expect(router.replace).toHaveBeenCalledWith(
      `${BASE}?q=ana&status=all&sort=status&dir=asc&size=25`,
      { scroll: false },
    );
  });
});

describe("DocentesTable is read-only (CM-LST-1, CM-ACC-1)", () => {
  it("has no control and no link in the body rows", () => {
    renderTable();

    for (const tr of screen.getAllByRole("row").slice(1)) {
      expect(within(tr).queryAllByRole("button")).toHaveLength(0);
      expect(within(tr).queryAllByRole("link")).toHaveLength(0);
    }
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("offers no create action in the empty state", () => {
    renderTable({ rows: [], total: 0 });

    expect(screen.getByText(messages.en.catalog.docentes.empty)).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe.each(["es", "en"] as const)(
  "DocentesTable actions column for the secretaria in %s (CM-LST-1, DM-15, DM-17)",
  (locale) => {
    const copy = messages[locale].catalog.docentes;
    const shared = messages[locale].catalog.shared;

    it("defaults canEdit to false: exactly the three data columns and no link in the body", () => {
      renderTable({ locale });

      expect(
        screen.getAllByRole("columnheader").map((header) => header.textContent),
      ).toEqual([
        expect.stringContaining(copy.columns.name),
        expect.stringContaining(copy.columns.email),
        expect.stringContaining(copy.columns.status),
      ]);
      expect(screen.queryByText(copy.columns.actions)).not.toBeInTheDocument();
      expect(screen.queryByText(copy.edit)).not.toBeInTheDocument();
      for (const tr of screen.getAllByRole("row").slice(1)) {
        expect(within(tr).queryAllByRole("link")).toHaveLength(0);
      }
    });

    it("an explicit false draws the same three columns", () => {
      renderTable({ locale, canEdit: false });

      expect(screen.getAllByRole("columnheader")).toHaveLength(3);
      for (const tr of screen.getAllByRole("row").slice(1)) {
        expect(within(tr).queryAllByRole("link")).toHaveLength(0);
      }
    });

    it("canEdit adds a fourth, last, non-sortable actions column", () => {
      renderTable({ locale, canEdit: true });

      const headers = screen.getAllByRole("columnheader");
      expect(headers).toHaveLength(4);
      expect(headers[3]).toHaveTextContent(copy.columns.actions);
      expect(within(headers[3]).queryByRole("button")).toBeNull();
      expect(headers[3]).not.toHaveAttribute("aria-sort");
      // The three data columns keep sorting.
      for (const index of [0, 1, 2]) {
        expect(within(headers[index]).getByRole("button")).toBeVisible();
      }
    });

    it("holds one Edit link per row, active or inactive, named after the docente", () => {
      renderTable({ locale, canEdit: true });

      const body = screen.getAllByRole("row").slice(1);
      expect(body).toHaveLength(3);
      for (const tr of body) {
        expect(within(tr).queryByRole("button")).toBeNull();
        expect(within(tr).getAllByRole("link")).toHaveLength(1);
      }
      const links = body.map((tr) => within(tr).getByRole("link"));
      expect(links.map((a) => a.getAttribute("href"))).toEqual([
        `${BASE}/5/edit`,
        `${BASE}/6/edit`,
        `${BASE}/7/edit`,
      ]);
      expect(links[0]).toHaveAccessibleName(`${copy.edit} Ana Pérez`);
      // The inactive row is editable too (the page shows it read-only).
      expect(links[1]).toHaveAccessibleName(`${copy.edit} Luis Gómez`);
      expect(links[2]).toHaveAccessibleName(`${copy.edit} Eva Ríos`);
    });

    it("keeps the state as a word in every row and offers no create control", () => {
      renderTable({ locale, canEdit: true });

      const [, first, second] = screen.getAllByRole("row");
      expect(within(first).getByText(shared.status.active)).toBeVisible();
      expect(within(second).getByText(shared.status.inactive)).toBeVisible();
      const hrefs = screen
        .getAllByRole("link")
        .map((a) => a.getAttribute("href") ?? "");
      expect(hrefs.filter((href) => /\/new|create/i.test(href))).toEqual([]);
    });

    it("offers no create action in the empty state either", () => {
      renderTable({ locale, canEdit: true, rows: [], total: 0 });

      expect(screen.getByText(copy.empty)).toBeVisible();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  },
);

describe("DocentesTable controls (CM-LST-1, DT-URL-2, DT-NAV-1)", () => {
  it("offers the status filter as links that keep the view and reset the page", () => {
    renderTable({
      state: stateOf({
        q: "ana",
        sort: { key: "email", dir: "desc" },
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
      `${BASE}?q=ana&status=inactive&sort=email&dir=desc&size=25`,
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
    renderTable({ total: 3 });

    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
  });
});

describe("DocentesTable states (DT-STATE-1, BS-STATE-1)", () => {
  const copy = messages.en.catalog.docentes;

  it("shows no-results naming the term, with a clear link that keeps sort and size", () => {
    renderTable({
      rows: [],
      total: 0,
      state: stateOf({
        q: "zzz",
        status: "inactive",
        sort: { key: "email", dir: "desc" },
        size: 25,
      }),
    });

    expect(screen.getByText("No results for “zzz”")).toBeVisible();
    expect(screen.getByText(copy.noResults.hint)).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      `${BASE}?sort=email&dir=desc&size=25`,
    );
  });

  it("words a filter-only no-results without a search term", () => {
    renderTable({ rows: [], total: 0, state: stateOf({ status: "inactive" }) });

    expect(screen.getByText(copy.noResults.titleStatus)).toBeVisible();
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
      screen.getByText(messages.es.catalog.docentes.noResults.titleStatus),
    ).toBeVisible();
  });
});

describe("DocentesTable displayed fields only (DT-DATA-1)", () => {
  it("renders nothing beyond the delivered fields, even if a row carried more", () => {
    const leaky = [
      {
        ...row(),
        hashClave: "HASH-SECRET-VALUE",
        cif: "CIF-SECRET-VALUE",
        password: "PASSWORD-SECRET-VALUE",
        temporaryPassword: "TEMP-SECRET-VALUE",
      },
    ] as unknown as DocenteRow[];

    const { container } = renderTable({ rows: leaky });

    expect(container.textContent).toContain("ana@uni.edu");
    for (const secret of [
      "HASH-SECRET-VALUE",
      "CIF-SECRET-VALUE",
      "PASSWORD-SECRET-VALUE",
      "TEMP-SECRET-VALUE",
    ]) {
      expect(container.innerHTML).not.toContain(secret);
    }
  });
});
