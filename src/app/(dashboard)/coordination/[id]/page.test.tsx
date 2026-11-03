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
  scopeMock,
  detailMock,
  readMock,
  signalsMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  detailMock: vi.fn(),
  readMock: vi.fn(),
  signalsMock: vi.fn(),
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
vi.mock("@/lib/data/coordination-scope", () => ({
  resolveCoordinationScope: scopeMock,
}));
vi.mock("@/lib/data/coordination-queue", () => ({
  getCoordinationDetail: detailMock,
}));
vi.mock("@/lib/data/request-reads", () => ({ recordRequestRead: readMock }));
vi.mock("@/lib/data/signals", () => ({ loadSignals: signalsMock }));
vi.mock("@/app/(dashboard)/coordination/[id]/actions", () => ({
  answerEscalationAction: vi.fn(),
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

const CLASS = {
  asignaturaId: 1,
  codigo: "MAT-101",
  nombre: "Calculo",
  numeroGrupo: "2",
  docenteNombre: "Pedro Ruiz",
};

function escalation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: "escalation",
    id: 9,
    solicitudId: 41,
    estado: "en_revision_coordinacion",
    motivo: "sospecha_documento",
    nota: "La firma del medico no coincide con el sello.",
    creadoEn: new Date("2026-10-14T15:00:00.000Z"),
    estudiante: {
      nombre: "Ana Lopez",
      cif: "2021-0042",
      carrera: "Ingenieria de Sistemas",
    },
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    clases: [CLASS],
    documentos: [
      {
        id: 31,
        nombreOriginal: "constancia.pdf",
        tipoDetectado: "application/pdf",
        tamanoBytes: 2048,
        creadoEn: new Date("2026-10-08T14:00:00Z"),
      },
    ],
    ...overrides,
  };
}

function notice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: "notice",
    id: 12,
    solicitudId: 41,
    estado: "aprobada",
    creadoEn: new Date("2026-10-14T15:00:00.000Z"),
    estudiante: {
      nombre: "Ana Lopez",
      cif: "2021-0042",
      carrera: "Ingenieria de Sistemas",
    },
    docenteNombre: "Marta Ruiz",
    comunicadoEl: "2026-10-13",
    nota: "Supera el limite de faltas.",
    ...overrides,
  };
}

// What the loader hands the page: the full report, evidence included. The page
// must project it before rendering, so none of these values may reach the DOM.
const SIGNAL_REPORT = {
  verdict: "review_carefully",
  results: [
    {
      signal: "rn07",
      outcome: "present",
      evidence: {
        kind: "timing",
        presented: "2026-10-14",
        deadline: "2026-10-13",
      },
    },
    {
      signal: "rn09",
      outcome: "absent",
      evidence: {
        kind: "incoherent",
        documents: [
          { documentId: 31, issueDate: "2026-10-09", restTo: "2026-10-12" },
        ],
      },
    },
    { signal: "rn10", outcome: "not_evaluable", reason: "extraction_pending" },
    {
      signal: "rn14",
      outcome: "not_evaluable",
      reason: "no_period",
    },
    {
      signal: "rn26",
      outcome: "present",
      evidence: { kind: "repeated", references: [58] },
    },
  ],
  notEvaluable: [
    { signal: "rn10", reason: "extraction_pending" },
    { signal: "rn14", reason: "no_period" },
  ],
};

let Page: (props: {
  params: Promise<{ id: string }>;
}) => Promise<React.ReactNode>;

async function renderPage(id = "9") {
  const ui = await Page({ params: Promise.resolve({ id }) });
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

const en = messages.en.coordination.detail;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/coordination/[id]/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue({ kind: "carrera", carreraId: 4 });
  detailMock.mockReset();
  detailMock.mockResolvedValue(escalation());
  readMock.mockReset();
  readMock.mockResolvedValue(undefined);
  signalsMock.mockReset();
  signalsMock.mockResolvedValue({ data: SIGNAL_REPORT, degraded: false });
});

