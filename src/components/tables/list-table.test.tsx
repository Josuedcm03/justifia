import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { Suspense, use, useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListNavigationProvider } from "@/components/tables/list-navigation";
import { ListTable } from "@/components/tables/list-table";
import {
  parseUsersListParams,
  usersListHref,
  type UsersListState,
} from "@/lib/users/list-params";
import { messages, renderWithIntl } from "@/test/intl";
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

type Person = { id: number; name: string; login: string };

const ROWS: Person[] = [
  { id: 3, name: "Zoe", login: "zoe" },
  { id: 1, name: "Ana", login: "ana" },
  { id: 2, name: "Beatriz", login: "bea" },
];

const COLUMNS: ColumnDef<Person>[] = [
  {
    id: "name",
    header: "Name",
    enableSorting: true,
    cell: ({ row }) => row.original.name,
  },
  {
    id: "login",
    header: "Login",
    enableSorting: true,
    cell: ({ row }) => row.original.login,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <a href={`/people/${row.original.id}`}>Edit</a>,
  },
];

const DEFAULT_STATE = parseUsersListParams({});

const stateOf = (overrides: Partial<UsersListState> = {}): UsersListState => ({
  ...DEFAULT_STATE,
  ...overrides,
});

type RenderOptions = {
  state?: UsersListState;
  total?: number;
  rows?: Person[];
  wrap?: (ui: ReactNode) => ReactNode;
  locale?: "es" | "en";
};

function renderList({
  state = DEFAULT_STATE,
  total = 25,
  rows = ROWS,
  wrap = (ui) => ui,
  locale = "en",
}: RenderOptions = {}) {
  return renderWithIntl(
    <ListNavigationProvider>
      {wrap(
        <ListTable<Person, UsersListState["sort"]["key"]>
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => `u-${row.id}`}
          caption="People list"
          state={state}
          defaultState={DEFAULT_STATE}
          total={total}
          hrefFor={usersListHref}
          search={{ label: "Search users", placeholder: "Name or login" }}
          empty={{
            message: "No users yet",
            action: { href: "/users/new", label: "New user" },
          }}
          noResults={{
            title: state.q ? `No results for “${state.q}”` : "Nothing matches",
            hint: "Try another name or login.",
          }}
        />,
      )}
    </ListNavigationProvider>,
    locale,
  );
}

const tables = messages.en.tables;

