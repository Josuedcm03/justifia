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

const {
  redirectMock,
  getSessionMock,
  scopeMock,
  queueMock,
  queueReadMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  queueMock: vi.fn(),
  queueReadMock: vi.fn(),
  state: { locale: "en" as Locale },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
// The REAL dal runs on a mocked session source, so the guard order is the
// production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/revision-queue", () => ({ listReviewQueue: queueMock }));
vi.mock("@/lib/data/request-reads", () => ({
  recordQueueRead: queueReadMock,
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    estudianteNombre: "Ana Lopez",
    estudianteCif: "2021-0042",
    estudianteCarrera: "Ingenieria de Sistemas",
    asignaturas: 3,
    clockStart: new Date("2026-10-08T15:00:00Z"),
    reenviada: false,
    deadline: "2026-10-12",
    status: "en_plazo",
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

const en = messages.en.review.queue;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/review/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue({ kind: "facultad", facultadId: 4 });
  queueMock.mockReset();
  queueMock.mockResolvedValue({ rows: [row()], calendarLoaded: true });
  queueReadMock.mockReset();
  queueReadMock.mockResolvedValue(undefined);
});

describe("ReviewQueuePage access (RNF-01)", () => {
  it("renders the queue for secretaria and reads the scope for the session user", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.title,
    );
    expect(scopeMock).toHaveBeenCalledWith(7, "secretaria");
    expect(queueMock).toHaveBeenCalledTimes(1);
  });

  it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
    "sends %s to /denied with no scope read, no data and no audit row",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(queueMock).not.toHaveBeenCalled();
      expect(queueReadMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
    expect(queueMock).not.toHaveBeenCalled();
  });

  it("sends a flagged secretaria to the change screen first", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );
    expect(queueMock).not.toHaveBeenCalled();
  });
});

describe("ReviewQueuePage without a faculty (fail closed)", () => {
  beforeEach(() => {
    scopeMock.mockResolvedValue({ kind: "none" });
  });

  it("shows the alert banner and no data, no query and no audit row", async () => {
    await renderPage();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(en.noFaculty.title);
    expect(alert).toHaveTextContent(en.noFaculty.message);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Ana Lopez")).toBeNull();
    expect(queueMock).not.toHaveBeenCalled();
    expect(queueReadMock).not.toHaveBeenCalled();
  });
});

describe("ReviewQueuePage list (RF-06)", () => {
  it("shows the empty state, and still audits the open with a zero count", async () => {
    queueMock.mockResolvedValue({ rows: [], calendarLoaded: true });

    await renderPage();

    expect(screen.getByText(en.empty)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(queueReadMock).toHaveBeenCalledWith(7, 4, 0);
  });

  it("lists start date, student, CIF, career and subject count per row", async () => {
    queueMock.mockResolvedValue({
      rows: [
        row(),
        row({
          id: 13,
          estudianteNombre: "Luis Mora",
          estudianteCif: "2022-0100",
          estudianteCarrera: "Derecho",
          asignaturas: 1,
        }),
      ],
      calendarLoaded: true,
    });

    await renderPage();

    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      en.columns.received,
      en.columns.student,
      en.columns.career,
      en.columns.subjects,
      en.columns.deadline,
      en.columns.action,
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Oct 8, 2026");
    expect(rows[0]).toHaveTextContent("Ana Lopez");
    expect(rows[0]).toHaveTextContent("2021-0042");
    expect(rows[0]).toHaveTextContent("Ingenieria de Sistemas");
    expect(rows[0]).toHaveTextContent("3 subjects");
    expect(rows[1]).toHaveTextContent("Luis Mora");
    expect(rows[1]).toHaveTextContent("1 subject");
    expect(rows[1]).not.toHaveTextContent("1 subjects");
  });

  it("repeats every row as a stacked card for narrow screens", async () => {
    await renderPage();

    const list = screen.getByRole("list", { name: en.caption });
    const card = within(list).getAllByRole("listitem")[0];
    expect(card).toHaveTextContent("Ana Lopez");
    expect(card).toHaveTextContent("2021-0042");
    expect(card).toHaveTextContent(en.deadline.onTime);
    expect(
      within(card).getByRole("link", { name: "Review request from Ana Lopez" }),
    ).toHaveAttribute("href", "/review/12");
  });

  it("marks a resubmitted request as such", async () => {
    queueMock.mockResolvedValue({
      rows: [row({ reenviada: true })],
      calendarLoaded: true,
    });

    await renderPage();

    expect(
      within(screen.getByRole("table")).getByText(en.resubmitted),
    ).toBeInTheDocument();
    expect(screen.getAllByText(en.resubmitted)).toHaveLength(2);
  });

  it("falls back to a label when the snapshot name is missing", async () => {
    queueMock.mockResolvedValue({
      rows: [row({ estudianteNombre: null, estudianteCif: null })],
      calendarLoaded: true,
    });

    await renderPage();

    expect(
      within(screen.getByRole("table")).getByText(en.unnamed),
    ).toBeInTheDocument();
  });

  it("never shows the absence cause (health data)", async () => {
    queueMock.mockResolvedValue({
      rows: [row({ causa: "medica", motivo: "Dengue" })],
      calendarLoaded: true,
    });

    await renderPage();

    expect(screen.queryByText(/medica/i)).toBeNull();
    expect(screen.queryByText(/dengue/i)).toBeNull();
    expect(screen.queryByText(/medical/i)).toBeNull();
  });

  it("renders in Spanish with the Spanish catalog", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.es.review.queue.title,
    );
    expect(screen.getAllByText("3 asignaturas").length).toBeGreaterThan(0);
  });
});

