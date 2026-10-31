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
vi.mock("@/lib/data/report-rankings", () => ({
  loadReportDashboard: loadMock,
}));
vi.mock("@/lib/data/report-reads", () => ({
  recordReportDashboardRead: auditMock,
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

const CARRERA = 3;
const SCOPE = { kind: "carrera", carreraId: CARRERA } as const;

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    periods: ["2026-S2", "2026-S1"],
    periodo: { kind: "code", periodo: "2026-S2" },
    rankings: {
      estudiantes: [
        { id: 1, name: "Ana Lopez", cif: "2021-0042", total: 3 },
        { id: 2, name: "Luis Mora", cif: null, total: 1 },
      ],
      docentes: [{ id: 10, name: "Marta Ruiz", total: 4 }],
      asignaturas: [{ id: 20, codigo: "MAT101", name: "Calculo I", total: 5 }],
    },
    degraded: false,
    ...overrides,
  };
}

const NO_RANKINGS = { estudiantes: [], docentes: [], asignaturas: [] };

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
  Page = (await import("@/app/(dashboard)/reports/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  loadMock.mockReset();
  loadMock.mockResolvedValue(dashboard());
  auditMock.mockReset();
  auditMock.mockResolvedValue(undefined);
});

describe("ReportsPage access (CR-ACC-1, RNF-01)", () => {
  it("renders the dashboard for coordinacion and reads the scope for the session user", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.title,
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

describe("ReportsPage without a career (fail closed)", () => {
  beforeEach(() => {
    scopeMock.mockResolvedValue({ kind: "none" });
  });

  it("shows the alert block and no data, no query and no audit row", async () => {
    await renderPage();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(en.noCareer.title);
    expect(alert).toHaveTextContent(en.noCareer.message);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(loadMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("ReportsPage degraded read (BS-STATE-2)", () => {
  beforeEach(() => {
    loadMock.mockResolvedValue(
      dashboard({
        periods: [],
        periodo: null,
        rankings: NO_RANKINGS,
        degraded: true,
      }),
    );
  });

  it("shows only the degraded status, no figures, and writes no audit row", async () => {
    await renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(en.degraded);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(en.empty)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("ReportsPage without any period (CR-PERIOD-1)", () => {
  beforeEach(() => {
    loadMock.mockResolvedValue(
      dashboard({ periods: [], periodo: null, rankings: NO_RANKINGS }),
    );
  });

  it("shows the empty state and still audits the open with zeros", async () => {
    await renderPage();

    expect(screen.getByText(en.empty)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(7, CARRERA, null, 0, 0, 0);
  });
});

describe("ReportsPage dashboard (CR-DASH-1, CR-RANK-2, CR-RANK-3)", () => {
  it("shows the period filter with the resolved period selected", async () => {
    await renderPage();

    const select = screen.getByRole("combobox", { name: en.period.label });
    expect(select).toHaveTextContent("2026-S2");
    expect(
      screen.getByRole("button", { name: en.period.apply }),
    ).toBeInTheDocument();
  });

  it("shows the three rankings, each in its own card with one h2", async () => {
    await renderPage();

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([en.students.title, en.teachers.title, en.classes.title]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("lists students with their CIF and their request count", async () => {
    await renderPage();

    const rows = within(
      screen.getByRole("list", { name: en.students.title }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Ana Lopez");
    expect(rows[0]).toHaveTextContent("2021-0042");
    expect(rows[0]).toHaveTextContent("3 requests");
    expect(rows[1]).toHaveTextContent("Luis Mora");
    expect(rows[1]).toHaveTextContent("1 request");
    expect(rows[1]).not.toHaveTextContent("1 requests");
  });

  it("lists teachers and subjects by justified classes", async () => {
    await renderPage();

    const teachers = within(
      screen.getByRole("list", { name: en.teachers.title }),
    ).getAllByRole("listitem");
    expect(teachers).toHaveLength(1);
    expect(teachers[0]).toHaveTextContent("Marta Ruiz");
    expect(teachers[0]).toHaveTextContent("4 classes");

    const subjects = within(
      screen.getByRole("list", { name: en.classes.title }),
    ).getAllByRole("listitem");
    expect(subjects).toHaveLength(1);
    expect(subjects[0]).toHaveTextContent("Calculo I");
    expect(subjects[0]).toHaveTextContent("MAT101");
    expect(subjects[0]).toHaveTextContent("5 classes");
  });

  it("keeps the rank order the loader returned", async () => {
    loadMock.mockResolvedValue(
      dashboard({
        rankings: {
          ...NO_RANKINGS,
          estudiantes: [
            { id: 5, name: "Zoe Diaz", cif: "2020-0001", total: 9 },
            { id: 4, name: "Abel Cruz", cif: "2020-0002", total: 9 },
            { id: 3, name: "Bea Mena", cif: "2020-0003", total: 2 },
          ],
        },
      }),
    );

    await renderPage();

    const names = within(screen.getByRole("list", { name: en.students.title }))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(names[0]).toContain("Zoe Diaz");
    expect(names[1]).toContain("Abel Cruz");
    expect(names[2]).toContain("Bea Mena");
  });

  it("says so inside a ranking that has no entries, and only there", async () => {
    loadMock.mockResolvedValue(
      dashboard({ rankings: { ...dashboard().rankings, docentes: [] } }),
    );

    await renderPage();

    expect(screen.getByText(en.teachers.empty)).toBeInTheDocument();
    expect(screen.queryByText(en.students.empty)).toBeNull();
    expect(screen.queryByText(en.classes.empty)).toBeNull();
    expect(screen.queryByRole("list", { name: en.teachers.title })).toBeNull();
  });

  it("shows three empty rankings, not the page empty state, when the period has no counted request", async () => {
    loadMock.mockResolvedValue(dashboard({ rankings: NO_RANKINGS }));

    await renderPage();

    expect(screen.getByText(en.students.empty)).toBeInTheDocument();
    expect(screen.getByText(en.teachers.empty)).toBeInTheDocument();
    expect(screen.getByText(en.classes.empty)).toBeInTheDocument();
    expect(screen.queryByText(en.empty)).toBeNull();
    expect(auditMock).toHaveBeenCalledWith(7, CARRERA, "2026-S2", 0, 0, 0);
  });

  it("links to the detail for the period it shows, and never prefetches it (CR-DASH-1, N2)", async () => {
    await renderPage();

    const link = screen.getByRole("link", { name: en.viewRequests });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(link).toHaveAttribute("href", "/reports/requests?period=2026-S2");
    expect(link).toHaveAttribute("data-prefetch", "false");
  });

  it("carries every period to the detail when every period is shown", async () => {
    loadMock.mockResolvedValue(dashboard({ periodo: { kind: "all" } }));

    await renderPage();

    expect(screen.getByRole("link", { name: en.viewRequests })).toHaveAttribute(
      "href",
      "/reports/requests?period=all",
    );
  });

  it("carries the period of the URL, not the default, to the detail", async () => {
    loadMock.mockResolvedValue(
      dashboard({ periodo: { kind: "code", periodo: "2026-S1" } }),
    );

    await renderPage({ period: "2026-S1" });

    expect(screen.getByRole("link", { name: en.viewRequests })).toHaveAttribute(
      "href",
      "/reports/requests?period=2026-S1",
    );
  });

  it("never shows a cause, a state, a date or a request id", async () => {
    loadMock.mockResolvedValue(
      dashboard({
        rankings: {
          estudiantes: [
            {
              id: 1,
              name: "Ana Lopez",
              cif: "2021-0042",
              total: 3,
              causa: "medica",
              motivo: "Dengue",
              estado: "aprobada",
              solicitudId: 991,
              fecha: new Date("2026-10-08T15:00:00Z"),
            },
          ],
          docentes: [],
          asignaturas: [],
        },
      }),
    );

    await renderPage();

    const text = document.body.textContent ?? "";
    for (const forbidden of [
      /medica/i,
      /medical/i,
      /dengue/i,
      /aprobada/i,
      /991/,
      /2026-10-08/,
      /Oct 8/,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
    expect(text).toContain("Ana Lopez");
  });

  it("renders in Spanish with the Spanish catalog", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.es.reports.title,
    );
    expect(screen.getAllByText("3 solicitudes").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4 clases/).length).toBeGreaterThan(0);
  });
});

describe("ReportsPage period handling (CR-PERIOD-1, CR-6)", () => {
  it.each([
    ["no value", {}, { kind: "latest" }],
    ["an invalid code", { period: "2026-S9" }, { kind: "latest" }],
    [
      "a repeated value",
      { period: ["2026-S1", "2026-S2"] },
      { kind: "latest" },
    ],
    ["all", { period: "all" }, { kind: "all" }],
    ["a code", { period: "2026-S1" }, { kind: "code", periodo: "2026-S1" }],
  ])(
    "asks the loader for the period of %s",
    async (_name, params, expected) => {
      await renderPage(params);

      expect(loadMock).toHaveBeenCalledTimes(1);
      expect(loadMock.mock.calls[0][1]).toEqual(expected);
    },
  );

  it("selects All periods and audits the period as all", async () => {
    loadMock.mockResolvedValue(dashboard({ periodo: { kind: "all" } }));

    await renderPage({ period: "all" });

    expect(screen.getByRole("combobox")).toHaveTextContent(en.period.all);
    expect(auditMock).toHaveBeenCalledWith(7, CARRERA, "all", 2, 1, 1);
  });

  it("selects an absent well-formed code so the select shows what the rankings use", async () => {
    loadMock.mockResolvedValue(
      dashboard({
        periodo: { kind: "code", periodo: "2024-S1" },
        rankings: NO_RANKINGS,
      }),
    );

    await renderPage({ period: "2024-S1" });

    expect(screen.getByRole("combobox")).toHaveTextContent("2024-S1");
  });
});

describe("ReportsPage audited read (CR-AUDIT-1, RF-17 e, RNF-06)", () => {
  it("writes one dashboard row with the code and the counts shown, for the session user and career", async () => {
    await renderPage();

    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(7, CARRERA, "2026-S2", 2, 1, 1);
  });

  it("writes the row after the data load", async () => {
    await renderPage();

    expect(loadMock.mock.invocationCallOrder[0]).toBeLessThan(
      auditMock.mock.invocationCallOrder[0],
    );
  });

  it("writes no row when the load throws", async () => {
    loadMock.mockRejectedValue(new Error("db down"));

    await expect(renderPage()).rejects.toThrow("db down");
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("returns no data when the audit write fails", async () => {
    auditMock.mockRejectedValue(new Error("audit down"));

    await expect(renderPage()).rejects.toThrow("audit down");
    expect(document.body.textContent).not.toContain("Ana Lopez");
  });
});
