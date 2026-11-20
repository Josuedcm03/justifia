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

const { redirectMock, getSessionMock, listMock, readMock, state } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    getSessionMock: vi.fn(),
    listMock: vi.fn(),
    readMock: vi.fn(),
    state: { locale: "en" as Locale },
  }),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
// The REAL dal runs on a mocked session source, so the guard order is the
// production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/student-requests", () => ({ listOwnRequests: listMock }));
// Own reads are not audited: the audit writers must never be called.
vi.mock("@/lib/data/request-reads", () => ({
  recordRequestRead: readMock,
  recordQueueRead: readMock,
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    estado: "pendiente",
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    presentadaEn: new Date("2026-10-08T15:00:00Z"),
    reenviadaEn: null,
    asignaturas: [{ codigo: "MAT101", nombre: "Matematica I" }],
    decision: null,
    ...overrides,
  };
}

let Page: () => Promise<React.ReactNode>;

async function renderPage() {
  const ui = await Page();
  return render(
    <NextIntlClientProvider
      locale={state.locale}
      messages={messages[state.locale]}
      timeZone="America/Managua"
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

const en = messages.en.requests;

beforeAll(async () => {
  Page = (await import("@/app/(dashboard)/requests/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("estudiante"));
  listMock.mockReset();
  listMock.mockResolvedValue([row()]);
  readMock.mockReset();
});

describe("OwnRequestsPage access (RNF-01)", () => {
  it("reads the list for the session user, never for an id from the request", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.list.title,
    );
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith(7);
  });

  it.each(rolesUsuario.filter((r) => r !== "estudiante"))(
    "sends %s to /denied and reads nothing",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(listMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("sends a flagged student to the change screen first", async () => {
    getSessionMock.mockResolvedValue(sessionFor("estudiante", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );
    expect(listMock).not.toHaveBeenCalled();
  });

  it("writes no audit row for the student's own read", async () => {
    await renderPage();

    expect(readMock).not.toHaveBeenCalled();
  });
});

describe("OwnRequestsPage list (RF-07 c)", () => {
  it("shows the empty state with a New request link when there are no requests", async () => {
    listMock.mockResolvedValue([]);

    await renderPage();

    expect(screen.getByText(en.list.empty)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    const links = screen.getAllByRole("link", { name: en.list.newRequest });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/requests/new");
    }
  });

  it.each([
    ["en", "Go to my enrollment"],
    ["es", "Ir a mis inscripciones"],
  ] as const)(
    "links the empty state to /enrollment in %s",
    async (locale, name) => {
      state.locale = locale;
      listMock.mockResolvedValue([]);

      await renderPage();

      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        "/enrollment",
      );
    },
  );

  it("shows no enrollment link when the list is shown", async () => {
    await renderPage();

    expect(
      screen.queryByRole("link", { name: "Go to my enrollment" }),
    ).toBeNull();
  });

  it("lists each request with its state, cause, dates and presentation date", async () => {
    await renderPage();

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item).toHaveTextContent(en.states.pendiente);
    expect(item).toHaveTextContent(messages.en.intake.causes.medica);
    expect(item).toHaveTextContent("Oct 5, 2026 to Oct 7, 2026");
    expect(item).toHaveTextContent("Presented Oct 8, 2026");
    expect(item).toHaveTextContent("Request 12");
  });

  it("passes the subjects and the reason of each item through to its own card", async () => {
    listMock.mockResolvedValue([
      row({
        id: 31,
        estado: "devuelta",
        asignaturas: [
          { codigo: "FIS201", nombre: "Fisica II" },
          { codigo: "QUI110", nombre: "Quimica" },
        ],
        decision: { motivoCodigo: "documento_ilegible", texto: "Copia." },
      }),
      row({
        id: 30,
        estado: "rechazada",
        asignaturas: [{ codigo: "BIO100", nombre: "Biologia" }],
        decision: { motivoCodigo: null, texto: "No corresponde." },
      }),
      row({ id: 29, estado: "aprobada", decision: null }),
    ]);

    await renderPage();

    const [returned, rejected, approved] = screen.getAllByRole("listitem");
    expect(returned).toHaveTextContent("Subjects: FIS201, QUI110");
    expect(returned).toHaveTextContent("Reason: The document is not legible");
    expect(rejected).toHaveTextContent("Subjects: BIO100");
    expect(rejected).toHaveTextContent("Reason: No corresponde.");
    expect(approved).toHaveTextContent("Subjects: MAT101");
    expect(approved).not.toHaveTextContent("Reason:");
  });

  it("labels the absence dates of every card", async () => {
    await renderPage();

    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Absence dates: Oct 5, 2026 to Oct 7, 2026",
    );
  });

  it("shows no reason on an approved card even if its item carried one", async () => {
    listMock.mockResolvedValue([
      row({
        estado: "aprobada",
        decision: { motivoCodigo: null, texto: "Su solicitud fue aprobada." },
      }),
    ]);

    await renderPage();

    expect(screen.getByRole("listitem")).not.toHaveTextContent(
      "Su solicitud fue aprobada.",
    );
  });

  it("writes a one-day request as a single date", async () => {
    listMock.mockResolvedValue([row({ fechaFin: "2026-10-05" })]);

    await renderPage();

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Oct 5, 2026");
    expect(item).not.toHaveTextContent("Oct 5, 2026 to");
  });

  it.each([
    ["pendiente", en.states.pendiente],
    ["devuelta", en.states.devuelta],
    ["aprobada", en.states.aprobada],
    ["rechazada", en.states.rechazada],
    ["en_revision_coordinacion", en.states.en_revision_coordinacion],
  ])("labels a %s request as text", async (estado, label) => {
    listMock.mockResolvedValue([row({ estado })]);

    await renderPage();

    expect(screen.getByRole("listitem")).toHaveTextContent(label);
  });

  it("keeps the order the data layer gave (newest first) and links to each detail", async () => {
    listMock.mockResolvedValue([
      row({ id: 30, estado: "devuelta" }),
      row({ id: 21, estado: "aprobada" }),
    ]);

    await renderPage();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Request 30");
    expect(items[1]).toHaveTextContent("Request 21");
    expect(
      within(items[0]).getByRole("link", { name: "View request 30" }),
    ).toHaveAttribute("href", "/requests/30");
    expect(
      within(items[1]).getByRole("link", { name: "View request 21" }),
    ).toHaveAttribute("href", "/requests/21");
  });

  it("never shows a deadline to the student", async () => {
    await renderPage();

    expect(screen.queryByText(/due|overdue|deadline/i)).toBeNull();
  });

  it("reads its text from the Spanish catalog", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.es.requests.list.title,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      messages.es.requests.states.pendiente,
    );
  });
});