describe("CoordinationDetailPage access (RNF-01, ES-9)", () => {
  it("reads the scope for the session user and the detail by escalation id", async () => {
    await renderPage("9");

    expect(scopeMock).toHaveBeenCalledWith(7, "coordinacion");
    expect(detailMock).toHaveBeenCalledWith(
      { kind: "carrera", carreraId: 4 },
      9,
    );
  });

  it.each(rolesUsuario.filter((r) => r !== "coordinacion"))(
    "sends %s to /denied with no scope read, no data and no audit row",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(detailMock).not.toHaveBeenCalled();
      expect(readMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and a flagged session to the change screen", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    getSessionMock.mockResolvedValue(sessionFor("coordinacion", true));
    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );
    expect(detailMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-3", "1.5", "9007199254740993", ""])(
    "answers notFound for the malformed id %j before any read",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NOT_FOUND");

      expect(scopeMock).not.toHaveBeenCalled();
      expect(detailMock).not.toHaveBeenCalled();
      expect(readMock).not.toHaveBeenCalled();
    },
  );

  it("answers notFound, with no data read and no audit row, for a coordinacion without a career", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");

    expect(detailMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();
  });

  it("answers notFound with no audit row when the data layer finds nothing (another career, answered, a draft, unknown)", async () => {
    detailMock.mockResolvedValue(null);

    await expect(renderPage("404")).rejects.toThrow("NOT_FOUND");

    expect(readMock).not.toHaveBeenCalled();
  });

  it("answers notFound for a record of a draft request even if the data layer returned it", async () => {
    detailMock.mockResolvedValue(escalation({ estado: "borrador" }));

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
    expect(readMock).not.toHaveBeenCalled();
  });
});

describe("CoordinationDetailPage: a special case (E18)", () => {
  it("shows the special-case reason label and the answer form, like a suspicion", async () => {
    detailMock.mockResolvedValue(escalation({ motivo: "caso_especial" }));

    await renderPage();

    const escalated = screen.getByRole("region", {
      name: en.sections.escalation,
    });
    expect(
      within(escalated).getByText(
        messages.en.review.escalation.reasons.caso_especial,
      ),
    ).toBeInTheDocument();
    expect(
      within(escalated).getByText(
        "La firma del medico no coincide con el sello.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: en.sections.answer }),
    ).toBeInTheDocument();
  });
});

describe("CoordinationDetailPage: an open escalation (E1, E3, RNF-02)", () => {
  it("shows the student, the cause, the dates, the reason, the note and the time", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Request of Ana Lopez",
    );
    const student = screen.getByRole("region", {
      name: en.sections.student,
    });
    expect(within(student).getByText("Ana Lopez")).toBeInTheDocument();
    expect(within(student).getByText("2021-0042")).toBeInTheDocument();
    expect(
      within(student).getByText("Ingenieria de Sistemas"),
    ).toBeInTheDocument();

    const request = screen.getByRole("region", { name: en.sections.request });
    expect(
      within(request).getByText(messages.en.intake.causes.medica),
    ).toBeInTheDocument();
    expect(within(request).getByText(/Oct 5, 2026/)).toBeInTheDocument();

    const escalated = screen.getByRole("region", {
      name: en.sections.escalation,
    });
    expect(
      within(escalated).getByText(
        messages.en.review.escalation.reasons.sospecha_documento,
      ),
    ).toBeInTheDocument();
    expect(
      within(escalated).getByText(
        "La firma del medico no coincide con el sello.",
      ),
    ).toBeInTheDocument();
    expect(
      within(escalated).getByText(/Oct 14, 2026, 9:00 AM/),
    ).toBeInTheDocument();
  });

  it("shows the subjects with group and teacher", async () => {
    await renderPage();

    expect(screen.getByText(/MAT-101/)).toBeInTheDocument();
    expect(screen.getByText(/Pedro Ruiz/)).toBeInTheDocument();
  });

  it("links each document through the authenticated route, to open in a new tab", async () => {
    await renderPage();

    const view = screen.getByRole("link", { name: /View.*constancia\.pdf/ });
    expect(view).toHaveAttribute("href", "/api/intake/documents/31?modo=ver");
    expect(view).toHaveAttribute("target", "_blank");
    expect(view).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("offers the answer form and nothing to approve, reject, return or escalate", async () => {
    await renderPage();

    expect(
      screen.getByRole("button", {
        name: messages.en.coordination.answer.dialog.trigger,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve|reject/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /escalat/i })).toBeNull();
  });

  it("never shows the student email, the consent or a decision history", async () => {
    await renderPage();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/@|Consent|Email|History|decision/i);
  });

  it("links back to the list without prefetching it", async () => {
    await renderPage();

    const back = screen.getByRole("link", { name: en.back });
    expect(back).toHaveAttribute("href", "/coordination");
    expect(back).toHaveAttribute("data-prefetch", "false");
  });

  it("renders in neutral Spanish", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Solicitud de Ana Lopez",
    );
  });
});

