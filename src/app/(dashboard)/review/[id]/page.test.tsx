import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  remissionsMock,
  accountsMock,
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
  remissionsMock: vi.fn(),
  accountsMock: vi.fn(),
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
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/solicitud-detail", () => ({
  getRequestDetail: detailMock,
}));
vi.mock("@/lib/data/request-reads", () => ({ recordRequestRead: readMock }));
vi.mock("@/lib/data/remision", () => ({ listRemissions: remissionsMock }));
vi.mock("@/lib/data/solicitud-escalation", () => ({
  coordinationAccountsOf: accountsMock,
}));
vi.mock("@/app/(dashboard)/review/[id]/escalation-actions", () => ({
  escalateRequestAction: vi.fn(),
  recordExcessReportAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/review/[id]/remission-actions", () => ({
  resendRemissionAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/review/[id]/actions", () => ({
  decideAction: vi.fn(),
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

function detail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    estado: "pendiente",
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    presentadaEn: new Date("2026-10-08T15:00:00Z"),
    reenviadaEn: null,
    plazoInicioEn: null,
    estudiante: {
      nombre: "Ana Lopez",
      cif: "2021-0042",
      carrera: "Ingenieria de Sistemas",
      correo: "ana@uam.edu.ni",
    },
    // 14:05 on 8 October 2026 in America/Managua.
    consentimiento: {
      version: "2026-10-20",
      en: new Date("2026-10-08T20:05:00Z"),
    },
    clases: [
      CLASS,
      {
        ...CLASS,
        asignaturaId: 2,
        codigo: "FIS-200",
        nombre: "Fisica",
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
    documentosRetirados: [],
    formatoEspecial: false,
    formato: null,
    decisiones: [],
    revisiones: [],
    escalamientos: [],
    reportes: [],
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

const en = messages.en.review.detail;
const dec = messages.en.review.decision;

beforeAll(async () => {
  Page = (await import("@/app/(dashboard)/review/[id]/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue({ kind: "facultad", facultadId: 4 });
  detailMock.mockReset();
  detailMock.mockResolvedValue(detail());
  readMock.mockReset();
  readMock.mockResolvedValue(undefined);
  remissionsMock.mockReset();
  remissionsMock.mockResolvedValue([]);
  accountsMock.mockReset();
  accountsMock.mockResolvedValue({
    carreraNombre: "Ingenieria de Sistemas",
    cuentas: 1,
  });
});

describe("ReviewDetailPage access (RNF-01)", () => {
  it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
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

  it("sends an anonymous caller to /login and a flagged one to the change screen", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    getSessionMock.mockResolvedValue(sessionFor("secretaria", true));
    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("reads the scope for the session user and loads the id from the URL", async () => {
    await renderPage("12");

    expect(scopeMock).toHaveBeenCalledWith(7, "secretaria");
    expect(detailMock).toHaveBeenCalledWith(
      { kind: "facultad", facultadId: 4 },
      12,
    );
  });

  it("is not found, with no data call, for a secretaria without a faculty", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
    expect(detailMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-4", "1.5", "12abc", "", "99999999999999999999"])(
    "is not found for the malformed id %j without touching the data layer",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NOT_FOUND");

      expect(detailMock).not.toHaveBeenCalled();
      expect(readMock).not.toHaveBeenCalled();
    },
  );

  it("is not found, and writes no audit row, when the request is out of scope, a draft or unknown", async () => {
    detailMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
    expect(readMock).not.toHaveBeenCalled();
  });
});

describe("ReviewDetailPage content (RF-06, RF-08 b)", () => {
  it("shows the cause, dates, student snapshot and state", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Request from Ana Lopez",
    );
    const request = screen.getByRole("region", { name: en.sections.request });
    expect(request).toHaveTextContent("Medical");
    expect(request).toHaveTextContent("Oct 5, 2026 to Oct 7, 2026");
    expect(request).toHaveTextContent(en.states.pendiente);
    const student = screen.getByRole("region", { name: en.sections.student });
    expect(student).toHaveTextContent("Ana Lopez");
    expect(student).toHaveTextContent("2021-0042");
    expect(student).toHaveTextContent("Ingenieria de Sistemas");
    expect(student).toHaveTextContent("ana@uam.edu.ni");
  });

  it("shows the recorded consent in the student section, in Managua time", async () => {
    await renderPage();

    const student = screen.getByRole("region", { name: en.sections.student });
    expect(within(student).getByText(en.fields.consent)).toBeInTheDocument();
    expect(student).toHaveTextContent("Version 2026-10-20, Oct 8, 2026");
    expect(student.textContent).toMatch(/2:05\s?PM/);
  });

  it("says no consent is recorded for a request presented before consent existed", async () => {
    detailMock.mockResolvedValue(detail({ consentimiento: null }));

    await renderPage();

    const student = screen.getByRole("region", { name: en.sections.student });
    expect(student).toHaveTextContent(
      "Not recorded (presented before consent existed)",
    );
    expect(within(student).queryByRole("alert")).toBeNull();
  });

  it("keeps showing the original consent after a correction and resubmission", async () => {
    detailMock.mockResolvedValue(
      detail({ reenviadaEn: new Date("2026-10-12T15:00:00Z") }),
    );

    await renderPage();

    const student = screen.getByRole("region", { name: en.sections.student });
    expect(student).toHaveTextContent("Version 2026-10-20, Oct 8, 2026");
    expect(student).not.toHaveTextContent("Oct 12, 2026");
  });

  it("adds no audit row for the consent: one read per opened detail", async () => {
    await renderPage();

    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith(7, 12, "pendiente");
  });

  it("shows a single absence day once", async () => {
    detailMock.mockResolvedValue(detail({ fechaFin: "2026-10-05" }));

    await renderPage();

    const request = screen.getByRole("region", { name: en.sections.request });
    expect(request).toHaveTextContent("Oct 5, 2026");
    expect(request).not.toHaveTextContent(" to ");
  });

  it("lists the subjects with group and teacher, or that no teacher is assigned", async () => {
    await renderPage();

    const subjects = screen.getByRole("region", { name: en.sections.subjects });
    const items = within(subjects).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("MAT-101");
    expect(items[0]).toHaveTextContent("Calculo");
    expect(items[0]).toHaveTextContent("Group 2");
    expect(items[0]).toHaveTextContent("Teacher: Pedro Ruiz");
    expect(items[1]).toHaveTextContent(en.subject.noTeacher);
  });

  it("offers View and Download for each current document through the authenticated route", async () => {
    await renderPage();

    const docs = screen.getByRole("region", { name: en.sections.documents });
    expect(docs).toHaveTextContent("constancia.pdf");
    const view = within(docs).getByRole("link", {
      name: "View constancia.pdf",
    });
    expect(view).toHaveAttribute("href", "/api/intake/documents/31?modo=ver");
    expect(view).toHaveAttribute("target", "_blank");
    expect(view).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      within(docs).getByRole("link", { name: "Download constancia.pdf" }),
    ).toHaveAttribute("href", "/api/intake/documents/31?modo=descarga");
  });

  it("says so when there are no documents", async () => {
    detailMock.mockResolvedValue(detail({ documentos: [] }));

    await renderPage();

    expect(
      within(
        screen.getByRole("region", { name: en.sections.documents }),
      ).getByText(en.documents.empty),
    ).toBeInTheDocument();
  });

  it("shows the deadline of a pending request", async () => {
    await renderPage();
    const request = screen.getByRole("region", { name: en.sections.request });
    expect(request).toHaveTextContent(en.fields.deadline);
    expect(request).toHaveTextContent(
      /On time|Due within 1 business day|Overdue/,
    );
  });

  it("starts the deadline at the start a coordination answer stored (RN-08)", async () => {
    // Wednesday 14 October 2026, 09:00 in Managua.
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-10-14T15:00:00Z"),
    });
    try {
      // Presented Monday 12th: the base deadline is Wednesday 14th, due today.
      detailMock.mockResolvedValue(
        detail({ presentadaEn: new Date("2026-10-12T16:00:00Z") }),
      );
      const { unmount } = await renderPage();
      expect(
        screen.getByRole("region", { name: en.sections.request }),
      ).toHaveTextContent("Due Oct 14, 2026");
      unmount();

      // The answer stored Thursday 15th: the deadline moves to Monday 19th.
      detailMock.mockResolvedValue(
        detail({
          presentadaEn: new Date("2026-10-12T16:00:00Z"),
          plazoInicioEn: new Date("2026-10-15T06:00:00Z"),
        }),
      );
      await renderPage();
      expect(
        screen.getByRole("region", { name: en.sections.request }),
      ).toHaveTextContent("Due Oct 19, 2026");
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks a resubmitted request with its resubmission date", async () => {
    detailMock.mockResolvedValue(
      detail({ reenviadaEn: new Date("2026-10-10T15:00:00Z") }),
    );

    await renderPage();

    const request = screen.getByRole("region", { name: en.sections.request });
    expect(request).toHaveTextContent(en.fields.resubmitted);
    expect(request).toHaveTextContent("Oct 10, 2026");
  });

  it("links back to the queue without prefetching", async () => {
    await renderPage();

    const back = screen.getByRole("link", { name: en.back });
    expect(back).toHaveAttribute("href", "/review");
    expect(back).toHaveAttribute("data-prefetch", "false");
  });

  it("renders in Spanish", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Solicitud de Ana Lopez",
    );
    expect(
      screen.getByRole("region", {
        name: messages.es.review.detail.sections.request,
      }),
    ).toHaveTextContent("Causa médica");
  });
});

describe("ReviewDetailPage decision panel (RF-07, RN-16)", () => {
  it("offers the three decisions only while the request is pending", async () => {
    await renderPage();

    const panel = screen.getByRole("region", { name: en.sections.decision });
    for (const name of [
      dec.approve.trigger,
      dec.return.trigger,
      dec.reject.trigger,
    ]) {
      expect(within(panel).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it.each(["aprobada", "rechazada", "devuelta", "en_revision_coordinacion"])(
    "offers no decision control for a %s request",
    async (estado) => {
      detailMock.mockResolvedValue(detail({ estado }));

      await renderPage();

      expect(
        screen.queryByRole("region", { name: en.sections.decision }),
      ).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
      const request = screen.getByRole("region", { name: en.sections.request });
      expect(request).toHaveTextContent(
        en.states[estado as keyof typeof en.states],
      );
      expect(request).not.toHaveTextContent(en.fields.deadline);
    },
  );

  it("prefills each dialog with the template rendered for this request", async () => {
    await renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: dec.approve.trigger }),
    );
    const text = await screen.findByRole("textbox", { name: dec.textLabel });
    expect((text as HTMLTextAreaElement).value).toContain("Ana Lopez");
    expect((text as HTMLTextAreaElement).value).toContain("médicos");
    expect((text as HTMLTextAreaElement).value).toContain(
      "del 5 al 7 de octubre de 2026",
    );
  });
});

describe("ReviewDetailPage history (RF-06, RF-08 b)", () => {
  it("shows a clear note when there is no history", async () => {
    await renderPage();

    expect(
      within(
        screen.getByRole("region", { name: en.sections.history }),
      ).getByText(en.history.empty),
    ).toBeInTheDocument();
  });

  it("shows earlier decisions with template, reason, text, author and time", async () => {
    detailMock.mockResolvedValue(
      detail({
        decisiones: [
          {
            id: 1,
            tipo: "devuelta",
            plantillaCodigo: "devolucion.documento_ilegible",
            motivoCodigo: "documento_ilegible",
            texto: "Adjunte una copia legible.",
            revisionId: 5,
            secretariaNombre: "Rosa Mena",
            decididaEn: new Date("2026-10-09T15:00:00Z"),
          },
        ],
      }),
    );

    await renderPage();

    const history = screen.getByRole("region", { name: en.sections.history });
    expect(history).toHaveTextContent(en.states.devuelta);
    expect(history).toHaveTextContent(
      dec.templates.devolucion_documento_ilegible,
    );
    expect(history).toHaveTextContent(dec.reasons.documento_ilegible);
    expect(history).toHaveTextContent("Adjunte una copia legible.");
    expect(history).toHaveTextContent("Rosa Mena, Oct 9, 2026");
    expect(history).not.toHaveTextContent(en.history.empty);
  });

  it("shows an approval without text as such, and an unknown template code as is", async () => {
    detailMock.mockResolvedValue(
      detail({
        estado: "aprobada",
        decisiones: [
          {
            id: 2,
            tipo: "aprobada",
            plantillaCodigo: "plantilla.retirada",
            motivoCodigo: null,
            texto: null,
            revisionId: null,
            secretariaNombre: "Rosa Mena",
            decididaEn: new Date("2026-10-09T15:00:00Z"),
          },
        ],
      }),
    );

    await renderPage();

    const history = screen.getByRole("region", { name: en.sections.history });
    expect(history).toHaveTextContent(en.history.noText);
    expect(history).toHaveTextContent("plantilla.retirada");
  });

  it("shows the earlier versions with their classes and document count", async () => {
    detailMock.mockResolvedValue(
      detail({
        revisiones: [
          {
            id: 5,
            numero: 1,
            causa: "fuerza_mayor",
            fechaInicio: "2026-09-30",
            fechaFin: "2026-10-01",
            clases: [
              {
                asignaturaId: 9,
                codigo: "QUI-300",
                nombre: "Quimica",
                numeroGrupo: "1",
              },
            ],
            documentoIds: [30, 31],
            creadaEn: new Date("2026-10-09T15:00:00Z"),
          },
        ],
      }),
    );

    await renderPage();

    const history = screen.getByRole("region", { name: en.sections.history });
    expect(history).toHaveTextContent("Version 1");
    expect(history).toHaveTextContent("Other force majeure");
    expect(history).toHaveTextContent("Sep 30, 2026 to Oct 1, 2026");
    expect(history).toHaveTextContent("QUI-300");
    expect(history).toHaveTextContent("2 documents");
  });

  it("shows replaced documents as replaced, still viewable by staff", async () => {
    detailMock.mockResolvedValue(
      detail({
        documentosRetirados: [
          {
            id: 30,
            nombreOriginal: "borroso.jpg",
            tipoDetectado: "image/jpeg",
            tamanoBytes: 900,
            creadoEn: new Date("2026-10-07T14:00:00Z"),
            retiradoEn: new Date("2026-10-10T14:00:00Z"),
          },
        ],
      }),
    );

    await renderPage();

    const history = screen.getByRole("region", { name: en.sections.history });
    expect(history).toHaveTextContent("borroso.jpg");
    expect(history).toHaveTextContent("Replaced Oct 10, 2026");
    expect(
      within(history).getByRole("link", { name: "View borroso.jpg" }),
    ).toHaveAttribute("href", "/api/intake/documents/30?modo=ver");
    const current = screen.getByRole("region", { name: en.sections.documents });
    expect(current).not.toHaveTextContent("borroso.jpg");
  });
});

const SNAPSHOT_CLASSES = [
  { asignaturaId: 1, codigo: "MAT-101", nombre: "Calculo", numeroGrupo: "2" },
  { asignaturaId: 2, codigo: "FIS-200", nombre: "Fisica", numeroGrupo: "2" },
];

function revision(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 5,
    numero: 1,
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    clases: SNAPSHOT_CLASSES,
    documentoIds: [31],
    creadaEn: new Date("2026-10-09T15:00:00Z"),
    ...overrides,
  };
}

/** A request resubmitted after a return whose snapshot equals it. */
function resubmitted(overrides: Partial<Record<string, unknown>> = {}) {
  return detail({
    reenviadaEn: new Date("2026-10-12T15:00:00Z"),
    revisiones: [revision()],
    ...overrides,
  });
}

const changes = () => screen.getByRole("region", { name: en.changes.title });
const row = (label: string) =>
  within(changes()).getByText(label).closest("li") as HTMLElement;

describe("ReviewDetailPage changes since the return (RF-06, RF-08 b, SR-17)", () => {
  it("marks every section unchanged when the request equals the returned version", async () => {
    detailMock.mockResolvedValue(resubmitted());

    await renderPage();

    expect(row(en.changes.sections.causeDates)).toHaveTextContent(
      en.changes.marks.unchanged,
    );
    expect(row(en.changes.sections.subjects)).toHaveTextContent(
      en.changes.marks.unchanged,
    );
    expect(row(en.changes.sections.documents)).toHaveTextContent(
      en.changes.marks.unchanged,
    );
    expect(within(changes()).queryByText(en.changes.marks.changed)).toBeNull();
  });

  it("marks a replaced subject group as changed and keeps the other marks", async () => {
    detailMock.mockResolvedValue(
      resubmitted({
        revisiones: [
          revision({
            clases: [
              { ...SNAPSHOT_CLASSES[0], numeroGrupo: "1" },
              SNAPSHOT_CLASSES[1],
            ],
          }),
        ],
      }),
    );

    await renderPage();

    expect(row(en.changes.sections.subjects)).toHaveTextContent(
      en.changes.marks.changed,
    );
    expect(row(en.changes.sections.causeDates)).toHaveTextContent(
      en.changes.marks.unchanged,
    );
    expect(row(en.changes.sections.documents)).toHaveTextContent(
      en.changes.marks.unchanged,
    );
  });

  it("marks a changed cause or date as changed", async () => {
    detailMock.mockResolvedValue(
      resubmitted({ revisiones: [revision({ fechaFin: "2026-10-06" })] }),
    );

    await renderPage();

    expect(row(en.changes.sections.causeDates)).toHaveTextContent(
      en.changes.marks.changed,
    );
    expect(row(en.changes.sections.subjects)).toHaveTextContent(
      en.changes.marks.unchanged,
    );
  });

  it("lists the retired and the added documents by name, and not the kept one", async () => {
    detailMock.mockResolvedValue(
      resubmitted({
        revisiones: [revision({ documentoIds: [30, 31] })],
        documentos: [
          ...detail().documentos,
          {
            id: 32,
            nombreOriginal: "nuevo.pdf",
            tipoDetectado: "application/pdf",
            tamanoBytes: 900,
            creadoEn: new Date("2026-10-11T14:00:00Z"),
          },
        ],
        documentosRetirados: [
          {
            id: 30,
            nombreOriginal: "borroso.jpg",
            tipoDetectado: "image/jpeg",
            tamanoBytes: 900,
            creadoEn: new Date("2026-10-07T14:00:00Z"),
            retiradoEn: new Date("2026-10-11T14:00:00Z"),
          },
        ],
      }),
    );

    await renderPage();

    const section = changes();
    expect(row(en.changes.sections.documents)).toHaveTextContent(
      en.changes.marks.changed,
    );
    expect(
      within(section).getByRole("list", { name: en.changes.retired }),
    ).toHaveTextContent("borroso.jpg");
    expect(
      within(section).getByRole("list", { name: en.changes.added }),
    ).toHaveTextContent("nuevo.pdf");
    expect(section).not.toHaveTextContent("constancia.pdf");
  });

  it("names a document it cannot resolve with a fallback label", async () => {
    detailMock.mockResolvedValue(
      resubmitted({ revisiones: [revision({ documentoIds: [99, 31] })] }),
    );

    await renderPage();

    expect(
      within(changes()).getByRole("list", { name: en.changes.retired }),
    ).toHaveTextContent("Document 99");
  });

  it.each([
    ["ascending", [5, 6]],
    ["descending", [6, 5]],
  ])("compares with the latest version only (%s input)", async (_o, order) => {
    const first = revision({ id: 5, numero: 1, causa: "fuerza_mayor" });
    const second = revision({ id: 6, numero: 2 });
    detailMock.mockResolvedValue(
      resubmitted({
        revisiones: order.map((id) => (id === 5 ? first : second)),
      }),
    );

    await renderPage();

    expect(row(en.changes.sections.causeDates)).toHaveTextContent(
      en.changes.marks.unchanged,
    );
  });

  it("is the first section of the stack", async () => {
    detailMock.mockResolvedValue(resubmitted());

    await renderPage();

    expect(screen.getAllByRole("region")[0]).toBe(changes());
  });

  it("shows no flags for a first-time pending request", async () => {
    await renderPage();

    expect(screen.queryByRole("region", { name: en.changes.title })).toBeNull();
  });

  it.each([
    ["a revision without a resubmission", { revisiones: [revision()] }],
    ["a resubmission without a revision", { reenviadaEn: new Date() }],
    [
      "a request returned again",
      {
        estado: "devuelta",
        reenviadaEn: new Date("2026-10-12T15:00:00Z"),
        revisiones: [revision()],
      },
    ],
  ])("shows no flags for %s", async (_name, overrides) => {
    detailMock.mockResolvedValue(detail(overrides));

    await renderPage();

    expect(screen.queryByRole("region", { name: en.changes.title })).toBeNull();
  });

  it("is worded in Spanish with the same structure", async () => {
    state.locale = "es";
    detailMock.mockResolvedValue(
      resubmitted({ revisiones: [revision({ causa: "fuerza_mayor" })] }),
    );

    await renderPage();

    const es = messages.es.review.detail.changes;
    const section = screen.getByRole("region", { name: es.title });
    expect(section).toHaveTextContent(es.marks.changed);
    expect(section).toHaveTextContent(es.marks.unchanged);
  });

  it("writes exactly one audit row, and none when the comparison cannot be built", async () => {
    detailMock.mockResolvedValue(resubmitted());
    await renderPage();
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith(7, 12, "pendiente");

    readMock.mockClear();
    detailMock.mockResolvedValue(
      resubmitted({ revisiones: [revision({ clases: null })] }),
    );
    await expect(renderPage()).rejects.toThrow();
    expect(readMock).not.toHaveBeenCalled();
  });
});

describe("ReviewDetailPage audited read (SR-11)", () => {
  it("writes exactly one read row for the session user, request and state", async () => {
    await renderPage();

    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith(7, 12, "pendiente");
  });

  it("audits a decided request with its own state", async () => {
    detailMock.mockResolvedValue(detail({ estado: "rechazada" }));

    await renderPage();

    expect(readMock).toHaveBeenCalledWith(7, 12, "rechazada");
  });

  it("writes no row when the data load throws", async () => {
    detailMock.mockRejectedValue(new Error("db down"));

    await expect(renderPage()).rejects.toThrow("db down");
    expect(readMock).not.toHaveBeenCalled();
  });

  it("writes no row when a derived value throws before the page is built", async () => {
    detailMock.mockResolvedValue(detail({ causa: null }));

    await expect(renderPage()).rejects.toThrow();
    expect(readMock).not.toHaveBeenCalled();
  });

  it("shows no data when the audit write fails", async () => {
    readMock.mockRejectedValue(new Error("audit down"));

    await expect(renderPage()).rejects.toThrow("audit down");
  });
});

describe("ReviewDetailPage remission section (RF-09 c)", () => {
  const REMISSION = {
    id: 31,
    docenteNombre: "Pedro Ruiz",
    correo: "pedro@uam.edu.ni",
    clases: [
      {
        asignaturaId: 1,
        codigo: "MAT-101",
        nombre: "Calculo",
        numeroGrupo: "2",
      },
    ],
    estado: "bloqueada",
    motivoCodigo: "formato_especial_faltante",
    enviadaEn: null,
    intentos: 0,
  };

  it("lists the remissions of an approved request, with the unassigned groups", async () => {
    detailMock.mockResolvedValue(detail({ estado: "aprobada" }));
    remissionsMock.mockResolvedValue([REMISSION]);

    await renderPage();

    expect(remissionsMock).toHaveBeenCalledWith(12);
    const section = screen.getByRole("region", {
      name: messages.en.review.remission.title,
    });
    expect(within(section).getByText("Pedro Ruiz")).toBeInTheDocument();
    expect(within(section).getByText("pedro@uam.edu.ni")).toBeInTheDocument();
    expect(
      within(section).getByText(/No teacher is identified for: FIS-200/),
    ).toBeInTheDocument();
  });

  it("offers the signed-format upload on a marked approval that has no format", async () => {
    detailMock.mockResolvedValue(
      detail({ estado: "aprobada", formatoEspecial: true }),
    );
    remissionsMock.mockResolvedValue([REMISSION]);

    await renderPage();

    const section = screen.getByRole("region", {
      name: messages.en.review.remission.title,
    });
    expect(
      within(section).getByRole("button", {
        name: messages.en.review.remission.upload.action,
      }),
    ).toBeInTheDocument();
  });

  it("shows the uploaded format by name, apart from the student's documents", async () => {
    detailMock.mockResolvedValue(
      detail({
        estado: "aprobada",
        formatoEspecial: true,
        formato: { id: 30, nombreOriginal: "firmado.pdf" },
      }),
    );
    remissionsMock.mockResolvedValue([REMISSION]);

    await renderPage();

    const section = screen.getByRole("region", {
      name: messages.en.review.remission.title,
    });
    expect(
      within(section).getByRole("link", { name: "firmado.pdf" }),
    ).toHaveAttribute("href", "/api/intake/documents/30");
    expect(
      within(section).queryByRole("button", {
        name: messages.en.review.remission.upload.action,
      }),
    ).not.toBeInTheDocument();
  });

  it("offers no upload for an approval that was not marked", async () => {
    detailMock.mockResolvedValue(detail({ estado: "aprobada" }));
    remissionsMock.mockResolvedValue([REMISSION]);

    await renderPage();

    expect(
      screen.queryByRole("button", {
        name: messages.en.review.remission.upload.action,
      }),
    ).not.toBeInTheDocument();
  });

  it("loads the remissions before the audited read and adds no audit row of its own", async () => {
    detailMock.mockResolvedValue(detail({ estado: "aprobada" }));

    await renderPage();

    expect(remissionsMock.mock.invocationCallOrder[0]).toBeLessThan(
      readMock.mock.invocationCallOrder[0],
    );
    expect(readMock).toHaveBeenCalledTimes(1);
  });

  it.each(["devuelta", "pendiente", "rechazada"])(
    "shows no section and reads no remission for a %s request",
    async (estado) => {
      detailMock.mockResolvedValue(detail({ estado }));

      await renderPage();

      expect(remissionsMock).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("region", {
          name: messages.en.review.remission.title,
        }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("ReviewDetailPage special-format mark (RN-19)", () => {
  const mark = messages.en.review.decision.approve.specialFormat;

  async function openApprove() {
    await userEvent.click(
      screen.getByRole("button", {
        name: messages.en.review.decision.approve.trigger,
      }),
    );
    return screen.findByRole("alertdialog");
  }

  it("offers the mark in the approve dialog of a fuerza_mayor request", async () => {
    detailMock.mockResolvedValue(detail({ causa: "fuerza_mayor" }));

    await renderPage();
    const dialog = await openApprove();

    expect(
      within(dialog).getByRole("checkbox", { name: mark.label }),
    ).toBeInTheDocument();
  });

  it("does not offer the mark for another cause", async () => {
    await renderPage();
    const dialog = await openApprove();

    expect(within(dialog).queryByRole("checkbox")).toBeNull();
  });
});

const esc = messages.en.review.escalation;
const rep = messages.en.review.report;

function escalationRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 61,
    motivo: "sospecha_documento",
    nota: "El sello parece alterado.",
    autorNombre: "Rosa Lopez",
    creadoEn: new Date("2026-10-08T15:00:00Z"),
    respuesta: null,
    respondidaPorNombre: null,
    respondidaEn: null,
    notificacionEstado: "pendiente",
    notificacionMotivo: null,
    enviadaEn: null,
    ...overrides,
  };
}

function reportRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 71,
    docenteNombre: "Luis Mora",
    comunicadoEl: "2026-10-09",
    nota: "Supera el limite de faltas.",
    registradoPorNombre: "Rosa Lopez",
    registradoEn: new Date("2026-10-10T16:00:00Z"),
    notificacionEstado: "pendiente",
    notificacionMotivo: null,
    enviadaEn: null,
    ...overrides,
  };
}

function remission(id: number, docenteNombre: string, estado = "enviada") {
  return {
    id,
    docenteNombre,
    correo: "docente@uam.edu.ni",
    clases: [],
    estado,
    motivoCodigo: null,
    enviadaEn: estado === "enviada" ? new Date("2026-10-09T15:00:00Z") : null,
    intentos: 0,
  };
}

describe("ReviewDetailPage escalate action (RF-10 a, E17)", () => {
  it("offers the escalation beside approve, return and reject while pendiente", async () => {
    await renderPage();

    const panel = screen.getByRole("region", { name: en.sections.decision });
    expect(
      within(panel).getByRole("button", { name: esc.dialog.trigger }),
    ).toBeInTheDocument();
    expect(within(panel).getAllByRole("button")).toHaveLength(4);
    expect(accountsMock).toHaveBeenCalledWith(12);
  });

  it.each([1, 2])(
    "still offers it when the career has %i active coordination account(s), email or not",
    async (cuentas) => {
      accountsMock.mockResolvedValue({
        carreraNombre: "Ingenieria de Sistemas",
        cuentas,
      });

      await renderPage();

      expect(
        screen.getByRole("button", { name: esc.dialog.trigger }),
      ).toBeInTheDocument();
    },
  );

  it("shows it unavailable, naming the career, when there is no coordination account", async () => {
    accountsMock.mockResolvedValue({
      carreraNombre: "Ingenieria Civil",
      cuentas: 0,
    });

    await renderPage();

    const panel = screen.getByRole("region", { name: en.sections.decision });
    expect(
      within(panel).queryByRole("button", { name: esc.dialog.trigger }),
    ).toBeNull();
    expect(within(panel).getByRole("note")).toHaveTextContent(
      "Ingenieria Civil has no registered coordination; ask the administrator to create the account.",
    );
    // The three decisions stay available.
    expect(within(panel).getAllByRole("button")).toHaveLength(3);
  });

  it("falls back to the snapshot career name when the student has no live career", async () => {
    accountsMock.mockResolvedValue(null);

    await renderPage();

    expect(screen.getByRole("note")).toHaveTextContent(
      "Ingenieria de Sistemas has no registered coordination",
    );
  });

  it.each(["aprobada", "rechazada", "devuelta", "en_revision_coordinacion"])(
    "offers no escalation and reads no account count for a %s request",
    async (estado) => {
      detailMock.mockResolvedValue(detail({ estado }));

      await renderPage();

      expect(
        screen.queryByRole("button", { name: esc.dialog.trigger }),
      ).toBeNull();
      expect(accountsMock).not.toHaveBeenCalled();
    },
  );
});

describe("ReviewDetailPage escalation history (RF-10, RN-16)", () => {
  it("shows the open escalation, its note and the notification status in coordination, with no control", async () => {
    detailMock.mockResolvedValue(
      detail({
        estado: "en_revision_coordinacion",
        escalamientos: [escalationRecord()],
      }),
    );

    await renderPage();

    const region = screen.getByRole("region", { name: esc.section.title });
    expect(region).toHaveTextContent("El sello parece alterado.");
    expect(region).toHaveTextContent(esc.notification.pendiente);
    expect(region).toHaveTextContent(esc.section.waiting);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("shows the earlier escalation with its answer once the request is pendiente again", async () => {
    detailMock.mockResolvedValue(
      detail({
        escalamientos: [
          escalationRecord({
            respuesta: "El documento es autentico.",
            respondidaPorNombre: "Marta Gomez",
            respondidaEn: new Date("2026-10-09T21:00:00Z"),
          }),
        ],
      }),
    );

    await renderPage();

    const region = screen.getByRole("region", { name: esc.section.title });
    expect(region).toHaveTextContent("El documento es autentico.");
    expect(region).toHaveTextContent("Marta Gomez, Oct 9, 2026");
    // The decision panel is offered again.
    expect(
      screen.getByRole("region", { name: en.sections.decision }),
    ).toBeInTheDocument();
  });

  it("has no escalation section for a request that was never escalated", async () => {
    await renderPage();

    expect(
      screen.queryByRole("region", { name: esc.section.title }),
    ).toBeNull();
  });

  it("writes exactly one audited read however many escalations it lists", async () => {
    detailMock.mockResolvedValue(
      detail({
        escalamientos: [escalationRecord(), escalationRecord({ id: 62 })],
      }),
    );

    await renderPage();

    expect(readMock).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewDetailPage absence reports (RF-15)", () => {
  const approved = (overrides: Partial<Record<string, unknown>> = {}) =>
    detail({ estado: "aprobada", ...overrides });

  it("offers the report action for the remitted teachers only and lists earlier reports", async () => {
    detailMock.mockResolvedValue(approved({ reportes: [reportRecord()] }));
    remissionsMock.mockResolvedValue([
      remission(31, "Luis Mora"),
      remission(32, "Pedro Ruiz", "pendiente"),
    ]);

    await renderPage();
    const region = screen.getByRole("region", { name: rep.section.title });
    expect(region).toHaveTextContent("Supera el limite de faltas.");
    await userEvent.click(
      within(region).getByRole("button", { name: rep.dialog.trigger }),
    );
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(
        within(dialog).getByRole("combobox", { name: rep.dialog.teacherLabel }),
      )
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([rep.dialog.teacherPlaceholder, "Luis Mora", "Pedro Ruiz"]);
  });

  it("limits the report date to today in Managua", async () => {
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-10-15T03:00:00Z"),
    });
    try {
      detailMock.mockResolvedValue(approved());
      remissionsMock.mockResolvedValue([remission(31, "Luis Mora")]);

      await renderPage();
      await userEvent.click(
        screen.getByRole("button", { name: rep.dialog.trigger }),
      );
      const dialog = await screen.findByRole("alertdialog");

      // 03:00 UTC on the 15th is still the 14th at 21:00 in Managua.
      expect(
        within(dialog).getByLabelText(rep.dialog.dateLabel),
      ).toHaveAttribute("max", "2026-10-14");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the report list apart from the remission section, which a report does not change", async () => {
    remissionsMock.mockResolvedValue([remission(31, "Luis Mora")]);
    detailMock.mockResolvedValue(approved());
    const { unmount } = await renderPage();
    const before = screen.getByRole("region", {
      name: messages.en.review.remission.title,
    }).textContent;
    unmount();

    detailMock.mockResolvedValue(approved({ reportes: [reportRecord()] }));
    await renderPage();

    const remissionSection = screen.getByRole("region", {
      name: messages.en.review.remission.title,
    });
    expect(remissionSection.textContent).toBe(before);
    expect(remissionSection).not.toContainElement(
      screen.getByRole("region", { name: rep.section.title }),
    );
    expect(remissionSection).not.toHaveTextContent("Supera el limite");
  });

  it("offers no action, and says why, when no teacher has a remission", async () => {
    detailMock.mockResolvedValue(approved());

    await renderPage();

    expect(
      screen.queryByRole("button", { name: rep.dialog.trigger }),
    ).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(rep.section.noTeachers);
  });

  it.each(["pendiente", "devuelta", "rechazada", "en_revision_coordinacion"])(
    "shows no report action or section for a %s request without reports",
    async (estado) => {
      detailMock.mockResolvedValue(detail({ estado }));

      await renderPage();

      expect(
        screen.queryByRole("region", { name: rep.section.title }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: rep.dialog.trigger }),
      ).toBeNull();
    },
  );
});
