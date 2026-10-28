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
  coordinationMock,
  approvedMock,
  queueReadMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  queueMock: vi.fn(),
  coordinationMock: vi.fn(),
  approvedMock: vi.fn(),
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
vi.mock("@/lib/data/revision-queue", () => ({
  listReviewQueue: queueMock,
  listCoordinationQueue: coordinationMock,
  listApprovedRequests: approvedMock,
}));
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
  coordinationMock.mockReset();
  coordinationMock.mockResolvedValue({ rows: [] });
  approvedMock.mockReset();
  approvedMock.mockResolvedValue({ rows: [] });
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
    expect(queueReadMock).toHaveBeenCalledWith(7, 4, 0, "pendiente");
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
    expect(queueReadMock).toHaveBeenCalledWith(7, 4, 2, "pendiente");
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

  it("confirms an escalation to coordination in a status banner", async () => {
    await renderPage({ resultado: "escalada" });

    expect(screen.getByRole("status")).toHaveTextContent(en.result.escalada);
  });

  it("shows the banner above the tabs on a coordination tab too", async () => {
    await renderPage({
      resultado: "escalada",
      estado: "en_revision_coordinacion",
    });

    expect(screen.getByRole("status")).toHaveTextContent(en.result.escalada);
  });

  it("ignores an unknown result value", async () => {
    await renderPage({ resultado: "<b>x</b>" });

    expect(screen.queryByRole("status")).toBeNull();
  });
});

function coordinationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 21,
    estudianteNombre: "Luis Mora",
    estudianteCif: "2022-0100",
    estudianteCarrera: "Ingenieria Civil",
    asignaturas: 2,
    motivo: "sospecha_documento",
    escaladaEn: new Date("2026-10-13T15:00:00Z"),
    notificacionEstado: "pendiente",
    notificacionMotivo: null,
    enviadaEn: null,
    ...overrides,
  };
}

function approvedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 31,
    estudianteNombre: "Rosa Mena",
    estudianteCif: "2020-0007",
    estudianteCarrera: "Arquitectura",
    aprobadaEn: new Date("2026-10-12T15:00:00Z"),
    reportes: 2,
    ...overrides,
  };
}

