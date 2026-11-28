import { cleanup, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  renderIntl,
} from "@/app/(dashboard)/requests/new/test-support";
import type { Draft } from "@/lib/data/solicitudes";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { DEFAULT_PARAMETERS } from "@/lib/parameters/registry";

const {
  requireRole,
  openDraft,
  listEnrollmentFailSoft,
  hasActive,
  getNormativeParameters,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  openDraft: vi.fn(),
  listEnrollmentFailSoft: vi.fn(),
  hasActive: vi.fn(),
  getNormativeParameters: vi.fn(),
}));
const deps = vi.hoisted(() => ({
  store: { id: "store" },
  schedule: { id: "schedule" },
}));

vi.mock("@/lib/auth/dal", () => ({ requireRole }));
vi.mock("@/lib/data/solicitudes", () => ({ openDraft }));
vi.mock("@/lib/data/enrollment", () => ({
  listEnrollmentFailSoft,
  hasActiveEnrollmentFailSoft: hasActive,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: () => deps }));
// The loader is the only source of the limits the flow shows (NP-17, A11).
vi.mock("@/lib/parameters/loader", () => ({ getNormativeParameters }));
vi.mock("@/app/(dashboard)/requests/new/flow-steps", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/app/(dashboard)/requests/new/flow-steps")
    >();
  return { ...actual, FlowSteps: vi.fn(actual.FlowSteps) };
});
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: "es",
      messages: messages.es,
      namespace: namespace as "intake",
    }),
}));
vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  saveDetailsAction: vi.fn(),
  saveSubjectsAction: vi.fn(),
  finalizeDocumentAction: vi.fn(),
  removeDocumentAction: vi.fn(),
  submitRequestAction: vi.fn(),
  discardDraftAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { FlowSteps } from "@/app/(dashboard)/requests/new/flow-steps";
import NewRequestPage from "@/app/(dashboard)/requests/new/page";

const EMPTY: Draft = {
  id: 42,
  causa: null,
  fechaInicio: null,
  fechaFin: null,
  actualizadoEn: new Date("2026-10-01T12:00:00Z"),
  subjects: [],
  documents: [],
};
const WITH_DETAILS: Draft = {
  ...EMPTY,
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};
const GROUP = {
  grupoId: 1,
  asignaturaId: 10,
  asignaturaCodigo: "MAT-101",
  asignaturaNombre: "Cálculo I",
  periodo: "2026-2",
  numeroGrupo: "1",
  docenteNombre: "Ana Pérez",
};

async function renderPage(
  searchParams: Record<string, string | string[]> = {},
) {
  renderIntl(
    await NewRequestPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

const heading = (name: string) =>
  screen.getByRole("heading", { level: 2, name });

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ sub: "7", rol: "estudiante" });
  openDraft.mockReset().mockResolvedValue(EMPTY);
  listEnrollmentFailSoft
    .mockReset()
    .mockResolvedValue({ data: [GROUP], degraded: false, enrolled: true });
  hasActive.mockReset().mockResolvedValue(true);
  getNormativeParameters.mockReset().mockResolvedValue({
    values: DEFAULT_PARAMETERS,
    fallback: [],
    degraded: false,
  });
  vi.mocked(FlowSteps).mockClear();
});

describe("NewRequestPage guard (RNF-01)", () => {
  it("allows exactly the requesting roles", async () => {
    await renderPage();
    expect(requireRole).toHaveBeenCalledWith(...rolesSolicitantes);
  });

  it("reads nothing when the role guard redirects", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      NewRequestPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(openDraft).not.toHaveBeenCalled();
    expect(listEnrollmentFailSoft).not.toHaveBeenCalled();
    expect(getNormativeParameters).not.toHaveBeenCalled();
  });

  it("opens the draft of the session user only, with the store port", async () => {
    await renderPage();
    expect(openDraft).toHaveBeenCalledTimes(1);
    const [userId, now, store] = openDraft.mock.calls[0];
    expect(userId).toBe(7);
    expect(now).toBeInstanceOf(Date);
    expect(store).toBe(deps.store);
  });
});

describe("NewRequestPage limits (NP-17, A13)", () => {
  it("reads the parameters once and hands the flow the limits in force", async () => {
    getNormativeParameters.mockResolvedValue({
      values: {
        ...DEFAULT_PARAMETERS,
        filingWindowDays: 10,
        maxDocumentMib: 7,
      },
      fallback: [],
      degraded: false,
    });

    await renderPage();

    expect(getNormativeParameters).toHaveBeenCalledTimes(1);
    expect(vi.mocked(FlowSteps).mock.calls[0][0].limits).toEqual({
      filingWindowDays: 10,
      maxDocumentMib: 7,
    });
  });

  it("reads nothing when the draft cannot be opened", async () => {
    openDraft.mockRejectedValue(new Error("down"));

    await renderPage();

    expect(getNormativeParameters).not.toHaveBeenCalled();
  });
});

