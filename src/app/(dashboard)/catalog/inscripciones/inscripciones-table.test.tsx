import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  InscripcionesTable,
  type InscripcionRow,
} from "@/app/(dashboard)/catalog/inscripciones/inscripciones-table";
import {
  catalogListHref,
  parseInscripcionesListParams,
  type InscripcionesListState,
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

const BASE = "/catalog/inscripciones";
const DEFAULT_STATE = parseInscripcionesListParams({});
const PERIODS = ["2026-S2", "2026-S1"];

const stateOf = (
  overrides: Partial<InscripcionesListState> = {},
): InscripcionesListState => ({ ...DEFAULT_STATE, ...overrides });

function row(overrides: Partial<InscripcionRow> = {}): InscripcionRow {
  return {
    estudianteId: 5,
    grupoId: 9,
    estudianteNombre: "Ana Pérez",
    estudianteCif: "CIF-0042",
    asignaturaCodigo: "MAT-101",
    asignaturaNombre: "Calculus",
    periodo: "2026-S2",
    numeroGrupo: "01",
    activo: true,
    effective: true,
    ...overrides,
  };
}

/** The three rows of EA-LIST-1 that differ in what they show. */
const ROWS: InscripcionRow[] = [
  row(),
  row({ estudianteId: 6, grupoId: 10, effective: false }),
  row({ estudianteId: 7, grupoId: 11, activo: false, effective: false }),
];

function renderTable({
  rows = ROWS,
  total = rows.length,
  state = DEFAULT_STATE,
  periods = PERIODS,
  locale = "en",
}: {
  rows?: readonly InscripcionRow[];
  total?: number;
  state?: InscripcionesListState;
  periods?: readonly string[];
  locale?: TestLocale;
} = {}) {
  return renderWithIntl(
    <InscripcionesTable
      rows={rows}
      total={total}
      state={state}
      periods={periods}
    />,
    locale,
  );
}

describe.each(["es", "en"] as const)("InscripcionesTable in %s", (locale) => {
  const copy = messages[locale].catalog.inscripciones;

  it("names the table and shows every field of a row as text (EA-LIST-1)", () => {
    renderTable({ locale, rows: [row()] });

    expect(
      screen.getByRole("table", { name: new RegExp(copy.tableCaption) }),
    ).toBeVisible();
    const [, body] = screen.getAllByRole("row");
    for (const text of [
      "Ana Pérez",
      "CIF-0042",
      "MAT-101",
      "Calculus",
      "2026-S2",
      "01",
      copy.state.active,
      copy.state.effective,
    ]) {
      expect(within(body).getByText(text)).toBeVisible();
    }
  });

  it("keeps the five columns in order and sorts only student, subject and group", () => {
    renderTable({ locale });

    const headers = screen.getAllByRole("columnheader");
    const labels = [
      copy.columns.student,
      copy.columns.subject,
      copy.columns.period,
      copy.columns.group,
      copy.columns.state,
    ];
    expect(headers.map((header) => header.textContent)).toEqual(
      labels.map((label) => expect.stringContaining(label)),
    );
    expect(headers.map((h) => h.querySelector("button") !== null)).toEqual([
      true,
      true,
      false,
      true,
      false,
    ]);
  });
});

describe("InscripcionesTable states (EA-LIST-1 table, as text)", () => {
  const { state: copy } = messages.en.catalog.inscripciones;

  it("labels an active row of an offered group as active and in effect", () => {
    renderTable({ rows: [ROWS[0]] });

    const [, body] = screen.getAllByRole("row");
    expect(within(body).getByText(copy.active)).toBeVisible();
    expect(within(body).getByText(copy.effective)).toBeVisible();
    expect(within(body).queryByText(copy.notEffective)).toBeNull();
  });

  it("labels an active row whose group or asignatura is inactive as not in effect", () => {
    renderTable({ rows: [ROWS[1]] });

    const [, body] = screen.getAllByRole("row");
    expect(within(body).getByText(copy.active)).toBeVisible();
    expect(within(body).getByText(copy.notEffective)).toBeVisible();
    expect(within(body).queryByText(copy.effective)).toBeNull();
  });

  it("labels an inactive row as inactive only", () => {
    renderTable({ rows: [ROWS[2]] });

    const [, body] = screen.getAllByRole("row");
    expect(within(body).getByText(copy.inactive)).toBeVisible();
    expect(within(body).queryByText(copy.active)).toBeNull();
    expect(within(body).queryByText(copy.effective)).toBeNull();
    expect(within(body).queryByText(copy.notEffective)).toBeNull();
  });

  it("shows a student without a CIF by name alone", () => {
    renderTable({ rows: [row({ estudianteCif: null })] });

    const [, body] = screen.getAllByRole("row");
    expect(within(body).getByText("Ana Pérez")).toBeVisible();
    expect(body.textContent).not.toMatch(/null|CIF-/);
  });
});

describe("InscripcionesTable sorting (EA-LIST-1, DT-SORT-2)", () => {
  it("marks only the sorted column, student ascending by default", () => {
    renderTable();

    const sorted = screen
      .getAllByRole("columnheader")
      .filter((header) => header.hasAttribute("aria-sort"));
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(sorted[0]).getByRole("button", { name: "Student" }),
    ).toBeVisible();
  });

  it("replaces the entry with the new column ascending, or reverses the active one", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Subject" }));
    expect(router.replace).toHaveBeenLastCalledWith(
      `${BASE}?sort=subject&dir=asc`,
      {
        scroll: false,
      },
    );

    await user.click(screen.getByRole("button", { name: "Student" }));
    expect(router.replace).toHaveBeenLastCalledWith(
      `${BASE}?sort=student&dir=desc`,
      {
        scroll: false,
      },
    );
  });

  it("keeps every filter and the page size when sorting, and returns to page 1", async () => {
    const user = userEvent.setup();
    renderTable({
      state: stateOf({
        q: "ana",
        asignatura: "mat",
        grupo: "2",
        periodo: "2026-S1",
        status: "inactive",
        size: 25,
        page: 2,
      }),
      total: 60,
    });

    await user.click(screen.getByRole("button", { name: "Group" }));

    expect(router.replace).toHaveBeenCalledWith(
      `${BASE}?q=ana&asignatura=mat&grupo=2&periodo=2026-S1&status=inactive&sort=group&dir=asc&size=25`,
      { scroll: false },
    );
  });
});

