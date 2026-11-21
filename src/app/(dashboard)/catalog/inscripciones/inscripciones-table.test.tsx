import { render, screen, waitFor, within } from "@testing-library/react";
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
import type { ActiveToggleState } from "@/lib/catalog/types";
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
// The real action is a server module; the table only binds it to a student, so
// a double records what the unchanged `ActiveToggle` posts to it.
const { toggleAction } = vi.hoisted(() => ({ toggleAction: vi.fn() }));
vi.mock("@/app/(dashboard)/catalog/inscripciones/actions", () => ({
  setInscripcionActivoAction: toggleAction,
}));

beforeEach(() => {
  resetNavigationMock();
  toggleAction.mockReset();
  toggleAction.mockResolvedValue({ kind: "done", activo: false });
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
    requestCount: 0,
    canReactivate: false,
    ...overrides,
  };
}

/** The state column of a body row (the fifth cell). */
const stateCellOf = (tr: HTMLElement) => within(tr).getAllByRole("cell")[4];

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
    ]) {
      expect(within(body).getByText(text)).toBeVisible();
    }
    // The toggle repeats the raw state, so the two state words are read inside
    // the state cell.
    const stateCell = stateCellOf(body);
    expect(within(stateCell).getByText(copy.state.active)).toBeVisible();
    expect(within(stateCell).getByText(copy.state.effective)).toBeVisible();
  });

  it("keeps the six columns in order and sorts only student, subject and group", () => {
    renderTable({ locale });

    const headers = screen.getAllByRole("columnheader");
    const labels = [
      copy.columns.student,
      copy.columns.subject,
      copy.columns.period,
      copy.columns.group,
      copy.columns.state,
      copy.columns.actions,
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
      false,
    ]);
  });
});