describe("NewRequestPage causes (NP-11)", () => {
  it("hands the flow the active causes in the stored order", async () => {
    getNormativeParameters.mockResolvedValue({
      values: {
        ...DEFAULT_PARAMETERS,
        causes: [
          { codigo: "medica", activa: true, posicion: 1 },
          { codigo: "intercambio_academico", activa: false, posicion: 2 },
          { codigo: "fuerza_mayor", activa: true, posicion: 3 },
          { codigo: "maternidad_paternidad", activa: true, posicion: 4 },
          { codigo: "actividad_representativa", activa: true, posicion: 5 },
        ],
      },
      fallback: [],
      degraded: false,
    });

    await renderPage();

    expect(vi.mocked(FlowSteps).mock.calls[0][0].causes).toEqual([
      "medica",
      "fuerza_mayor",
      "maternidad_paternidad",
      "actividad_representativa",
    ]);
  });
});

describe("NewRequestPage step from the URL (A7)", () => {
  it("starts an empty draft at step 1 and shows the header and stepper", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Nueva solicitud de justificación",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
    expect(heading("Causa y fechas")).toBeInTheDocument();
    expect(listEnrollmentFailSoft).not.toHaveBeenCalled();
  });

  it("resumes at step 2 once the details are saved, with enrollment for those dates", async () => {
    openDraft.mockResolvedValue(WITH_DETAILS);
    await renderPage();
    expect(screen.getByText("Paso 2 de 4")).toBeInTheDocument();
    expect(heading("Asignaturas afectadas")).toBeInTheDocument();
    expect(listEnrollmentFailSoft).toHaveBeenCalledWith(
      7,
      { from: "2026-10-01", to: "2026-10-03" },
      deps.schedule,
    );
    expect(
      screen.getByRole("checkbox", { name: /MAT-101/ }),
    ).toBeInTheDocument();
  });

  it("an explicit step wins over the resume point and prefills the draft", async () => {
    openDraft.mockResolvedValue(WITH_DETAILS);
    await renderPage({ step: "1" });
    expect(heading("Causa y fechas")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Causa médica" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Fecha de inicio")).toHaveValue("2026-10-01");
  });

  it("passes the return-to-review flag to the step from the URL", async () => {
    openDraft.mockResolvedValue(WITH_DETAILS);
    await renderPage({ step: "3", from: "review" });
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/new?step=4",
    );
  });

  it("keeps the normal back link without the flag", async () => {
    openDraft.mockResolvedValue(WITH_DETAILS);
    await renderPage({ step: "3" });
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/new?step=2",
    );
  });

  it("marks the saved subjects at step 2", async () => {
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      subjects: [{ grupoId: 1, asignaturaId: 10 }],
    });
    await renderPage({ step: "2" });
    expect(screen.getByRole("checkbox", { name: /MAT-101/ })).toBeChecked();
  });

  it("does not query enrollment at step 2 without dates, and asks for them", async () => {
    await renderPage({ step: "2" });
    expect(listEnrollmentFailSoft).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Indica primero las fechas de la ausencia para ver tus asignaturas.",
      ),
    ).toBeInTheDocument();
  });

  it("passes a degraded enrollment read on instead of failing", async () => {
    openDraft.mockResolvedValue(WITH_DETAILS);
    listEnrollmentFailSoft.mockResolvedValue({ data: [], degraded: true });
    await renderPage({ step: "2" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No pudimos cargar tus asignaturas.",
    );
  });

  it("shows only finalized documents at step 3 and skips enrollment", async () => {
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      documents: [
        {
          id: 1,
          nombreOriginal: "listo.pdf",
          tipo: "pdf",
          tamanoBytes: 10,
          estado: "valido",
        },
        {
          id: 2,
          nombreOriginal: "a-medias.pdf",
          tipo: null,
          tamanoBytes: 1,
          estado: "pendiente",
        },
      ],
    });
    await renderPage({ step: "3" });
    expect(heading("Documentos de respaldo")).toBeInTheDocument();
    expect(screen.getByText("listo.pdf")).toBeInTheDocument();
    expect(screen.queryByText("a-medias.pdf")).toBeNull();
    expect(screen.getByText("1 de 5 documentos")).toBeInTheDocument();
    expect(listEnrollmentFailSoft).not.toHaveBeenCalled();
  });

  it.each([{ step: "5" }, { step: "99" }])(
    "keeps %j on the last step that exists",
    async (params) => {
      await renderPage(params);
      expect(screen.getByText("Paso 4 de 4")).toBeInTheDocument();
      expect(heading("Revisa y presenta tu solicitud")).toBeInTheDocument();
    },
  );

  it("reviews the draft at step 4 with only the groups it holds", async () => {
    const other = {
      ...GROUP,
      grupoId: 2,
      asignaturaId: 11,
      asignaturaCodigo: "FIS-201",
    };
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      subjects: [{ grupoId: 1, asignaturaId: 10 }],
      documents: [
        {
          id: 1,
          nombreOriginal: "listo.pdf",
          tipo: "pdf",
          tamanoBytes: 10,
          estado: "valido",
        },
        {
          id: 2,
          nombreOriginal: "a-medias.pdf",
          tipo: null,
          tamanoBytes: 1,
          estado: "pendiente",
        },
      ],
    });
    listEnrollmentFailSoft.mockResolvedValue({
      data: [GROUP, other],
      degraded: false,
    });
    await renderPage({ step: "4" });

    expect(screen.getByText("Paso 4 de 4")).toBeInTheDocument();
    expect(screen.getByText("Causa médica")).toBeInTheDocument();
    expect(screen.getByText(/MAT-101/)).toBeInTheDocument();
    expect(screen.queryByText(/FIS-201/)).toBeNull();
    expect(screen.getByText("listo.pdf")).toBeInTheDocument();
    expect(screen.queryByText("a-medias.pdf")).toBeNull();
    expect(listEnrollmentFailSoft).toHaveBeenCalledWith(
      7,
      { from: "2026-10-01", to: "2026-10-03" },
      deps.schedule,
    );
  });

  it("reviews a draft without dates without reading enrollment", async () => {
    openDraft.mockResolvedValue({
      ...EMPTY,
      subjects: [{ grupoId: 1, asignaturaId: 10 }],
    });
    await renderPage({ step: "4" });
    expect(heading("Revisa y presenta tu solicitud")).toBeInTheDocument();
    expect(listEnrollmentFailSoft).not.toHaveBeenCalled();
  });

  // Unusable values resume at step 2 (details saved); a repeated parameter
  // uses its first value.
  it.each([{ step: "abc" }, { step: "0" }, { step: ["2", "3"] }])(
    "reads %j as step 2",
    async (params) => {
      openDraft.mockResolvedValue(WITH_DETAILS);
      await renderPage(params);
      expect(screen.getByText("Paso 2 de 4")).toBeInTheDocument();
    },
  );
});

