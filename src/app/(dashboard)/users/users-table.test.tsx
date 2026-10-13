import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UsersTable, type UserRow } from "@/app/(dashboard)/users/users-table";
import {
  parseUsersListParams,
  type UsersListState,
} from "@/lib/users/list-params";
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

const ROWS: UserRow[] = [
  {
    id: 7,
    nombreCompleto: "Ana Lopez",
    login: "alopez",
    rol: "docente",
    activo: true,
    creadoEnLabel: "1 ene 2026",
  },
  {
    id: 8,
    nombreCompleto: "Beatriz Gil",
    login: "bgil",
    rol: "secretaria",
    activo: false,
    creadoEnLabel: "2 ene 2026",
  },
];

const DEFAULT_STATE = parseUsersListParams({});

const stateOf = (overrides: Partial<UsersListState> = {}): UsersListState => ({
  ...DEFAULT_STATE,
  ...overrides,
});

function renderTable({
  rows = ROWS,
  total = rows.length,
  state = DEFAULT_STATE,
  locale = "en",
}: {
  rows?: readonly UserRow[];
  total?: number;
  state?: UsersListState;
  locale?: TestLocale;
} = {}) {
  return renderWithIntl(
    <UsersTable rows={rows} total={total} state={state} />,
    locale,
  );
}

describe.each(["es", "en"] as const)("UsersTable in %s", (locale) => {
  const users = messages[locale].users;

  it("names the table and shows each field as text (DT-A11Y-1)", () => {
    renderTable({ locale });

    expect(
      screen.getByRole("table", { name: new RegExp(users.tableCaption) }),
    ).toBeVisible();
    const [, first, second] = screen.getAllByRole("row");
    expect(within(first).getByText("Ana Lopez")).toBeVisible();
    expect(within(first).getByText("alopez")).toBeVisible();
    expect(within(first).getByText("docente")).toBeVisible();
    expect(within(first).getByText(users.status.active)).toBeVisible();
    expect(within(first).getByText("1 ene 2026")).toBeVisible();
    expect(within(second).getByText("secretaria")).toBeVisible();
    expect(within(second).getByText(users.status.inactive)).toBeVisible();
  });

  it("makes exactly name, login, role, status and created sortable", () => {
    renderTable({ locale });

    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(5);
    const labels = [
      users.columns.name,
      users.columns.login,
      users.columns.role,
      users.columns.status,
      users.columns.createdAt,
    ];
    headers.forEach((header, index) => {
      expect(
        within(header).getByRole("button", { name: labels[index] }),
      ).toBeVisible();
    });
  });
});

describe("UsersTable sorting (UL:sort, DT-SORT-2)", () => {
  it("marks only the sorted column with aria-sort, the default being created descending", () => {
    renderTable();

    const sorted = screen
      .getAllByRole("columnheader")
      .filter((header) => header.hasAttribute("aria-sort"));
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveAttribute("aria-sort", "descending");
    expect(
      within(sorted[0]).getByRole("button", { name: "Created" }),
    ).toBeVisible();
  });

  it("follows the URL state", () => {
    renderTable({ state: stateOf({ sort: { key: "name", dir: "asc" } }) });

    const sorted = screen
      .getAllByRole("columnheader")
      .filter((header) => header.hasAttribute("aria-sort"));
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(sorted[0]).getByRole("button", { name: "Name" }),
    ).toBeVisible();
  });

  it("activating an unsorted header replaces the entry with that column ascending", async () => {
    const user = userEvent.setup();
    renderTable({ state: stateOf({ page: 3 }), total: 60 });

    await user.click(screen.getByRole("button", { name: "Username" }));

    expect(router.replace).toHaveBeenCalledWith("/users?sort=login&dir=asc", {
      scroll: false,
    });
  });

  it("activating the active header reverses its direction", async () => {
    const user = userEvent.setup();
    renderTable({ state: stateOf({ sort: { key: "name", dir: "asc" } }) });

    await user.click(screen.getByRole("button", { name: "Name" }));

    expect(router.replace).toHaveBeenCalledWith("/users?sort=name&dir=desc", {
      scroll: false,
    });
  });
});

describe("UsersTable controls (UL:status, UL:reset, DT-NAV-1)", () => {
  it("offers the status filter as links that keep the view and reset the page", () => {
    renderTable({
      state: stateOf({
        q: "ana",
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
      "/users?q=ana&status=inactive&sort=name&dir=desc&size=25",
    );
    expect(within(filter).getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
    );
  });

  it("shows the footer with first and last when the total exceeds one page", () => {
    renderTable({ total: 60 });

    const footer = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(footer).getByRole("link", { name: "Last" })).toHaveAttribute(
      "href",
      "/users?page=6",
    );
  });

  it("omits the footer when everything fits on one page", () => {
    renderTable({ total: 2 });

    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
  });
});

describe("UsersTable states (DT-STATE-1, BS-STATE-1)", () => {
  it("shows the empty state with the new-user action and no table", () => {
    renderTable({ rows: [], total: 0 });

    expect(screen.getByText("No users yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "New user" })).toHaveAttribute(
      "href",
      "/users/new",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows no-results naming the term, with a clear link that keeps the sort", () => {
    renderTable({
      rows: [],
      total: 0,
      state: stateOf({ q: "zzz", sort: { key: "name", dir: "desc" } }),
    });

    expect(screen.getByText("No results for “zzz”")).toBeVisible();
    expect(
      screen.getByText("Try another name, username or email."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/users?sort=name&dir=desc",
    );
  });

  it("words a filter-only no-results without a search term", () => {
    renderTable({ rows: [], total: 0, state: stateOf({ status: "inactive" }) });

    expect(
      screen.getByText("There are no users with this filter."),
    ).toBeVisible();
    expect(
      screen.getByText("Try another status or clear the filters."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/users",
    );
  });

  it("says in Spanish that nothing matches the filter", () => {
    renderTable({
      rows: [],
      total: 0,
      state: stateOf({ status: "active" }),
      locale: "es",
    });

    expect(screen.getByText("No hay usuarios con este filtro.")).toBeVisible();
  });
});

describe("UsersTable displayed fields only (DT-DATA-1, UL:fields)", () => {
  it("renders nothing beyond the six delivered fields, even if a row carried more", () => {
    const leaky = [
      {
        ...ROWS[0],
        hashClave: "HASH-SECRET-VALUE",
        cif: "CIF-SECRET-VALUE",
        telefono: "TEL-SECRET-VALUE",
        correo: "mail-secret@example.org",
      },
    ] as unknown as UserRow[];

    const { container } = renderTable({ rows: leaky });

    expect(container.textContent).toContain("alopez");
    for (const secret of [
      "HASH-SECRET-VALUE",
      "CIF-SECRET-VALUE",
      "TEL-SECRET-VALUE",
      "mail-secret@example.org",
    ]) {
      expect(container.innerHTML).not.toContain(secret);
    }
  });
});