describe("InscripcionesTable is read-only in S1 (EA-LIST-1)", () => {
  it("has no form, button, link or checkbox in a body row", () => {
    const { container } = renderTable();

    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(ROWS.length);
    for (const tr of bodyRows) {
      expect(within(tr).queryAllByRole("button")).toHaveLength(0);
      expect(within(tr).queryAllByRole("link")).toHaveLength(0);
      expect(within(tr).queryAllByRole("checkbox")).toHaveLength(0);
    }
    expect(container.querySelector("table form")).toBeNull();
  });

  it("renders nothing beyond the delivered fields, even if a row carried more (EA-PII-1)", () => {
    const leaky = [
      {
        ...row(),
        correo: "leak@uni.edu",
        telefono: "555-0100",
        dependentRequests: 7,
        hasActiveSibling: true,
        writable: true,
      },
    ] as unknown as InscripcionRow[];

    const { container } = renderTable({ rows: leaky });

    expect(container.textContent).toContain("Ana Pérez");
    for (const secret of ["leak@uni.edu", "555-0100"]) {
      expect(container.innerHTML).not.toContain(secret);
    }
    expect(container.textContent).not.toMatch(/\b7\b/);
  });
});

describe("InscripcionesTable filter bar (EA-FILT-1)", () => {
  const copy = messages.en.catalog.inscripciones.filters;

  it("offers student, subject, group, period and status, filled from the URL state", () => {
    renderTable({
      state: stateOf({
        q: "ana",
        asignatura: "mat",
        grupo: "2",
        periodo: "2026-S1",
        status: "inactive",
      }),
    });

    const search = screen.getByRole("search", { name: copy.label });
    expect(within(search).getByLabelText(copy.student.label)).toHaveValue(
      "ana",
    );
    expect(within(search).getByLabelText(copy.asignatura.label)).toHaveValue(
      "mat",
    );
    expect(within(search).getByLabelText(copy.grupo.label)).toHaveValue("2");
    expect(within(search).getByLabelText(copy.periodo.label)).toHaveValue(
      "2026-S1",
    );
    expect(within(search).getByLabelText(copy.status.label)).toHaveValue(
      "inactive",
    );
  });

  it("lists the latest-period option first, then the periods, and only active or inactive", () => {
    renderTable();

    const period = screen.getByLabelText(copy.periodo.label);
    expect(
      within(period)
        .getAllByRole("option")
        .map((option) => [option.textContent, option.getAttribute("value")]),
    ).toEqual([
      [copy.periodo.latest, ""],
      ["2026-S2", "2026-S2"],
      ["2026-S1", "2026-S1"],
    ]);
    expect(
      within(screen.getByLabelText(copy.status.label))
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["active", "inactive"]);
    expect(screen.getByLabelText(copy.periodo.label)).toHaveValue("");
  });

  it("offers only the latest-period option when there are no periods", () => {
    renderTable({ rows: [], total: 0, periods: [] });

    expect(
      within(screen.getByLabelText(copy.periodo.label)).getAllByRole("option"),
    ).toHaveLength(1);
  });

  it("submits as a plain GET before hydration, carrying sort and size but no filter", () => {
    renderTable({
      state: stateOf({
        q: "ana",
        status: "inactive",
        sort: { key: "subject", dir: "desc" },
        size: 25,
        page: 3,
      }),
      total: 60,
    });

    const form = screen.getByRole("search", { name: copy.label });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", BASE);
    const hidden = [...form.querySelectorAll('input[type="hidden"]')].map(
      (input) => [input.getAttribute("name"), input.getAttribute("value")],
    );
    expect(hidden).toEqual([
      ["sort", "subject"],
      ["dir", "desc"],
      ["size", "25"],
    ]);
  });

  it("applies every filter at once through the URL, keeping sort and size and resetting the page", async () => {
    const user = userEvent.setup();
    renderTable({
      state: stateOf({
        sort: { key: "subject", dir: "desc" },
        size: 25,
        page: 3,
      }),
      total: 60,
    });

    await user.type(screen.getByLabelText(copy.student.label), "  ana  ");
    await user.type(screen.getByLabelText(copy.asignatura.label), "mat");
    await user.type(screen.getByLabelText(copy.grupo.label), "2");
    await user.selectOptions(
      screen.getByLabelText(copy.periodo.label),
      "2026-S1",
    );
    await user.selectOptions(
      screen.getByLabelText(copy.status.label),
      "inactive",
    );
    await user.click(screen.getByRole("button", { name: copy.apply }));

    expect(router.push).toHaveBeenCalledWith(
      `${BASE}?q=ana&asignatura=mat&grupo=2&periodo=2026-S1&status=inactive&sort=subject&dir=desc&size=25`,
      { scroll: false },
    );
  });

  it("an empty submit goes back to the unfiltered address", async () => {
    const user = userEvent.setup();
    renderTable({ state: stateOf({ q: "ana", status: "inactive" }) });

    await user.clear(screen.getByLabelText(copy.student.label));
    await user.selectOptions(
      screen.getByLabelText(copy.status.label),
      "active",
    );
    await user.click(screen.getByRole("button", { name: copy.apply }));

    expect(router.push).toHaveBeenCalledWith(BASE, { scroll: false });
  });
});