describe("NewRequestPage enrollment nudge (RF-04, RN-21)", () => {
  const nudge = () =>
    screen.queryByRole("link", { name: "Declarar mis inscripciones" });

  it("points a student without enrollment to /enrollment and keeps step 1 usable", async () => {
    hasActive.mockResolvedValue(false);
    await renderPage();

    expect(nudge()).toHaveAttribute("href", "/enrollment");
    expect(heading("Causa y fechas")).toBeInTheDocument();
    expect(hasActive).toHaveBeenCalledWith(7);
  });

  it.each([[true], [null]])(
    "shows no notice when the answer is %s (enrolled, or the read degraded)",
    async (answer) => {
      hasActive.mockResolvedValue(answer);
      await renderPage();

      expect(nudge()).toBeNull();
      expect(heading("Causa y fechas")).toBeInTheDocument();
    },
  );

  it.each([
    [false, /Aún no tienes inscripciones/],
    [true, /ninguno de tus grupos tiene clase/i],
  ])(
    "gives step 2 the right empty state when enrolled is %s",
    async (enrolled, text) => {
      openDraft.mockResolvedValue(WITH_DETAILS);
      listEnrollmentFailSoft.mockResolvedValue({
        data: [],
        degraded: false,
        enrolled,
      });
      await renderPage({ step: "2" });

      expect(screen.getByText(text)).toBeInTheDocument();
    },
  );
});

describe("NewRequestPage fail-soft (A7)", () => {
  it("tells the student when the draft cannot be loaded, without throwing", async () => {
    openDraft.mockRejectedValue(new Error("db down"));
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No pudimos cargar tu borrador.",
    );
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("treats a failing port wiring the same way", async () => {
    openDraft.mockImplementation(() => {
      throw new Error("BLOB_READ_WRITE_TOKEN is not set");
    });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No pudimos cargar tu borrador.",
    );
  });
});