describe("ReviewQueuePage deadline badges (RN-08, RF-06 b)", () => {
  it.each([
    ["en_plazo", en.deadline.onTime],
    ["por_vencer", en.deadline.dueSoon],
    ["vencida", en.deadline.overdue],
  ] as const)("always writes the %s state as text", async (status, label) => {
    queueMock.mockResolvedValue({
      rows: [row({ status })],
      calendarLoaded: true,
    });

    await renderPage();

    const cell = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(cell).toHaveTextContent(label);
    for (const other of [
      en.deadline.onTime,
      en.deadline.dueSoon,
      en.deadline.overdue,
    ].filter((text) => text !== label)) {
      expect(cell).not.toHaveTextContent(other);
    }
  });

  it("names the deadline date next to the badge", async () => {
    await renderPage();

    expect(
      within(screen.getByRole("table")).getAllByRole("row")[1],
    ).toHaveTextContent("Due Oct 12, 2026");
  });

  it("notes that the calendar is not loaded, muted, and only then", async () => {
    queueMock.mockResolvedValue({ rows: [row()], calendarLoaded: false });
    const { unmount } = await renderPage();
    expect(screen.getByText(en.calendarNotLoaded)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();

    queueMock.mockResolvedValue({ rows: [row()], calendarLoaded: true });
    await renderPage();
    expect(screen.queryByText(en.calendarNotLoaded)).toBeNull();
  });
});

describe("ReviewQueuePage audited read (SR-11)", () => {
  it("writes one queue-read row with the count, for the session user and scope", async () => {
    queueMock.mockResolvedValue({
      rows: [row(), row({ id: 13 })],
      calendarLoaded: true,
    });

    await renderPage();

    expect(queueReadMock).toHaveBeenCalledTimes(1);
    expect(queueReadMock).toHaveBeenCalledWith(7, 4, 2);
  });

  it("writes no row when the data load fails", async () => {
    queueMock.mockRejectedValue(new Error("db down"));

    await expect(renderPage()).rejects.toThrow("db down");
    expect(queueReadMock).not.toHaveBeenCalled();
  });

  it("shows no data when the audit write fails", async () => {
    queueReadMock.mockRejectedValue(new Error("audit down"));

    await expect(renderPage()).rejects.toThrow("audit down");
  });

  it("opts every review link out of prefetch", async () => {
    await renderPage();

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });
});

describe("ReviewQueuePage decision result banner", () => {
  it.each(["aprobada", "rechazada", "devuelta"] as const)(
    "confirms a %s decision in a status banner",
    async (resultado) => {
      await renderPage({ resultado });

      expect(screen.getByRole("status")).toHaveTextContent(
        en.result[resultado],
      );
    },
  );

  it("ignores an unknown result value", async () => {
    await renderPage({ resultado: "<b>x</b>" });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