describe("InscripcionesTable states (EA-LIST-1 table, as text)", () => {
  const { state: copy } = messages.en.catalog.inscripciones;

  it("labels an active row of an offered group as active and in effect", () => {
    renderTable({ rows: [ROWS[0]] });

    const cell = stateCellOf(screen.getAllByRole("row")[1]);
    expect(within(cell).getByText(copy.active)).toBeVisible();
    expect(within(cell).getByText(copy.effective)).toBeVisible();
    expect(within(cell).queryByText(copy.notEffective)).toBeNull();
  });

  it("labels an active row whose group or asignatura is inactive as not in effect", () => {
    renderTable({ rows: [ROWS[1]] });

    const cell = stateCellOf(screen.getAllByRole("row")[1]);
    expect(within(cell).getByText(copy.active)).toBeVisible();
    expect(within(cell).getByText(copy.notEffective)).toBeVisible();
    expect(within(cell).queryByText(copy.effective)).toBeNull();
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

const IDLE: ActiveToggleState = { kind: "idle" };

/** What `ActiveToggle` posted on the nth call of the bound action. */
function posted(n = 0) {
  const [estudianteId, previous, formData] = toggleAction.mock.calls[n] as [
    number,
    ActiveToggleState,
    FormData,
  ];
  return {
    estudianteId,
    previous,
    id: formData.get("id"),
    intent: formData.get("intent"),
  };
}

/** The nth body row. */
const bodyRow = (n = 0) => screen.getAllByRole("row")[n + 1];

describe.each(["en", "es"] as const)(
  "InscripcionesTable deactivation in %s (EA-DEACT-1, RNF-12)",
  (locale) => {
    const copy = messages[locale].catalog.inscripciones.toggle;
    const shared = messages[locale].catalog.shared.toggle;

    async function openDialog(overrides: Partial<InscripcionRow> = {}) {
      const user = userEvent.setup();
      renderTable({ locale, rows: [row(overrides)] });
      await user.click(
        within(bodyRow()).getByRole("button", { name: shared.deactivate }),
      );
      return { user, dialog: screen.getByRole("group") };
    }

    it("names the student, the subject and the group in the confirmation title", async () => {
      const { dialog } = await openDialog();

      expect(dialog).toHaveAccessibleName(
        shared.confirmTitle.replace(
          "{record}",
          copy.recordLabel
            .replace("{student}", "Ana Pérez")
            .replace("{code}", "MAT-101")
            .replace("{group}", "01"),
        ),
      );
      expect(toggleAction).not.toHaveBeenCalled();
    });

    it.each([0, 2])(
      "always carries the RN-27 retention sentence (%d requests)",
      async (requestCount) => {
        const { dialog } = await openDialog({ requestCount });

        expect(dialog).toHaveTextContent(copy.retention);
      },
    );

    it("says nothing is cancelled automatically", async () => {
      const { dialog } = await openDialog();

      expect(dialog.textContent).toMatch(
        locale === "en"
          ? /nothing is cancelled automatically/i
          : /no se cancela nada de forma automática/i,
      );
    });

    it("mentions no request and no draft when the count is zero", async () => {
      const { dialog } = await openDialog({ requestCount: 0 });

      expect(dialog.textContent).not.toMatch(
        /request|solicitud|draft|borrador/i,
      );
      expect(document.body.innerHTML).not.toMatch(/draft|borrador/i);
    });

    it("confirm posts the group id and the deactivate intent for the row's student", async () => {
      const { user, dialog } = await openDialog();

      await user.click(
        within(dialog).getByRole("button", { name: shared.confirm }),
      );

      await waitFor(() => expect(toggleAction).toHaveBeenCalledTimes(1));
      expect(posted()).toEqual({
        estudianteId: 5,
        previous: IDLE,
        id: "9",
        intent: "deactivate",
      });
    });

    it("cancel closes the dialog and calls no action", async () => {
      const { user, dialog } = await openDialog();

      await user.click(
        within(dialog).getByRole("button", { name: shared.cancel }),
      );

      expect(screen.queryByRole("group")).toBeNull();
      expect(
        within(bodyRow()).getByRole("button", { name: shared.deactivate }),
      ).toBeVisible();
      expect(toggleAction).not.toHaveBeenCalled();
    });
  },
);

describe("InscripcionesTable deactivation notice (EA-DEACT-1 count table)", () => {
  async function dialogFor(
    requestCount: number,
    locale: TestLocale,
  ): Promise<HTMLElement> {
    const user = userEvent.setup();
    renderTable({ locale, rows: [row({ requestCount })] });
    await user.click(
      within(bodyRow()).getByRole("button", {
        name: messages[locale].catalog.shared.toggle.deactivate,
      }),
    );
    return screen.getByRole("group");
  }

  it.each([
    ["en", 1, "1 submitted request uses this group; it does not change."],
    ["en", 2, "2 submitted requests use this group; they do not change."],
    ["en", 5, "5 submitted requests use this group; they do not change."],
    ["es", 1, "1 solicitud enviada usa este grupo; no cambia."],
    ["es", 3, "3 solicitudes enviadas usan este grupo; no cambian."],
  ] as const)(
    "in %s a count of %d is stated as: %s",
    async (locale, count, sentence) => {
      const dialog = await dialogFor(count, locale);

      expect(dialog).toHaveTextContent(sentence);
    },
  );

  it("puts the count and the retention sentence in the one notice paragraph of the toggle", async () => {
    const dialog = await dialogFor(2, "en");

    const notice = within(dialog).getByText(/2 submitted requests/);
    expect(notice.tagName).toBe("P");
    expect(notice).toHaveTextContent(
      messages.en.catalog.inscripciones.toggle.retention,
    );
  });
});

describe("InscripcionesTable deactivation of any period (D9)", () => {
  it.each([
    [5, 9, "2026-S2"],
    [6, 10, "2024-S1"],
  ] as const)(
    "offers the toggle on an active row of student %d, group %d, period %s, in effect or not",
    async (estudianteId, grupoId, periodo) => {
      const user = userEvent.setup();
      renderTable({
        rows: [row({ estudianteId, grupoId, periodo, effective: false })],
      });

      await user.click(
        within(bodyRow()).getByRole("button", { name: "Deactivate" }),
      );
      await user.click(screen.getByRole("button", { name: "Yes, deactivate" }));

      await waitFor(() => expect(toggleAction).toHaveBeenCalledTimes(1));
      expect(posted()).toMatchObject({
        estudianteId,
        id: String(grupoId),
        intent: "deactivate",
      });
    },
  );

  it("binds each row to its own student", async () => {
    const user = userEvent.setup();
    renderTable({
      rows: [row(), row({ estudianteId: 8, grupoId: 12 })],
    });

    await user.click(
      within(bodyRow(1)).getByRole("button", { name: "Deactivate" }),
    );
    await user.click(screen.getByRole("button", { name: "Yes, deactivate" }));

    await waitFor(() => expect(toggleAction).toHaveBeenCalledTimes(1));
    expect(posted()).toMatchObject({ estudianteId: 8, id: "12" });
  });
});

describe("InscripcionesTable reactivation (EA-REACT-1)", () => {
  const INACTIVE = { activo: false, effective: false } as const;
  const SHARED = messages.en.catalog.shared;

  it("is one press with no dialog when the row can be reactivated", async () => {
    const user = userEvent.setup();
    renderTable({ rows: [row({ ...INACTIVE, canReactivate: true })] });

    await user.click(
      within(bodyRow()).getByRole("button", { name: "Reactivate" }),
    );

    expect(screen.queryByRole("group")).toBeNull();
    await waitFor(() => expect(toggleAction).toHaveBeenCalledTimes(1));
    expect(posted()).toEqual({
      estudianteId: 5,
      previous: IDLE,
      id: "9",
      intent: "reactivate",
    });
  });

  it("offers no control on an inactive row that cannot be reactivated, not even a dead one", () => {
    const { container } = renderTable({
      rows: [row({ ...INACTIVE, canReactivate: false })],
    });

    expect(container.querySelector("table form")).toBeNull();
    expect(within(bodyRow()).queryAllByRole("button")).toHaveLength(0);
    expect(within(bodyRow()).queryAllByRole("link")).toHaveLength(0);
  });

  it("offers reactivation only on the rows that can take it", () => {
    renderTable({
      rows: [
        row({ ...INACTIVE, canReactivate: true }),
        row({ ...INACTIVE, estudianteId: 6, grupoId: 10 }),
        row({ estudianteId: 7, grupoId: 11 }),
      ],
    });

    expect(screen.getAllByRole("button", { name: "Reactivate" })).toHaveLength(
      1,
    );
    expect(screen.getAllByRole("button", { name: "Deactivate" })).toHaveLength(
      1,
    );
  });

  it.each([
    [{ kind: "done", activo: true }, SHARED.status.active],
    [{ kind: "unchanged" }, SHARED.refusals.unchanged],
    [{ kind: "gone" }, `${SHARED.notFound.title}. ${SHARED.notFound.message}`],
    [
      { kind: "error", message: "Not reactivated: try again." },
      "Not reactivated: try again.",
    ],
  ] as const)(
    "renders the %j answer as text in the row",
    async (answer, text) => {
      toggleAction.mockResolvedValue(answer);
      const user = userEvent.setup();
      renderTable({ rows: [row({ ...INACTIVE, canReactivate: true })] });

      await user.click(
        within(bodyRow()).getByRole("button", { name: "Reactivate" }),
      );

      await waitFor(() =>
        expect(within(bodyRow()).getByRole("status")).toHaveTextContent(text),
      );
    },
  );
});

describe("InscripcionesTable delivers nothing beyond the row fields (EA-PII-1)", () => {
  it("is a POST form per toggle row and never a link", () => {
    renderTable();

    const forms = [...document.querySelectorAll("table form")];
    // ROWS has two raw-active rows and one inactive row that cannot be reactivated.
    expect(forms).toHaveLength(2);
    for (const form of forms) expect(form).toHaveAttribute("method", "post");
    expect(within(screen.getByRole("table")).queryAllByRole("link")).toEqual(
      [],
    );
  });

  it("renders nothing beyond the delivered fields, even if a row carried more", () => {
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