// FE-18 and FE-19 (RF-01, Table 13 row 15): the server reads "today" in Managua
// and passes it down. The recap tops steps 2 and 3, the notice sits on steps 1
// and 4, and none of it blocks anything.
describe("NewRequestPage dates recap and future-start notice (FE-18, FE-19)", () => {
  const NOTICE = /posterior a hoy/;
  const RECAP_LABEL = "Fechas de ausencia";

  function at(instant: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(instant));
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes today in Managua: 2026-11-20 05:30 UTC is still 2026-11-19, so a start of 2026-11-20 is ahead", async () => {
    at("2026-11-20T05:30:00Z");
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      fechaInicio: "2026-11-20",
      fechaFin: "2026-11-21",
    });
    await renderPage({ step: "1" });

    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
  });

  it("shows no notice for a start that is today in Managua, though it is tomorrow in UTC", async () => {
    at("2026-11-20T05:30:00Z");
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      fechaInicio: "2026-11-19",
      fechaFin: "2026-11-21",
    });
    await renderPage({ step: "1" });

    expect(screen.queryByRole("note")).toBeNull();
  });

  it("shows the notice at 2026-11-02 02:00 UTC for a start of 2026-11-02 (it is still 2026-11-01 in Managua)", async () => {
    at("2026-11-02T02:00:00Z");
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      fechaInicio: "2026-11-02",
      fechaFin: "2026-11-03",
    });
    await renderPage({ step: "1" });

    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
  });

  it("keeps step 1 usable with the notice shown", async () => {
    at("2026-11-02T18:00:00Z");
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      fechaInicio: "2026-11-10",
      fechaFin: "2026-11-12",
    });
    await renderPage({ step: "1" });

    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(screen.getByLabelText("Fecha de inicio")).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the recap at step 2 with the draft's dates and a way back to step 1", async () => {
    at("2026-11-02T18:00:00Z");
    openDraft.mockResolvedValue(WITH_DETAILS);
    await renderPage({ step: "2" });

    expect(screen.getByText(RECAP_LABEL)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Del jueves, 1 de octubre de 2026 al sábado, 3 de octubre de 2026",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar fechas" })).toHaveAttribute(
      "href",
      "/requests/new?step=1",
    );
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("shows the recap at step 3 too", async () => {
    at("2026-11-02T18:00:00Z");
    openDraft.mockResolvedValue(WITH_DETAILS);
    await renderPage({ step: "3" });

    expect(screen.getByText(RECAP_LABEL)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar fechas" })).toHaveAttribute(
      "href",
      "/requests/new?step=1",
    );
  });

  it.each(["2", "3"])(
    "carries the notice in the recap at step %s for a future start",
    async (step) => {
      at("2026-11-02T18:00:00Z");
      openDraft.mockResolvedValue({
        ...WITH_DETAILS,
        fechaInicio: "2026-11-10",
        fechaFin: "2026-11-12",
      });
      await renderPage({ step });

      expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
      expect(
        screen.getByText(
          "Del martes, 10 de noviembre de 2026 al jueves, 12 de noviembre de 2026",
        ),
      ).toBeInTheDocument();
    },
  );

  it("shows no recap at step 2 without dates, and asks for them instead", async () => {
    openDraft.mockResolvedValue({
      ...EMPTY,
      subjects: [{ grupoId: 1, asignaturaId: 10 }],
    });
    await renderPage({ step: "2" });

    expect(screen.queryByText(RECAP_LABEL)).toBeNull();
    expect(
      screen.getByText(
        "Indica primero las fechas de la ausencia para ver tus asignaturas.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no recap at step 3 when the dates are not usable (the end is before the start)", async () => {
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      fechaInicio: "2026-10-05",
      fechaFin: "2026-10-03",
    });
    await renderPage({ step: "3" });

    expect(screen.queryByText(RECAP_LABEL)).toBeNull();
    expect(heading("Documentos de respaldo")).toBeInTheDocument();
  });

  it("puts the recap on steps 2 and 3 only: no recap on step 1 or on the review", async () => {
    openDraft.mockResolvedValue(WITH_DETAILS);

    await renderPage({ step: "1" });
    expect(screen.queryByText(RECAP_LABEL)).toBeNull();
    cleanup();

    await renderPage({ step: "4" });
    expect(screen.queryByText(RECAP_LABEL)).toBeNull();
  });

  it("repeats the notice under the period on the review and keeps submit enabled", async () => {
    at("2026-11-02T18:00:00Z");
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      fechaInicio: "2026-11-10",
      fechaFin: "2026-11-12",
    });
    await renderPage({ step: "4" });

    const details = within(
      screen.getByRole("region", { name: "Causa y fechas" }),
    );
    expect(details.getByRole("note")).toHaveTextContent(NOTICE);
    expect(
      screen.getByRole("button", { name: "Presentar solicitud" }),
    ).toBeEnabled();
  });

  it("shows no notice on the review for a past start", async () => {
    at("2026-11-02T18:00:00Z");
    openDraft.mockResolvedValue(WITH_DETAILS);
    await renderPage({ step: "4" });

    expect(screen.queryByRole("note")).toBeNull();
  });
});