describe("CoordinationDetailPage: a notice (E10)", () => {
  beforeEach(() => detailMock.mockResolvedValue(notice()));

  it("shows the student, the teacher, the communicated date and the note", async () => {
    await renderPage("12");

    const section = screen.getByRole("region", { name: en.sections.notice });
    expect(within(section).getByText("Marta Ruiz")).toBeInTheDocument();
    expect(within(section).getByText(/Oct 13, 2026/)).toBeInTheDocument();
    expect(
      within(section).getByText("Supera el limite de faltas."),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: en.sections.student }),
      ).getByText("2021-0042"),
    ).toBeInTheDocument();
  });

  it("shows a no-note text when the report has no note", async () => {
    detailMock.mockResolvedValue(notice({ nota: null }));

    await renderPage("12");

    expect(screen.getByText(en.noNote)).toBeInTheDocument();
  });

  it("has no documents, cause, dates, subjects or answer form", async () => {
    await renderPage("12");

    expect(
      screen.queryByRole("region", { name: en.sections.request }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: en.sections.answer }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", {
        name: messages.en.review.detail.sections.documents,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", {
        name: messages.en.review.detail.sections.subjects,
      }),
    ).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /View/ })).toBeNull();
  });

  it("explains that no answer is needed", async () => {
    await renderPage("12");

    expect(screen.getByText(en.noticeDescription)).toBeInTheDocument();
  });
});

describe("CoordinationDetailPage audited read (RNF-06, SR-11)", () => {
  it("writes exactly one solicitud.consultada row with the coordinator as actor and the request state", async () => {
    await renderPage();

    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith(7, 41, "en_revision_coordinacion");
  });

  it("writes the row of a notice with the state of its request", async () => {
    detailMock.mockResolvedValue(notice());

    await renderPage("12");

    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith(7, 41, "aprobada");
  });

  it("writes the row after the data loaded, never before", async () => {
    await renderPage();

    expect(detailMock.mock.invocationCallOrder[0]).toBeLessThan(
      readMock.mock.invocationCallOrder[0],
    );
  });

  it("returns no data when the audit insert fails", async () => {
    readMock.mockRejectedValue(new Error("audit down"));

    await expect(renderPage()).rejects.toThrow("audit down");
  });
});