describe("ReviewQueuePage state tabs (RF-06, RF-10, RF-15, E14)", () => {
  it("defaults to Pendientes and marks it as the current tab", async () => {
    await renderPage();

    const nav = screen.getByRole("navigation", { name: en.tabs.label });
    expect(
      within(nav).getByRole("link", { name: en.tabs.pendiente }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: en.tabs.aprobada }),
    ).not.toHaveAttribute("aria-current");
    expect(queueMock).toHaveBeenCalledTimes(1);
    expect(coordinationMock).not.toHaveBeenCalled();
    expect(approvedMock).not.toHaveBeenCalled();
  });

  it("offers three bookmarkable tab links that opt out of prefetch", async () => {
    await renderPage();

    const nav = screen.getByRole("navigation", { name: en.tabs.label });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/review?estado=pendiente",
      "/review?estado=en_revision_coordinacion",
      "/review?estado=aprobada",
    ]);
    expect(links.map((l) => l.textContent)).toEqual([
      en.tabs.pendiente,
      en.tabs.en_revision_coordinacion,
      en.tabs.aprobada,
    ]);
    for (const link of links) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it.each(["rechazada", "borrador", "x", ""])(
    "falls back to Pendientes for the invalid value %j",
    async (estado) => {
      await renderPage({ estado });

      expect(queueMock).toHaveBeenCalledTimes(1);
      expect(coordinationMock).not.toHaveBeenCalled();
      expect(approvedMock).not.toHaveBeenCalled();
      expect(queueReadMock).toHaveBeenCalledWith(7, 4, 1, "pendiente");
    },
  );

  describe("En coordinacion", () => {
    beforeEach(() => {
      coordinationMock.mockResolvedValue({
        rows: [
          coordinationRow(),
          coordinationRow({
            id: 22,
            estudianteNombre: "Ana Lopez",
            notificacionEstado: "bloqueada",
            notificacionMotivo: "sin_destinatarios",
          }),
          coordinationRow({
            id: 23,
            estudianteNombre: "Pedro Ruiz",
            notificacionEstado: "enviada",
            notificacionMotivo: null,
            enviadaEn: new Date("2026-10-14T15:05:00Z"),
          }),
          coordinationRow({
            id: 24,
            estudianteNombre: "Marta Gomez",
            notificacionMotivo: "error_envio",
          }),
        ],
      });
    });

    it("lists only that tab, in scope, and writes one audit row with the tab code", async () => {
      await renderPage({ estado: "en_revision_coordinacion" });

      expect(coordinationMock).toHaveBeenCalledWith({
        kind: "facultad",
        facultadId: 4,
      });
      expect(queueMock).not.toHaveBeenCalled();
      expect(approvedMock).not.toHaveBeenCalled();
      expect(queueReadMock).toHaveBeenCalledTimes(1);
      expect(queueReadMock).toHaveBeenCalledWith(
        7,
        4,
        4,
        "en_revision_coordinacion",
      );
      expect(
        screen.getByRole("navigation", { name: en.tabs.label }),
      ).toBeInTheDocument();
      expect(
        within(
          screen.getByRole("navigation", { name: en.tabs.label }),
        ).getByRole("link", { name: en.tabs.en_revision_coordinacion }),
      ).toHaveAttribute("aria-current", "page");
    });

    it("shows the reason, the escalation date, the paused deadline and the notification as text", async () => {
      await renderPage({ estado: "en_revision_coordinacion" });

      const table = screen.getByRole("table");
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((h) => h.textContent),
      ).toEqual([
        en.coordination.columns.escalated,
        en.columns.student,
        en.columns.career,
        en.coordination.columns.reason,
        en.coordination.columns.status,
        en.coordination.columns.notice,
        en.columns.action,
      ]);
      const rows = within(table).getAllByRole("row").slice(1);
      expect(rows).toHaveLength(4);
      expect(rows[0]).toHaveTextContent("Oct 13, 2026");
      expect(rows[0]).toHaveTextContent("Luis Mora");
      expect(rows[0]).toHaveTextContent(
        messages.en.review.escalation.reasons.sospecha_documento,
      );
      expect(rows[0]).toHaveTextContent(en.deadline.paused);
      const notice = messages.en.review.escalation.notification;
      expect(rows[0]).toHaveTextContent(notice.pendiente);
      expect(rows[1]).toHaveTextContent(notice.bloqueada);
      expect(rows[2]).toHaveTextContent("Sent on Oct 14, 2026, 9:05 AM");
      expect(rows[3]).toHaveTextContent(notice.pendienteFallido);
    });

    it("marks no alert or overdue state and links each row to its detail without prefetch", async () => {
      await renderPage({ estado: "en_revision_coordinacion" });

      for (const text of [
        en.deadline.onTime,
        en.deadline.dueSoon,
        en.deadline.overdue,
      ]) {
        expect(screen.queryByText(text)).toBeNull();
      }
      expect(screen.queryByText(/^Due /)).toBeNull();
      const card = within(
        screen.getByRole("list", { name: en.coordination.caption }),
      ).getAllByRole("listitem")[0];
      expect(
        within(card).getByRole("link", {
          name: "Review request from Luis Mora",
        }),
      ).toHaveAttribute("href", "/review/21");
      for (const link of screen.getAllByRole("link")) {
        expect(link).toHaveAttribute("data-prefetch", "false");
      }
    });

    it("shows the empty state of the tab and still audits the open with a zero count", async () => {
      coordinationMock.mockResolvedValue({ rows: [] });

      await renderPage({ estado: "en_revision_coordinacion" });

      expect(screen.getByText(en.coordination.empty)).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
      expect(queueReadMock).toHaveBeenCalledWith(
        7,
        4,
        0,
        "en_revision_coordinacion",
      );
    });
  });

  describe("Aprobadas", () => {
    beforeEach(() => {
      approvedMock.mockResolvedValue({
        rows: [approvedRow(), approvedRow({ id: 32, reportes: 0 })],
      });
    });

    it("lists only that tab and writes one audit row with the tab code", async () => {
      await renderPage({ estado: "aprobada" });

      expect(approvedMock).toHaveBeenCalledWith({
        kind: "facultad",
        facultadId: 4,
      });
      expect(queueMock).not.toHaveBeenCalled();
      expect(coordinationMock).not.toHaveBeenCalled();
      expect(queueReadMock).toHaveBeenCalledTimes(1);
      expect(queueReadMock).toHaveBeenCalledWith(7, 4, 2, "aprobada");
    });

    it("shows the approval date and the number of recorded reports, and the latest-50 note", async () => {
      await renderPage({ estado: "aprobada" });

      expect(screen.getByText(en.approved.latest)).toBeInTheDocument();
      const table = screen.getByRole("table");
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((h) => h.textContent),
      ).toEqual([
        en.approved.columns.approved,
        en.columns.student,
        en.columns.career,
        en.approved.columns.reports,
        en.columns.action,
      ]);
      const rows = within(table).getAllByRole("row").slice(1);
      expect(rows[0]).toHaveTextContent("Oct 12, 2026");
      expect(rows[0]).toHaveTextContent("Rosa Mena");
      expect(rows[0]).toHaveTextContent("2 reports");
      expect(rows[1]).toHaveTextContent("No reports");
    });

    it("marks no deadline state on approved requests", async () => {
      await renderPage({ estado: "aprobada" });

      expect(screen.queryByText(en.deadline.overdue)).toBeNull();
      expect(screen.queryByText(en.deadline.dueSoon)).toBeNull();
      expect(screen.queryByText(/^Due /)).toBeNull();
    });

    it("renders the tab in Spanish", async () => {
      state.locale = "es";

      await renderPage({ estado: "aprobada" });

      expect(
        screen.getByText(messages.es.review.queue.approved.latest),
      ).toBeInTheDocument();
      expect(screen.getAllByText("2 reportes").length).toBeGreaterThan(0);
    });
  });

  it.each(["en_revision_coordinacion", "aprobada"])(
    "denies a coordinacion caller the %s tab with no scope read, no rows and no audit row",
    async (estado) => {
      getSessionMock.mockResolvedValue(sessionFor("coordinacion"));

      await expect(renderPage({ estado })).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(coordinationMock).not.toHaveBeenCalled();
      expect(approvedMock).not.toHaveBeenCalled();
      expect(queueReadMock).not.toHaveBeenCalled();
    },
  );

  it.each(["en_revision_coordinacion", "aprobada"])(
    "shows the no-faculty alert and queries nothing on the %s tab without a faculty",
    async (estado) => {
      scopeMock.mockResolvedValue({ kind: "none" });

      await renderPage({ estado });

      expect(screen.getByRole("alert")).toHaveTextContent(en.noFaculty.title);
      expect(coordinationMock).not.toHaveBeenCalled();
      expect(approvedMock).not.toHaveBeenCalled();
      expect(queueReadMock).not.toHaveBeenCalled();
    },
  );

  it("writes no audit row and shows no data when a tab load fails", async () => {
    approvedMock.mockRejectedValue(new Error("db down"));

    await expect(renderPage({ estado: "aprobada" })).rejects.toThrow("db down");
    expect(queueReadMock).not.toHaveBeenCalled();
  });
});
