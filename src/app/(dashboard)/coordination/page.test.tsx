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

const { redirectMock, getSessionMock, scopeMock, listMock, readMock, state } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    getSessionMock: vi.fn(),
    scopeMock: vi.fn(),
    listMock: vi.fn(),
    readMock: vi.fn(),
    state: { locale: "en" as Locale },
  }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
// The REAL dal runs on a mocked session source, so the guard order is the
// production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/coordination-scope", () => ({
  resolveCoordinationScope: scopeMock,
}));
vi.mock("@/lib/data/coordination-queue", () => ({
  listCoordinationEscalations: listMock,
}));
vi.mock("@/lib/data/request-reads", () => ({
  recordEscalationQueueRead: readMock,
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

const ESCALATED = new Date("2026-10-14T15:00:00.000Z");

function open(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 9,
    estudianteNombre: "Ana Lopez",
    estudianteCif: "2020-0001",
    motivo: "sospecha_documento",
    creadoEn: ESCALATED,
    ...overrides,
  };
}

function notice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    estudianteNombre: "Luis Mora",
    estudianteCif: "2021-0042",
    docenteNombre: "Marta Ruiz",
    comunicadoEl: "2026-10-13",
    creadoEn: ESCALATED,
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

const en = messages.en.coordination.list;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/coordination/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue({ kind: "carrera", carreraId: 4 });
  listMock.mockReset();
  listMock.mockResolvedValue({ open: [open()], notices: [notice()] });
  readMock.mockReset();
  readMock.mockResolvedValue(undefined);
});

describe("CoordinationListPage access (RNF-01, ES-9)", () => {
  it("renders the list for a coordinacion and reads the scope for the session user", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.title,
    );
    expect(scopeMock).toHaveBeenCalledWith(7, "coordinacion");
    expect(listMock).toHaveBeenCalledWith({ kind: "carrera", carreraId: 4 });
  });

  it.each(rolesUsuario.filter((r) => r !== "coordinacion"))(
    "sends %s to /denied with no scope read, no data and no audit row",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(listMock).not.toHaveBeenCalled();
      expect(readMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("sends a session that must change the password to the change screen", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );
    expect(listMock).not.toHaveBeenCalled();
  });

  it("denies a coordinacion without a career, or an inactive one: a neutral alert, no rows, no data read, no audit row", async () => {
    // The scope is `none` for both, so the text must be true for both.
    scopeMock.mockResolvedValue({ kind: "none" });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(en.noAccess.title);
    expect(screen.getByRole("alert")).toHaveTextContent(en.noAccess.message);
    expect(en.noAccess.message).toMatch(/not active/);
    expect(en.noAccess.message).toMatch(/no career/);
    expect(listMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Ana Lopez")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("CoordinationListPage content (E1, E10)", () => {
  it("lists the open escalations with student, CIF, reason and escalation date, and a link by escalation id", async () => {
    await renderPage();

    const section = screen.getByRole("region", { name: en.open.title });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("Ana Lopez")).toBeInTheDocument();
    expect(within(items[0]).getByText("2020-0001")).toBeInTheDocument();
    expect(
      within(items[0]).getByText(
        messages.en.review.escalation.reasons.sospecha_documento,
        { exact: false },
      ),
    ).toBeInTheDocument();
    expect(within(items[0]).getByText(/Oct 14, 2026/)).toBeInTheDocument();
    const link = within(items[0]).getByRole("link", {
      name: en.open.attendNamed.replace("{name}", "Ana Lopez"),
    });
    expect(link).toHaveAttribute("href", "/coordination/9");
    expect(link).toHaveAttribute("data-prefetch", "false");
  });

  it("lists the notices apart, with the teacher and the communicated date, and a link that never prefetches", async () => {
    await renderPage();

    const section = screen.getByRole("region", { name: en.notices.title });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("Luis Mora")).toBeInTheDocument();
    expect(within(items[0]).getByText(/Marta Ruiz/)).toBeInTheDocument();
    expect(within(items[0]).getByText(/Oct 13, 2026/)).toBeInTheDocument();
    const link = within(items[0]).getByRole("link", {
      name: en.notices.viewNamed.replace("{name}", "Luis Mora"),
    });
    expect(link).toHaveAttribute("href", "/coordination/12");
    expect(link).toHaveAttribute("data-prefetch", "false");
    // A notice offers no action to answer.
    expect(within(items[0]).queryByRole("link", { name: /Handle/ })).toBeNull();
  });

  it("keeps the order the data layer delivers (oldest escalation first, newest notice first)", async () => {
    listMock.mockResolvedValue({
      open: [
        open({ id: 1, estudianteNombre: "Primera" }),
        open({ id: 2, estudianteNombre: "Segunda" }),
      ],
      notices: [
        notice({ id: 4, estudianteNombre: "Nueva" }),
        notice({ id: 3, estudianteNombre: "Vieja" }),
      ],
    });

    await renderPage();

    const names = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");
    expect(names[0]).toContain("Primera");
    expect(names[1]).toContain("Segunda");
    expect(names[2]).toContain("Nueva");
    expect(names[3]).toContain("Vieja");
  });

  it("shows an empty text for each part when there is nothing", async () => {
    listMock.mockResolvedValue({ open: [], notices: [] });

    await renderPage();

    expect(screen.getByText(en.open.empty)).toBeInTheDocument();
    expect(screen.getByText(en.notices.empty)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("falls back to a neutral label for a student without a name", async () => {
    listMock.mockResolvedValue({
      open: [open({ estudianteNombre: null })],
      notices: [],
    });

    await renderPage();

    expect(screen.getByText(en.unnamed)).toBeInTheDocument();
  });

  it("shows no cause, dates, note, email or notification state of any request", async () => {
    await renderPage();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/@|Sending|pending send|blocked|salud/i);
  });

  it("shows the answered banner after an answer and ignores any other result", async () => {
    await renderPage({ resultado: "respondida" });
    expect(screen.getByRole("status")).toHaveTextContent(en.result.respondida);
  });

  it.each(["aprobada", "escalada", "x", ["respondida", "x"]])(
    "shows no banner for the result %j",
    async (resultado) => {
      await renderPage({ resultado });

      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  it("renders in neutral Spanish", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.es.coordination.list.title,
    );
  });
});

describe("CoordinationListPage audited read (RNF-06, SR-11)", () => {
  it("writes exactly one escalamiento.cola.consultada row per render, with the career and the count", async () => {
    await renderPage();

    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith(7, 4, 2);
  });

  it("counts only what was listed, notices included", async () => {
    listMock.mockResolvedValue({
      open: [],
      notices: [notice(), notice({ id: 13 })],
    });

    await renderPage();

    expect(readMock).toHaveBeenCalledWith(7, 4, 2);
  });

  it("writes the row after the data loaded, never before", async () => {
    await renderPage();

    expect(listMock.mock.invocationCallOrder[0]).toBeLessThan(
      readMock.mock.invocationCallOrder[0],
    );
  });

  it("returns no data when the audit insert fails", async () => {
    readMock.mockRejectedValue(new Error("audit down"));

    await expect(renderPage()).rejects.toThrow("audit down");
  });
});
