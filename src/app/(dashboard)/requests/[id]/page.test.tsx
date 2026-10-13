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
  notFoundMock,
  getSessionMock,
  detailMock,
  readMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  getSessionMock: vi.fn(),
  detailMock: vi.fn(),
  readMock: vi.fn(),
  state: { locale: "en" as Locale },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/student-requests", () => ({
  getOwnRequestDetail: detailMock,
}));
// Own reads are not audited: the audit writers must never be called.
vi.mock("@/lib/data/request-reads", () => ({
  recordRequestRead: readMock,
  recordQueueRead: readMock,
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

const DECISION = {
  id: 5,
  tipo: "devuelta",
  motivoCodigo: "documento_ilegible",
  texto: "Attach a legible copy of the certificate.",
  decididaEn: new Date("2026-10-09T15:00:00Z"),
};

function detail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    estado: "devuelta",
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    presentadaEn: new Date("2026-10-08T15:00:00Z"),
    reenviadaEn: null,
    clases: [
      {
        asignaturaId: 1,
        codigo: "MAT-101",
        nombre: "Calculo",
        numeroGrupo: "2",
        docenteNombre: "Pedro Ruiz",
      },
      {
        asignaturaId: 2,
        codigo: "FIS-200",
        nombre: "Fisica",
        numeroGrupo: "1",
        docenteNombre: null,
      },
    ],
    documentos: [
      {
        id: 31,
        nombreOriginal: "constancia.pdf",
        tipoDetectado: "application/pdf",
        tamanoBytes: 2048,
        creadoEn: new Date("2026-10-08T14:00:00Z"),
      },
    ],
    decision: DECISION,
    historial: [],
    revisiones: [],
    ...overrides,
  };
}

type Props = { params: Promise<{ id: string }> };
let Page: (props: Props) => Promise<React.ReactNode>;

async function renderPage(id = "12") {
  const ui = await Page({ params: Promise.resolve({ id }) });
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
const section = (name: string) => screen.getByRole("region", { name });
const correctLink = () =>
  screen.queryByRole("link", { name: en.detail.decision.correct });

beforeAll(async () => {
  Page = (await import("@/app/(dashboard)/requests/[id]/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("estudiante"));
  detailMock.mockReset();
  detailMock.mockResolvedValue(detail());
  readMock.mockReset();
});

describe("OwnRequestDetailPage access (RNF-01)", () => {
  it("reads the request by the session user and the id from the path", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Request 12",
    );
    expect(detailMock).toHaveBeenCalledWith(7, 12);
  });

  it.each(rolesUsuario.filter((r) => r !== "estudiante"))(
    "sends %s to /denied and reads nothing",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(detailMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("sends a flagged student to the change screen first", async () => {
    getSessionMock.mockResolvedValue(sessionFor("estudiante", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );
    expect(detailMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-3", "1.5", "12abc", "99999999999999999999"])(
    "answers notFound for the malformed id %s without reading",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NOT_FOUND");

      expect(detailMock).not.toHaveBeenCalled();
    },
  );

  it("answers the same notFound for another student's request, a draft and an unknown id", async () => {
    // The data layer answers null for all three: the page cannot tell them apart.
    detailMock.mockResolvedValue(null);

    await expect(renderPage("12")).rejects.toThrow("NOT_FOUND");
    await expect(renderPage("13")).rejects.toThrow("NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(2);
  });

  it("writes no audit row for the student's own read", async () => {
    await renderPage();

    expect(readMock).not.toHaveBeenCalled();
  });
});

describe("OwnRequestDetailPage content (RF-07 c, RF-08 b)", () => {
  it("shows the state, cause, dates and presentation date", async () => {
    await renderPage();

    const request = section(en.detail.sections.request);
    expect(request).toHaveTextContent(en.states.devuelta);
    expect(request).toHaveTextContent(messages.en.intake.causes.medica);
    expect(request).toHaveTextContent("Oct 5, 2026 to Oct 7, 2026");
    expect(request).toHaveTextContent("Oct 8, 2026");
    expect(
      within(request).queryByText(en.detail.fields.resubmitted),
    ).toBeNull();
  });

  it("shows the resubmission date once the request was resubmitted", async () => {
    detailMock.mockResolvedValue(
      detail({
        estado: "pendiente",
        decision: null,
        reenviadaEn: new Date("2026-10-12T15:00:00Z"),
      }),
    );

    await renderPage();

    const request = section(en.detail.sections.request);
    expect(request).toHaveTextContent(en.detail.fields.resubmitted);
    expect(request).toHaveTextContent("Oct 12, 2026");
  });

  it("lists the subjects with group and teacher, or that there is none", async () => {
    await renderPage();

    const subjects = section(en.detail.sections.subjects);
    expect(subjects).toHaveTextContent("MAT-101 · Calculo");
    expect(subjects).toHaveTextContent("Group 2");
    expect(subjects).toHaveTextContent("Teacher: Pedro Ruiz");
    expect(subjects).toHaveTextContent("FIS-200 · Fisica");
    expect(subjects).toHaveTextContent(en.detail.subject.noTeacher);
  });

  it("links each document to the authenticated route for viewing and downloading", async () => {
    await renderPage();

    const documents = section(en.detail.sections.documents);
    expect(documents).toHaveTextContent("constancia.pdf");
    expect(
      within(documents).getByRole("link", { name: "View constancia.pdf" }),
    ).toHaveAttribute("href", "/api/intake/documents/31?modo=ver");
    expect(
      within(documents).getByRole("link", { name: "Download constancia.pdf" }),
    ).toHaveAttribute("href", "/api/intake/documents/31?modo=descarga");
  });

  it("says so when the request has no documents", async () => {
    detailMock.mockResolvedValue(detail({ documentos: [] }));

    await renderPage();

    expect(section(en.detail.sections.documents)).toHaveTextContent(
      en.detail.documents.empty,
    );
  });

  it("never shows a deadline to the student", async () => {
    await renderPage();

    expect(screen.queryByText(/due|overdue|deadline/i)).toBeNull();
  });
});

describe("OwnRequestDetailPage decision (RF-07 c)", () => {
  it("shows a returned request's reason and text, with the Correct request entry point", async () => {
    await renderPage();

    const decision = section(en.detail.sections.decision);
    expect(decision).toHaveTextContent(
      `Reason: ${en.detail.reasons.documento_ilegible}`,
    );
    expect(decision).toHaveTextContent(DECISION.texto);
    expect(decision).toHaveTextContent("Oct 9, 2026");
    const correct = within(decision).getByRole("link", {
      name: en.detail.decision.correct,
    });
    expect(correct).toHaveAttribute("href", "/requests/12/correct");
  });

  it.each([
    ["aprobada", "Your absence is approved."],
    ["rechazada", "The certificate does not cover the dates."],
  ])(
    "shows the text of a %s request and no Correct request entry point",
    async (estado, texto) => {
      detailMock.mockResolvedValue(
        detail({
          estado,
          decision: { ...DECISION, tipo: estado, motivoCodigo: null, texto },
        }),
      );

      await renderPage();

      const decision = section(en.detail.sections.decision);
      expect(decision).toHaveTextContent(texto);
      expect(decision).not.toHaveTextContent("Reason:");
      expect(correctLink()).toBeNull();
    },
  );

  it("says there is no message when a decision carries no text", async () => {
    detailMock.mockResolvedValue(
      detail({
        estado: "aprobada",
        decision: {
          ...DECISION,
          tipo: "aprobada",
          motivoCodigo: null,
          texto: null,
        },
      }),
    );

    await renderPage();

    expect(section(en.detail.sections.decision)).toHaveTextContent(
      en.detail.decision.noText,
    );
  });

  it.each(["pendiente", "en_revision_coordinacion"])(
    "has no decision section and no Correct request entry point while %s",
    async (estado) => {
      detailMock.mockResolvedValue(detail({ estado, decision: null }));

      await renderPage();

      expect(
        screen.queryByRole("region", { name: en.detail.sections.decision }),
      ).toBeNull();
      expect(correctLink()).toBeNull();
    },
  );
});

describe("OwnRequestDetailPage history (RF-08 b)", () => {
  it("lists earlier decisions and earlier versions of the request", async () => {
    detailMock.mockResolvedValue(
      detail({
        estado: "pendiente",
        decision: null,
        historial: [
          {
            ...DECISION,
            texto: "Please fix the dates.",
            motivoCodigo: "fecha_incorrecta",
          },
        ],
        revisiones: [
          {
            id: 8,
            numero: 1,
            causa: "fuerza_mayor",
            fechaInicio: "2026-10-01",
            fechaFin: "2026-10-02",
            clases: [
              {
                asignaturaId: 1,
                codigo: "MAT-101",
                nombre: "Calculo",
                numeroGrupo: "2",
              },
            ],
            documentoIds: [31, 32],
            creadaEn: new Date("2026-10-09T15:00:00Z"),
          },
        ],
      }),
    );

    await renderPage();

    const history = section(en.detail.sections.history);
    expect(history).toHaveTextContent(en.detail.history.decisions);
    expect(history).toHaveTextContent("Please fix the dates.");
    expect(history).toHaveTextContent(
      `Reason: ${en.detail.reasons.fecha_incorrecta}`,
    );
    expect(history).toHaveTextContent(en.detail.history.revisions);
    expect(history).toHaveTextContent("Version 1");
    expect(history).toHaveTextContent(messages.en.intake.causes.fuerza_mayor);
    expect(history).toHaveTextContent("Oct 1, 2026 to Oct 2, 2026");
    expect(history).toHaveTextContent("MAT-101 (Group 2)");
    expect(history).toHaveTextContent("2 documents");
  });

  it("omits the history section for a request with nothing earlier", async () => {
    await renderPage();

    expect(
      screen.queryByRole("region", { name: en.detail.sections.history }),
    ).toBeNull();
  });

  it("reads its text from the Spanish catalog", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Solicitud 12",
    );
    expect(
      screen.getByRole("link", {
        name: messages.es.requests.detail.decision.correct,
      }),
    ).toHaveAttribute("href", "/requests/12/correct");
  });
});