describe("ListTable with rows (DT-STATE-1, BS-FRM-1)", () => {
  it("draws toolbar, table and footer in that order inside one card", () => {
    renderList({ total: 25 });

    const toolbar = screen.getByRole("group", { name: tables.toolbar.label });
    const table = screen.getByRole("table", { name: /People list/ });
    const footer = screen.getByRole("navigation", {
      name: tables.pagination.region,
    });
    const before = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(before(toolbar, table)).toBe(true);
    expect(before(table, footer)).toBe(true);
    expect(toolbar.closest('[data-slot="table-card"]')).toBe(
      footer.closest('[data-slot="table-card"]'),
    );
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("shows the result count of the view in the toolbar", () => {
    renderList({ total: 25 });

    expect(screen.getAllByText("25 results").length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("25 results");
  });

  it.each([
    [0, false],
    [1, false],
    [10, false],
    [11, true],
    [25, true],
  ])("total %i shows the footer: %s", (total, shown) => {
    // Zero rows are the empty state, which has no footer either.
    renderList({ total, rows: total === 0 ? [] : ROWS });

    const footer = screen.queryByRole("navigation", {
      name: tables.pagination.region,
    });

    expect(footer !== null).toBe(shown);
  });

  it("writes its own page and size links from the caller's builder", () => {
    renderList({
      state: stateOf({
        q: "ana",
        status: "inactive",
        sort: { key: "name", dir: "desc" },
        size: 25,
        page: 2,
      }),
      total: 80,
    });
    const link = (name: string) =>
      screen.getByRole("link", { name }).getAttribute("href");

    // Only `page` changes; q, status, sort, dir and size are kept.
    expect(link(tables.pagination.first)).toBe(
      "/users?q=ana&status=inactive&sort=name&dir=desc&size=25",
    );
    expect(link(tables.pagination.next)).toBe(
      "/users?q=ana&status=inactive&sort=name&dir=desc&size=25&page=3",
    );
    expect(link(tables.pagination.last)).toBe(
      "/users?q=ana&status=inactive&sort=name&dir=desc&size=25&page=4",
    );
  });

  it("offers the status filter links with the page reset", () => {
    renderList({
      state: stateOf({ q: "ana", page: 3, size: 25 }),
      total: 80,
    });

    expect(screen.getByRole("link", { name: "Inactive" })).toHaveAttribute(
      "href",
      "/users?q=ana&status=inactive&size=25",
    );
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("hands the search form the path and every other parameter", () => {
    renderList({
      state: stateOf({
        q: "ana",
        status: "inactive",
        sort: { key: "login", dir: "asc" },
        size: 50,
        page: 2,
      }),
      total: 80,
    });
    const form = screen.getByRole("search");

    expect(form).toHaveAttribute("action", "/users");
    expect(
      [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map(
        (field) => [field.name, field.value],
      ),
    ).toEqual([
      ["status", "inactive"],
      ["sort", "login"],
      ["dir", "asc"],
      ["size", "50"],
    ]);
    expect(screen.getByRole("searchbox")).toHaveValue("ana");
  });
});

describe("ListTable navigation (DT-NAV-1, DT-URL-2)", () => {
  it("sorts a new column ascending with replace, back on page 1", async () => {
    renderList({ state: stateOf({ page: 3, q: "ana", size: 25 }), total: 80 });

    await userEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana&sort=name&dir=asc&size=25",
      { scroll: false },
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("reverses the direction of the sorted column", async () => {
    renderList({ state: stateOf({ sort: { key: "name", dir: "asc" } }) });

    await userEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      "/users?sort=name&dir=desc",
      { scroll: false },
    );
  });

  it("pushes the next page with every other parameter kept", async () => {
    renderList({
      state: stateOf({ q: "ana", sort: { key: "login", dir: "desc" } }),
      total: 25,
    });

    await userEvent.click(
      screen.getByRole("link", { name: tables.pagination.next }),
    );

    expect(router.push).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana&sort=login&dir=desc&page=2",
      { scroll: false },
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("pushes a status change back to page 1", async () => {
    renderList({ state: stateOf({ page: 2, q: "ana" }), total: 25 });

    await userEvent.click(screen.getByRole("link", { name: "Active" }));

    expect(router.push).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana&status=active",
      { scroll: false },
    );
  });

  it("pushes a search without page and keeps the other parameters", async () => {
    renderList({
      state: stateOf({
        page: 3,
        status: "inactive",
        sort: { key: "name", dir: "asc" },
        size: 25,
      }),
      total: 80,
    });

    await userEvent.type(screen.getByRole("searchbox"), "luis{Enter}");

    expect(router.push).toHaveBeenCalledExactlyOnceWith(
      "/users?q=luis&status=inactive&sort=name&dir=asc&size=25",
      { scroll: false },
    );
  });

  it("replaces with the chosen page size and page 1", async () => {
    renderList({ state: stateOf({ page: 3, q: "ana" }), total: 80 });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: tables.pageSize.label }),
      "25",
    );

    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana&size=25",
      { scroll: false },
    );
  });
});

describe("ListTable empty and no-results (DT-STATE-1)", () => {
  it("shows the empty state with the create action and no table", () => {
    renderList({ rows: [], total: 0 });

    expect(screen.getByText("No users yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "New user" })).toHaveAttribute(
      "href",
      "/users/new",
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByRole("link", { name: tables.clear })).toBeNull();
  });

  it("shows no-results for a term, with a clear link to the default list", () => {
    renderList({ rows: [], total: 0, state: stateOf({ q: "zzz" }) });

    expect(screen.getByText("No results for “zzz”")).toBeVisible();
    expect(screen.getByText("Try another name or login.")).toBeVisible();
    expect(screen.getByRole("link", { name: tables.clear })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("No users yet")).toBeNull();
  });

  it("shows no-results for a non-default filter alone", () => {
    renderList({ rows: [], total: 0, state: stateOf({ status: "inactive" }) });

    expect(screen.getByText("Nothing matches")).toBeVisible();
    expect(screen.getByRole("link", { name: tables.clear })).toBeVisible();
    expect(screen.queryByText("No users yet")).toBeNull();
  });

  it("clears only the term and the filter, keeping sort and size, on page 1", () => {
    renderList({
      rows: [],
      total: 0,
      state: stateOf({
        q: "zzz",
        status: "inactive",
        sort: { key: "name", dir: "desc" },
        size: 25,
        page: 4,
      }),
    });

    expect(screen.getByRole("link", { name: tables.clear })).toHaveAttribute(
      "href",
      "/users?sort=name&dir=desc&size=25",
    );
  });

  it("keeps a non-default sort when only the filter caused the no-results", () => {
    renderList({
      rows: [],
      total: 0,
      state: stateOf({
        status: "active",
        sort: { key: "login", dir: "asc" },
      }),
    });

    expect(screen.getByRole("link", { name: tables.clear })).toHaveAttribute(
      "href",
      "/users?sort=login&dir=asc",
    );
  });

  it("keeps the page size when only the term caused the no-results", () => {
    renderList({
      rows: [],
      total: 0,
      state: stateOf({ q: "zzz", size: 50, page: 2 }),
    });

    expect(screen.getByRole("link", { name: tables.clear })).toHaveAttribute(
      "href",
      "/users?size=50",
    );
  });

  it("keeps the search and the filter usable beside the no-results state", () => {
    renderList({ rows: [], total: 0, state: stateOf({ q: "zzz" }) });

    expect(screen.getByRole("searchbox")).toHaveValue("zzz");
    expect(screen.getByRole("link", { name: "Inactive" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("No results");
  });

  it("words the clear link in Spanish when the locale is es", () => {
    renderList({
      rows: [],
      total: 0,
      state: stateOf({ q: "zzz" }),
      locale: "es",
    });

    expect(screen.getByRole("link", { name: "Quitar filtros" })).toBeVisible();
  });
});

describe("ListTable pending (DT-PEND-1)", () => {
  it("is busy and dimmed with the previous rows and enabled controls", async () => {
    let release!: () => void;
    const arrival = new Promise<void>((resolve) => {
      release = resolve;
    });
    function Arrival({ wait }: { wait: boolean }) {
      if (wait) use(arrival);
      return null;
    }
    function Harness({ children }: { children: ReactNode }) {
      const [wait, setWait] = useState(false);
      router.replace.mockImplementation(() => setWait(true));
      return (
        <>
          {children}
          <Suspense fallback={null}>
            <Arrival wait={wait} />
          </Suspense>
        </>
      );
    }
    renderList({
      state: stateOf({ sort: { key: "name", dir: "asc" } }),
      total: 25,
      wrap: (ui) => <Harness>{ui}</Harness>,
    });
    const card = () =>
      screen.getByRole("table").closest('[data-slot="table-card"]')!;
    expect(card()).not.toHaveAttribute("aria-busy");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Name" }));
    });

    expect(card()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(tables.updating);
    // One dimming layer (the card body), by opacity only; the rows are not
    // dimmed a second time and the previous rows are still in the document.
    const body = card().querySelector('[data-slot="table-card-body"]')!;
    expect(body).toHaveClass("opacity-60", "transition-opacity");
    expect(body.className).not.toMatch(/transition-all/);
    expect(screen.getByRole("table").querySelector("tbody")).not.toHaveClass(
      "opacity-60",
    );
    expect(
      within(screen.getByRole("table")).getByText("Zoe"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No users yet")).toBeNull();
    expect(screen.getByRole("button", { name: "Name" })).toBeEnabled();
    expect(screen.getByRole("searchbox")).toBeEnabled();
    expect(
      screen.getByRole("combobox", { name: tables.pageSize.label }),
    ).toBeEnabled();

    await act(async () => {
      release();
    });

    await waitFor(() => expect(card()).not.toHaveAttribute("aria-busy"));
    expect(screen.getByRole("status")).toHaveTextContent("25 results");
    expect(
      card().querySelector('[data-slot="table-card-body"]'),
    ).not.toHaveClass("opacity-60");
  });
});