describe("InscripcionesTable controls (EA-LIST-1, DT-URL-2)", () => {
  it("exposes the count politely", () => {
    renderTable({ total: 3 });

    const count = screen.getByText("3 results");
    expect(count).toHaveAttribute("role", "status");
    expect(count).toHaveAttribute("aria-live", "polite");
  });

  it("shows the footer with links that keep every filter when the total exceeds one page", () => {
    renderTable({
      state: stateOf({ q: "ana", periodo: "2026-S1", status: "inactive" }),
      total: 60,
    });

    const footer = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(footer).getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      catalogListHref(BASE, {
        q: "ana",
        periodo: "2026-S1",
        status: "inactive",
        page: 2,
      }),
    );
    expect(within(footer).getByRole("link", { name: "Last" })).toHaveAttribute(
      "href",
      `${BASE}?q=ana&periodo=2026-S1&status=inactive&page=6`,
    );
  });

  it("omits the footer when everything fits on one page", () => {
    renderTable({ total: 3 });

    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
  });
});

describe("InscripcionesTable states (EA-FILT-1, EA-LIST-1 'Nothing in scope')", () => {
  const copy = messages.en.catalog.inscripciones;

  it("shows the shared empty state and no table when nothing is in the default view", () => {
    renderTable({ rows: [], total: 0 });

    expect(screen.getByText(copy.empty)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Clear filters" }),
    ).not.toBeInTheDocument();
    // The filters stay reachable: an empty latest period still has older ones.
    expect(screen.getByLabelText(copy.filters.periodo.label)).toBeVisible();
  });

  it("names the search term in no-results and clears every filter but sort and size", () => {
    renderTable({
      rows: [],
      total: 0,
      state: stateOf({
        q: "zzz",
        asignatura: "mat",
        periodo: "2026-S1",
        status: "inactive",
        sort: { key: "subject", dir: "desc" },
        size: 25,
      }),
    });

    expect(screen.getByText("No results for “zzz”")).toBeVisible();
    expect(screen.getByText(copy.noResults.hint)).toBeVisible();
    expect(screen.queryByText(copy.empty)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      `${BASE}?sort=subject&dir=desc&size=25`,
    );
  });

  it.each([
    ["asignatura", { asignatura: "zz" }],
    ["grupo", { grupo: "9" }],
    ["periodo", { periodo: "2020-S1" }],
    ["status", { status: "inactive" as const }],
  ])(
    "words a %s filter that matches nothing without a term",
    (_name, filter) => {
      renderTable({ rows: [], total: 0, state: stateOf(filter) });

      expect(screen.getByText(copy.noResults.titleFilters)).toBeVisible();
      expect(screen.queryByText(copy.empty)).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Clear filters" }),
      ).toHaveAttribute("href", BASE);
    },
  );

  it("says in Spanish that nothing matches the filters", () => {
    renderTable({
      rows: [],
      total: 0,
      state: stateOf({ grupo: "9" }),
      locale: "es",
    });

    expect(
      screen.getByText(
        messages.es.catalog.inscripciones.noResults.titleFilters,
      ),
    ).toBeVisible();
  });
});