describe("CoordinationDetailPage validation signals (RF-05, RN-15, RN-26, RNF-01)", () => {
  const sig = messages.en.review.signals;
  const signalsRegion = () => screen.getByRole("region", { name: sig.title });
  const noSignals = () =>
    expect(
      screen.queryByRole("region", { name: sig.title }),
    ).not.toBeInTheDocument();

  it("loads the signals of an open escalation by its request, with no reference scope, before the audited read", async () => {
    await renderPage();

    expect(signalsMock).toHaveBeenCalledTimes(1);
    expect(signalsMock).toHaveBeenCalledWith({
      solicitudId: 41,
      referenceScope: { kind: "none" },
    });
    expect(signalsMock.mock.invocationCallOrder[0]).toBeLessThan(
      readMock.mock.invocationCallOrder[0],
    );
  });

  it("renders the section after the documents and before the answer form", async () => {
    await renderPage();

    const documents = screen.getByRole("region", {
      name: messages.en.review.detail.sections.documents,
    });
    const answer = screen.getByRole("region", { name: en.sections.answer });
    expect(
      documents.compareDocumentPosition(signalsRegion()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      signalsRegion().compareDocumentPosition(answer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the verdict, each outcome in words and the reason labels, from the projection (Outcomes and labels only)", async () => {
    await renderPage();

    const region = signalsRegion();
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Suggestion: Review carefully",
    );
    for (const [signal, outcome] of [
      ["rn07", "present"],
      ["rn09", "absent"],
      ["rn26", "present"],
    ] as const) {
      const term = within(region).getByText(sig.names[signal], {
        selector: "dt",
      });
      expect(term.nextElementSibling).toHaveTextContent(sig.outcomes[outcome]);
    }
    expect(region).toHaveTextContent(sig.reasons.extraction_pending);
    expect(region).toHaveTextContent(sig.reasons.no_period);
    expect(region).toHaveTextContent(sig.coordinationNote);
  });

  it("shows no extracted value, date, count or document id of the report (Verdict shown, no extracted values)", async () => {
    await renderPage();

    const text = signalsRegion().textContent ?? "";
    expect(text).not.toMatch(/Oct|2026|Presented|deadline|threshold/i);
    expect(text).not.toMatch(/issued|rest ends|Absence|31/);
  });

  it("shows RN-26 as present with no number, count or link, whether the match is in the career or not (RN-26 match never gives a reference)", async () => {
    await renderPage();

    const region = signalsRegion();
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
    expect(region).not.toHaveTextContent(/58|Request \d|earlier request/);
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
  });

  it("leaves the answer form and the escalation unchanged with RN-26 present (Answer unaffected)", async () => {
    await renderPage();

    expect(
      screen.getByRole("button", {
        name: messages.en.coordination.answer.dialog.trigger,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: en.sections.answer }),
    ).toBeInTheDocument();
  });

  it("renders the rest, the answer form and the degraded notice when the read is degraded (Read failure)", async () => {
    signalsMock.mockResolvedValue({ data: null, degraded: true });

    await renderPage();

    expect(within(signalsRegion()).getByText(sig.degraded)).toBeInTheDocument();
    expect(signalsRegion()).not.toHaveTextContent("Suggestion");
    expect(
      screen.getByRole("region", { name: en.sections.student }),
    ).toHaveTextContent("Ana Lopez");
    expect(
      screen.getByRole("region", { name: en.sections.answer }),
    ).toBeInTheDocument();
    expect(readMock).toHaveBeenCalledTimes(1);
  });

  it("renders the rest, the answer form and the degraded notice when the read throws, logging the error name only", async () => {
    signalsMock.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await renderPage();

    expect(within(signalsRegion()).getByText(sig.degraded)).toBeInTheDocument();
    expect(signalsRegion()).not.toHaveTextContent("connection lost");
    expect(
      screen.getByRole("region", { name: en.sections.answer }),
    ).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith("signals_read_failed", {
      solicitudId: 41,
      code: "Error",
    });
    vi.restoreAllMocks();
  });

  it("neither loads nor renders the section on a notice (Notices and the list carry none)", async () => {
    detailMock.mockResolvedValue(notice());

    await renderPage("12");

    expect(signalsMock).not.toHaveBeenCalled();
    noSignals();
    expect(document.body.textContent).not.toMatch(/Suggestion/);
  });

  it.each([
    ["another career, an answered suspicion or an unknown id", null],
    ["a draft", escalation({ estado: "borrador" })],
  ])(
    "answers notFound and never calls the loader for %s (Other careers and ids)",
    async (_label, found) => {
      detailMock.mockResolvedValue(found);

      await expect(renderPage("404")).rejects.toThrow("NOT_FOUND");

      expect(signalsMock).not.toHaveBeenCalled();
      expect(readMock).not.toHaveBeenCalled();
    },
  );

  it("never calls the loader for a coordinator without a career, a malformed id or another role", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });
    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
    scopeMock.mockResolvedValue({ kind: "carrera", carreraId: 4 });
    await expect(renderPage("abc")).rejects.toThrow("NOT_FOUND");
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${ACCESS_DENIED_PATH}`,
    );

    expect(signalsMock).not.toHaveBeenCalled();
  });

  it("adds no audit row: the only read is the existing one (No audit row)", async () => {
    await renderPage();

    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith(7, 41, "en_revision_coordinacion");
  });

  it("renders in neutral Spanish with the coordination note", async () => {
    state.locale = "es";

    await renderPage();

    const region = screen.getByRole("region", {
      name: messages.es.review.signals.title,
    });
    expect(region).toHaveTextContent("Sugerencia: Revisar con cuidado");
    expect(region).toHaveTextContent(
      messages.es.review.signals.coordinationNote,
    );
  });

  it("decides access through the shared helper and projects before rendering", async () => {
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(
      "src/app/(dashboard)/coordination/[id]/page.tsx",
      "utf8",
    );

    expect(text).toContain("signalsAccess(");
    expect(text).toContain("toCoordinationView(");
    expect(text).not.toMatch(/\.rol\s*[!=]==?|rolesUsuario|isCoordinacion/);
  });
});
