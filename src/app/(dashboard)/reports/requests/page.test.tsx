import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  sessionFor,
  type Locale,
} from "@/app/(dashboard)/review/test-support";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock, scopeMock, loadMock, auditMock, state } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    getSessionMock: vi.fn(),
    scopeMock: vi.fn(),
    loadMock: vi.fn(),
    auditMock: vi.fn(),
    state: { locale: "en" as Locale },
  }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
// The REAL dal runs on a mocked session source, so the guard order is the
// production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/report-scope", () => ({ resolveReportScope: scopeMock }));
vi.mock("@/lib/data/report-requests", () => ({
  loadReportRequests: loadMock,
}));
vi.mock("@/lib/data/report-reads", () => ({
  recordReportRequestsRead: auditMock,
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

const CARRERA = 3;
const SCOPE = { kind: "carrera", carreraId: CARRERA } as const;

function request(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    estudianteNombre: `Student ${id}`,
    estudianteCif: `2021-00${id}`,
    causa: "medica",
    estado: "pendiente",
    fechaInicio: "2026-03-02",
    fechaFin: "2026-03-04",
    presentadaEn: new Date("2026-03-05T15:00:00Z"),
    classes: [
      {
        solicitudId: id,
        codigo: "MAT101",
        asignatura: "Calculo I",
        periodo: "2026-S1",
        docente: "Marta Ruiz",
      },
    ],
    ...overrides,
  };
}

function view(overrides: Record<string, unknown> = {}) {
  return {
    rows: [request(2), request(1)],
    total: 2,
    page: 1,
    pageSize: 25,
    periods: ["2026-S2", "2026-S1"],
    docentes: [
      { id: 4, name: "Ana Mora" },
      { id: 9, name: "Marta Ruiz" },
    ],
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
      messages={messages[state.locale]}
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

const en = messages.en.reports;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/reports/requests/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  loadMock.mockReset();
  loadMock.mockResolvedValue(view());
  auditMock.mockReset();
  auditMock.mockResolvedValue(undefined);
});

describe("ReportRequestsPage access (CR-ACC-1, RNF-01)", () => {
  it("renders the detail for coordinacion and reads the scope for the session user", async () => {
    await renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.detail.title,
    );
    expect(scopeMock).toHaveBeenCalledWith(7, "coordinacion");
    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(loadMock.mock.calls[0][0]).toEqual(SCOPE);
  });

  it.each(rolesUsuario.filter((r) => r !== "coordinacion"))(
    "sends %s to /denied with no scope read, no data and no audit row",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(loadMock).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
    expect(loadMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("sends a flagged coordinacion to the change screen first", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );
    expect(loadMock).not.toHaveBeenCalled();
  });
});

describe("ReportRequestsPage without a career (fail closed)", () => {
  it("shows the alert block and no data, no query and no audit row", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await renderPage();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(en.noCareer.title);
    expect(alert).toHaveTextContent(en.noCareer.message);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(loadMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("ReportRequestsPage degraded read (CR-DET-3)", () => {
  it("shows only the degraded status: no table, no filters, no zeros and no audit row", async () => {
    loadMock.mockResolvedValue(
      view({ rows: [], total: 0, periods: [], docentes: [], degraded: true }),
    );

    await renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(en.detail.degraded);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(en.detail.noResults.title)).toBeNull();
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("ReportRequestsPage rows (CR-DET-1)", () => {
  it("lists one row per request with the seven columns, the cause and the state in words", async () => {
    loadMock.mockResolvedValue(
      view({
        rows: [
          request(2, { causa: "fuerza_mayor", estado: "devuelta" }),
          request(1),
        ],
      }),
    );

    await renderPage();

    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      en.detail.columns.student,
      en.detail.columns.cif,
      en.detail.columns.cause,
      en.detail.columns.state,
      en.detail.columns.absence,
      en.detail.columns.submitted,
      en.detail.columns.classes,
    ]);
    const body = screen.getAllByRole("row").slice(1);
    expect(body).toHaveLength(2);
    const [first, second] = body.map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
    expect(first.slice(0, 4)).toEqual([
      "Student 2",
      "2021-002",
      messages.en.intake.causes.fuerza_mayor,
      messages.en.requests.states.devuelta,
    ]);
    expect(second.slice(0, 4)).toEqual([
      "Student 1",
      "2021-001",
      messages.en.intake.causes.medica,
      messages.en.requests.states.pendiente,
    ]);
  });

  it("writes the absence dates as calendar dates and the submission in the business time zone", async () => {
    // 03:00 UTC on 6 March is still the evening of 5 March in Managua (UTC-6).
    loadMock.mockResolvedValue(
      view({
        rows: [
          request(1, {
            fechaInicio: "2026-03-02",
            fechaFin: "2026-03-04",
            presentadaEn: new Date("2026-03-06T03:00:00Z"),
          }),
        ],
        total: 1,
      }),
    );

    await renderPage();

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[4]).toHaveTextContent("Mar 2, 2026 to Mar 4, 2026");
    expect(cells[5]).toHaveTextContent("Mar 5, 2026");
    expect(cells[5]).not.toHaveTextContent("Mar 6, 2026");
  });

  it("puts every class of a request in its one cell with teacher and period", async () => {
    loadMock.mockResolvedValue(
      view({
        rows: [
          request(1, {
            classes: [
              {
                solicitudId: 1,
                codigo: "MAT101",
                asignatura: "Calculo I",
                periodo: "2026-S1",
                docente: "Marta Ruiz",
              },
              {
                solicitudId: 1,
                codigo: "FIS101",
                asignatura: "Fisica",
                periodo: "2026-S2",
                docente: "Luis Mora",
              },
            ],
          }),
        ],
        total: 1,
      }),
    );

    await renderPage();

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(
      within(cells[6])
        .getAllByRole("listitem")
        .map((line) => line.textContent),
    ).toEqual([
      "Calculo I · Marta Ruiz · 2026-S1",
      "Fisica · Luis Mora · 2026-S2",
    ]);
  });

  it("shows the total of requests, not the rows of the page", async () => {
    loadMock.mockResolvedValue(
      view({ rows: [request(2), request(1)], total: 30, page: 1 }),
    );

    await renderPage();

    expect(screen.getByText("30 requests")).toBeInTheDocument();
  });

  it("uses the singular for one request", async () => {
    loadMock.mockResolvedValue(view({ rows: [request(1)], total: 1 }));

    await renderPage();

    expect(screen.getByText("1 request")).toBeInTheDocument();
  });

  it("renders in Spanish with the Spanish catalog", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.es.reports.detail.title,
    );
    expect(screen.getByText("2 solicitudes")).toBeInTheDocument();
    expect(screen.getAllByText(messages.es.intake.causes.medica)).toHaveLength(
      2,
    );
  });
});

describe("ReportRequestsPage filters (CR-DET-2, CR-6)", () => {
  it("reads every filter from the URL and ANDs them in one load", async () => {
    await renderPage({
      period: "2026-S1",
      docente: "9",
      causa: "medica",
      q: "Ana",
      page: "2",
    });

    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(loadMock).toHaveBeenCalledWith(
      SCOPE,
      { periodo: "2026-S1", docenteId: 9, q: "Ana", causa: "medica" },
      2,
    );
  });

  it("has no hidden default period: an absent period lists every period", async () => {
    await renderPage();

    expect(loadMock.mock.calls[0][1]).toMatchObject({ periodo: null });
    expect(
      screen.getByRole("combobox", { name: en.period.label }),
    ).toHaveTextContent(en.period.all);
  });

  it.each([
    ["an unknown value", "2026-S9"],
    ["a repeated parameter", ["2026-S1", "2026-S2"]],
  ])("treats %s as every period", async (_name, period) => {
    await renderPage({ period });

    expect(loadMock.mock.calls[0][1]).toMatchObject({ periodo: null });
  });

  it("ignores a cause outside the five, as if it were not set", async () => {
    await renderPage({ causa: "vacaciones" });

    expect(loadMock.mock.calls[0][1]).toMatchObject({ causa: null });
    expect(
      screen.getByRole("combobox", { name: en.detail.filters.cause }),
    ).toHaveTextContent(en.detail.filters.allCauses);
  });

  it("ignores an unreadable teacher id", async () => {
    await renderPage({ docente: "0" });

    expect(loadMock.mock.calls[0][1]).toMatchObject({ docenteId: null });
  });

  it("shows the filters with the chosen values", async () => {
    await renderPage({
      period: "2026-S1",
      docente: "9",
      causa: "medica",
      q: "Ana",
    });

    expect(
      screen.getByRole("combobox", { name: en.period.label }),
    ).toHaveTextContent("2026-S1");
    expect(
      screen.getByRole("combobox", { name: en.detail.filters.teacher }),
    ).toHaveTextContent("Marta Ruiz");
    expect(
      screen.getByRole("combobox", { name: en.detail.filters.cause }),
    ).toHaveTextContent(messages.en.intake.causes.medica);
    expect(
      screen.getByRole("textbox", { name: en.detail.filters.student }),
    ).toHaveValue("Ana");
  });

  it("shows a foreign teacher id as generic text and no rows, leaking no name", async () => {
    loadMock.mockResolvedValue(view({ rows: [], total: 0 }));

    await renderPage({ docente: "99" });

    expect(
      screen.getByRole("combobox", { name: en.detail.filters.teacher }),
    ).toHaveTextContent(en.detail.filters.teacherOutside);
    expect(screen.getByText(en.detail.noResults.title)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("ReportRequestsPage no results (CR-DET-3)", () => {
  beforeEach(() => {
    loadMock.mockResolvedValue(view({ rows: [], total: 0 }));
  });

  it("shows the no-results state with a clear link that never prefetches, and keeps the filters", async () => {
    await renderPage({ causa: "medica" });

    expect(screen.getByText(en.detail.noResults.title)).toBeInTheDocument();
    expect(screen.getByText(en.detail.noResults.hint)).toBeInTheDocument();
    const clears = screen.getAllByRole("link", {
      name: en.detail.filters.clear,
    });
    expect(clears.length).toBeGreaterThan(0);
    for (const clear of clears) {
      expect(clear).toHaveAttribute("href", "/reports/requests");
      expect(clear).toHaveAttribute("data-prefetch", "false");
    }
    expect(
      screen.getByRole("combobox", { name: en.detail.filters.cause }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("still writes its audit row, with a total of 0", async () => {
    await renderPage({ causa: "medica" });

    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      7,
      CARRERA,
      "all",
      null,
      "medica",
      false,
      0,
    );
  });
});

describe("ReportRequestsPage paging (CR-DET-3, CR-6)", () => {
  it("links to the neighbouring pages with the resolved period and every filter, never prefetching", async () => {
    loadMock.mockResolvedValue(view({ total: 60, page: 2 }));

    await renderPage({
      period: "2026-S1",
      docente: "9",
      causa: "medica",
      q: "Ana",
      page: "2",
    });

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    const previous = within(nav).getByRole("link", { name: /Previous/ });
    const next = within(nav).getByRole("link", { name: /Next/ });
    expect(previous).toHaveAttribute(
      "href",
      "/reports/requests?q=Ana&period=2026-S1&docente=9&causa=medica",
    );
    expect(next).toHaveAttribute(
      "href",
      "/reports/requests?q=Ana&period=2026-S1&docente=9&causa=medica&page=3",
    );
    expect(previous).toHaveAttribute("data-prefetch", "false");
    expect(next).toHaveAttribute("data-prefetch", "false");
    expect(within(nav).getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("writes period=all on the links when no period was chosen", async () => {
    loadMock.mockResolvedValue(view({ total: 60, page: 1 }));

    await renderPage();

    const next = within(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).getByRole("link", { name: /Next/ });
    expect(next).toHaveAttribute("href", "/reports/requests?period=all&page=2");
  });

  it("shows the page the data layer clamped to, not the one in the URL", async () => {
    loadMock.mockResolvedValue(view({ total: 30, page: 2 }));

    await renderPage({ page: "9" });

    expect(loadMock.mock.calls[0][2]).toBe(9);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("shows no pagination when everything fits in one page", async () => {
    await renderPage();

    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });
});

describe("ReportRequestsPage audit (CR-DET-4, RNF-06)", () => {
  it("writes exactly one row, after the data loaded, with the applied filters and the total", async () => {
    loadMock.mockResolvedValue(view({ total: 18 }));
    const order: string[] = [];
    loadMock.mockImplementation(async () => {
      order.push("load");
      return view({ total: 18 });
    });
    auditMock.mockImplementation(async () => {
      order.push("audit");
    });

    await renderPage({ period: "2026-S1", docente: "9", causa: "medica" });

    expect(order).toEqual(["load", "audit"]);
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      7,
      CARRERA,
      "2026-S1",
      9,
      "medica",
      false,
      18,
    );
  });

  it("records every period as all, and unset filters as null", async () => {
    await renderPage();

    expect(auditMock).toHaveBeenCalledWith(
      7,
      CARRERA,
      "all",
      null,
      null,
      false,
      2,
    );
  });

  it("stores only that a search was typed, never the term", async () => {
    await renderPage({ q: "Maria Lopez" });

    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][5]).toBe(true);
    expect(JSON.stringify(auditMock.mock.calls)).not.toContain("Maria Lopez");
  });

  it("returns no data when the audit insert fails", async () => {
    auditMock.mockRejectedValue(new Error("audit down"));

    await expect(renderPage()).rejects.toThrow("audit down");
  });

  it("writes no row when the load itself throws", async () => {
    loadMock.mockRejectedValue(new Error("boom"));

    await expect(renderPage()).rejects.toThrow("boom");
    expect(auditMock).not.toHaveBeenCalled();
  });
});