// RNF-11: jsdom has no layout, so this is the static guard of
// `enrollment/layout-360.test.tsx`; the real check is the owner walk at 360 px.
const VIEWPORT = 360;
const REM = 16;
const SPACING_PX = 4;

function fixedWidth(token: string): number | null {
  const arbitrary = /^(?:min-)?w-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(token);
  if (arbitrary) {
    const value = Number(arbitrary[1]);
    return arbitrary[2] === "rem" ? value * REM : value;
  }
  const scale = /^(?:min-)?w-(\d+)$/.exec(token);
  return scale ? Number(scale[1]) * SPACING_PX : null;
}

function tooWide(root: ParentNode): string[] {
  return [...root.querySelectorAll("[class]")].flatMap((element) =>
    element.className
      .toString()
      .split(/\s+/)
      .filter((token) => (fixedWidth(token) ?? 0) > VIEWPORT),
  );
}

describe("InscripcionesTable at 360 px (RNF-11)", () => {
  it("the width guard flags a fixed width above the viewport and passes the others", () => {
    const { container } = render(
      <div>
        <div className="w-[400px]" />
        <div className="min-w-[30rem] sm:w-96" />
        <div className="w-[320px] w-full max-w-md sm:w-auto" />
      </div>,
    );

    expect(tooWide(container)).toEqual(["w-[400px]", "min-w-[30rem]"]);
  });

  it("sets no width above the viewport and lets the filter fields wrap", () => {
    const { container } = renderTable();

    expect(container.querySelectorAll("table").length).toBe(1);
    expect(tooWide(container)).toEqual([]);
    expect(
      screen.getByRole("search", { name: "Filter enrollments" }),
    ).toHaveClass("flex-wrap");
    for (const field of ["Student", "Subject", "Group", "Period", "Status"]) {
      expect(screen.getByLabelText(field)).toHaveClass("h-11");
    }
  });
});
