import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  renderIntl,
} from "@/app/(dashboard)/requests/new/test-support";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import type { Draft } from "@/lib/data/solicitudes";
import { DEFAULT_PARAMETERS } from "@/lib/parameters/registry";

const {
  requireRole,
  getLiveDraft,
  openDraft,
  getCorrectionReason,
  getReturnedDocumentIds,
  listEnrollmentFailSoft,
  getNormativeParameters,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getLiveDraft: vi.fn(),
  openDraft: vi.fn(),
  getCorrectionReason: vi.fn(),
  getReturnedDocumentIds: vi.fn(),
  listEnrollmentFailSoft: vi.fn(),
  getNormativeParameters: vi.fn(),
}));
const deps = vi.hoisted(() => ({
  store: { id: "store" },
  schedule: { id: "schedule" },
}));

vi.mock("@/lib/auth/dal", () => ({ requireRole }));
vi.mock("@/lib/data/solicitudes", () => ({ getLiveDraft, openDraft }));
vi.mock("@/lib/data/student-requests", () => ({
  getCorrectionReason,
  getReturnedDocumentIds,
}));
vi.mock("@/lib/data/enrollment", () => ({ listEnrollmentFailSoft }));
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
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  saveDetailsAction: vi.fn(),
  saveSubjectsAction: vi.fn(),
  finalizeDocumentAction: vi.fn(),
  removeDocumentAction: vi.fn(),
  submitRequestAction: vi.fn(),
  discardDraftAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/requests/[id]/correct/actions", () => ({
  saveCorrectionDetailsAction: vi.fn(),
  saveCorrectionSubjectsAction: vi.fn(),
  finalizeCorrectionDocumentAction: vi.fn(),
  removeCorrectionDocumentAction: vi.fn(),
  resubmitCorrectionAction: vi.fn(),
}));

import CorrectRequestPage from "@/app/(dashboard)/requests/[id]/correct/page";
import { FlowSteps } from "@/app/(dashboard)/requests/new/flow-steps";

const RETURNED: Draft = {
  id: 31,
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  actualizadoEn: new Date("2026-10-06T12:00:00Z"),
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
  id = "31",
  searchParams: Record<string, string | string[]> = {},
) {
  renderIntl(
    await CorrectRequestPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

const heading = (name: string) =>
  screen.getByRole("heading", { level: 2, name });

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ sub: "7", rol: "estudiante" });
  getLiveDraft.mockReset().mockResolvedValue(RETURNED);
  openDraft.mockReset();
  getCorrectionReason.mockReset().mockResolvedValue(null);
  getReturnedDocumentIds.mockReset().mockResolvedValue([]);
  listEnrollmentFailSoft
    .mockReset()
    .mockResolvedValue({ data: [GROUP], degraded: false });
  getNormativeParameters.mockReset().mockResolvedValue({
    values: DEFAULT_PARAMETERS,
    fallback: [],
    degraded: false,
  });
  vi.mocked(FlowSteps).mockClear();
});

describe("CorrectRequestPage limits (NP-17, A13)", () => {
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

  it("reads nothing when the request cannot be read", async () => {
    getLiveDraft.mockRejectedValue(new Error("db down"));

    await renderPage();

    expect(getNormativeParameters).not.toHaveBeenCalled();
  });
});

describe("CorrectRequestPage guard (RNF-01)", () => {
  it("allows exactly the requesting roles", async () => {
    await renderPage();
    expect(requireRole).toHaveBeenCalledWith(...rolesSolicitantes);
  });

  it("reads nothing when the role guard redirects", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      CorrectRequestPage({
        params: Promise.resolve({ id: "31" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(getLiveDraft).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-3", "1.5", "31abc", "99999999999999999999"])(
    "a malformed id (%s) is not found and reads nothing",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(getLiveDraft).not.toHaveBeenCalled();
    },
  );

  it("loads the session user's own returned request by id, never creating a draft", async () => {
    await renderPage();

    expect(getLiveDraft).toHaveBeenCalledTimes(1);
    const [userId, now, target] = getLiveDraft.mock.calls[0];
    expect(userId).toBe(7);
    expect(now).toBeInstanceOf(Date);
    expect(target).toEqual({ kind: "correction", solicitudId: 31 });
    expect(openDraft).not.toHaveBeenCalled();
  });

  it("a foreign, unknown or not returned request is the same not found", async () => {
    getLiveDraft.mockResolvedValue(null);

    await expect(renderPage("31")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(renderPage("32")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers with a status message, not an error screen, when the read fails (A7)", async () => {
    getLiveDraft.mockRejectedValue(new Error("db down"));

    await renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "No pudimos cargar tu solicitud.",
    );
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

describe("CorrectRequestPage steps (RF-08 a)", () => {
  it("opens at step 1 with the correction header, the saved values and a way back", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Corregir solicitud" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a la solicitud" }),
    ).toHaveAttribute("href", "/requests/31");
    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
    expect(heading("Causa y fechas")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Causa médica" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Fecha de fin")).toHaveValue("2026-10-03");
  });

  it("keeps the stepper inside the correction path, not the new request flow", async () => {
    await renderPage("31", { step: "3" });

    const links = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(links).toContain("/requests/31/correct?step=1");
    expect(links).toContain("/requests/31/correct?step=2");
    expect(links.some((href) => href?.startsWith("/requests/new"))).toBe(false);
  });

  it("step 2 reads enrollment for the stored dates and marks the held subjects", async () => {
    await renderPage("31", { step: "2" });

    expect(listEnrollmentFailSoft).toHaveBeenCalledWith(
      7,
      { from: "2026-10-01", to: "2026-10-03" },
      deps.schedule,
    );
    expect(screen.getByRole("checkbox", { name: /MAT-101/ })).toBeChecked();
  });

  it("never nudges toward enrollment on a correction", async () => {
    await renderPage("31", { step: "3" });

    expect(
      screen.queryByRole("link", { name: "Declarar mis inscripciones" }),
    ).toBeNull();
  });

  it("step 3 lists only finalized documents and skips enrollment", async () => {
    await renderPage("31", { step: "3" });

    expect(heading("Documentos de respaldo")).toBeInTheDocument();
    expect(screen.getByText("listo.pdf")).toBeInTheDocument();
    expect(screen.queryByText("a-medias.pdf")).toBeNull();
    expect(listEnrollmentFailSoft).not.toHaveBeenCalled();
  });

  it("step 4 reviews the request and offers resubmit, with no discard", async () => {
    await renderPage("31", { step: "4" });

    expect(heading("Revisa y presenta tu solicitud")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reenviar solicitud" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Descartar borrador" }),
    ).toBeNull();
    expect(screen.getByText("MAT-101 · Cálculo I")).toBeInTheDocument();
  });

  it("honours the return-to-review flag inside the correction path", async () => {
    await renderPage("31", { step: "3", from: "review" });

    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/31/correct?step=4",
    );
  });
});

const BANNER_TITLE = "Por qué se devolvió tu solicitud";
const ILEGIBLE = {
  motivo: "documento_ilegible",
  texto: "Adjunte una copia legible del certificado.",
};
const FECHA = {
  motivo: "fecha_incorrecta",
  texto: "La fecha no coincide con el certificado.",
};

describe("CorrectRequestPage guided start (RN-17, SR-17)", () => {
  it.each([
    ["documento_ilegible", "Paso 3 de 4", "Documentos de respaldo"],
    ["fecha_alterada", "Paso 3 de 4", "Documentos de respaldo"],
    ["fecha_incorrecta", "Paso 1 de 4", "Causa y fechas"],
  ])(
    "opens a %s correction at %s without an explicit step",
    async (motivo, position, title) => {
      getCorrectionReason.mockResolvedValue({ motivo, texto: "Mensaje." });

      await renderPage();

      expect(screen.getByText(position)).toBeInTheDocument();
      expect(heading(title)).toBeInTheDocument();
    },
  );

  it("reads the reason of the session user's own request, by id", async () => {
    getCorrectionReason.mockResolvedValue(ILEGIBLE);

    await renderPage();

    expect(getCorrectionReason).toHaveBeenCalledTimes(1);
    expect(getCorrectionReason).toHaveBeenCalledWith(7, 31);
  });

  it("lets an explicit ?step= win over the reason", async () => {
    getCorrectionReason.mockResolvedValue(ILEGIBLE);

    await renderPage("31", { step: "2" });

    expect(screen.getByText("Paso 2 de 4")).toBeInTheDocument();
    expect(heading("Asignaturas afectadas")).toBeInTheDocument();
  });

  it("opens at step 1 with no banner when the reason read fails, and still renders the correction", async () => {
    getCorrectionReason.mockRejectedValue(new Error("db down"));

    await renderPage();

    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
    expect(heading("Causa y fechas")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("opens at step 1 with no banner when there is no reason", async () => {
    getCorrectionReason.mockResolvedValue(null);

    await renderPage();

    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("opens at step 1 for a code outside the RN-17 list, keeping the message", async () => {
    getCorrectionReason.mockResolvedValue({
      motivo: "otro_motivo",
      texto: "Revise todo.",
    });

    await renderPage();

    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: BANNER_TITLE }),
    ).toHaveTextContent("Revise todo.");
  });

  it.each(["1", "2", "3", "4"])(
    "shows the reason label and the secretary's message on step %s",
    async (step) => {
      getCorrectionReason.mockResolvedValue(ILEGIBLE);

      await renderPage("31", { step });

      const banner = screen.getByRole("status", { name: BANNER_TITLE });
      expect(banner).toHaveTextContent("El documento no es legible");
      expect(banner).toHaveTextContent(ILEGIBLE.texto);
    },
  );

  it("labels each RN-17 code with the student detail's wording", async () => {
    getCorrectionReason.mockResolvedValue(FECHA);

    await renderPage();

    expect(
      screen.getByRole("status", { name: BANNER_TITLE }),
    ).toHaveTextContent("La fecha no coincide con el documento");
  });

  it("locks nothing: the stepper links all four steps whichever step it opens at", async () => {
    getCorrectionReason.mockResolvedValue(ILEGIBLE);

    await renderPage();

    // Opened at step 3: the other three are links, step 3 is the current one.
    const links = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    for (const step of [1, 2, 4]) {
      expect(links).toContain(`/requests/31/correct?step=${step}`);
    }
    expect(links).not.toContain("/requests/31/correct?step=3");
    expect(screen.getByText("Paso 3 de 4")).toBeInTheDocument();
  });
});

// FE-16 (RF-08 a, c, D9): the page reads the ids of the version just returned
// next to the draft and the reason, and the steps use them to mark each file.
describe("CorrectRequestPage file marks (FE-16)", () => {
  const WITH_ADDED: Draft = {
    ...RETURNED,
    documents: [
      ...RETURNED.documents,
      {
        id: 3,
        nombreOriginal: "nuevo.png",
        tipo: "png",
        tamanoBytes: 5,
        estado: "valido",
      },
    ],
  };
  const rowOf = (name: string) =>
    screen
      .getAllByText(name)
      .map((element) => element.closest("li"))
      .find((item): item is HTMLLIElement => item !== null) as HTMLElement;

  it("reads the returned ids of the session user's own request, by id", async () => {
    await renderPage();

    expect(getReturnedDocumentIds).toHaveBeenCalledTimes(1);
    expect(getReturnedDocumentIds).toHaveBeenCalledWith(7, 31);
  });

  it("starts the read together with the draft and the reason, not after them", async () => {
    let release: (value: Draft) => void = () => {};
    getLiveDraft.mockReturnValue(
      new Promise<Draft>((resolve) => {
        release = resolve;
      }),
    );
    const rendered = CorrectRequestPage({
      params: Promise.resolve({ id: "31" }),
      searchParams: Promise.resolve({}),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getReturnedDocumentIds).toHaveBeenCalledWith(7, 31);
    expect(getCorrectionReason).toHaveBeenCalledWith(7, 31);

    release(RETURNED);
    renderIntl(await rendered);
  });

  it("marks the kept file Anterior and the added file Nuevo on step 3", async () => {
    getLiveDraft.mockResolvedValue(WITH_ADDED);
    getReturnedDocumentIds.mockResolvedValue([1]);

    await renderPage("31", { step: "3" });

    expect(rowOf("listo.pdf")).toHaveTextContent("Anterior");
    expect(rowOf("nuevo.png")).toHaveTextContent("Nuevo");
  });

  it("marks them on the review step and in the resubmit dialog too", async () => {
    getLiveDraft.mockResolvedValue(WITH_ADDED);
    getReturnedDocumentIds.mockResolvedValue([1]);

    await renderPage("31", { step: "4" });

    expect(rowOf("listo.pdf")).toHaveTextContent("Anterior");
    expect(rowOf("nuevo.png")).toHaveTextContent("Nuevo");
    await userEvent.click(
      screen.getByRole("button", { name: "Reenviar solicitud" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["listo.pdfAnterior", "nuevo.pngNuevo"]);
  });

  it("marks every file Nuevo when the returned version listed none", async () => {
    getReturnedDocumentIds.mockResolvedValue([]);

    await renderPage("31", { step: "3" });

    expect(rowOf("listo.pdf")).toHaveTextContent("Nuevo");
  });

  it("shows the names with no mark, and still renders, when the ids cannot be read", async () => {
    getReturnedDocumentIds.mockRejectedValue(new Error("db down"));

    await renderPage("31", { step: "3" });

    expect(heading("Documentos de respaldo")).toBeInTheDocument();
    expect(screen.getByText("listo.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo")).toBeNull();
    expect(screen.queryByText("Anterior")).toBeNull();
  });

  it("reads nothing from the document route to name the files", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    getReturnedDocumentIds.mockResolvedValue([1]);

    await renderPage("31", { step: "4" });

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// FE-18 and FE-19 (RF-01): the correction reuses the four steps, so it gets the
// same recap and notice, with the dates of the returned request and the
// server's Managua "today".
describe("CorrectRequestPage dates recap and future-start notice (FE-18, FE-19)", () => {
  const NOTICE = /posterior a hoy/;
  const RECAP_LABEL = "Fechas de ausencia";
  const FUTURE = {
    ...RETURNED,
    fechaInicio: "2026-11-10",
    fechaFin: "2026-11-12",
  };

  function at(instant: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(instant));
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes today in Managua: 2026-11-20 05:30 UTC is still 2026-11-19, so a start of 2026-11-20 is ahead", async () => {
    at("2026-11-20T05:30:00Z");
    getLiveDraft.mockResolvedValue({
      ...RETURNED,
      fechaInicio: "2026-11-20",
      fechaFin: "2026-11-21",
    });
    await renderPage("31", { step: "1" });

    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
  });

  it("shows the notice at 2026-11-02 02:00 UTC for a start of 2026-11-02", async () => {
    at("2026-11-02T02:00:00Z");
    getLiveDraft.mockResolvedValue({
      ...RETURNED,
      fechaInicio: "2026-11-02",
      fechaFin: "2026-11-03",
    });
    await renderPage("31", { step: "1" });

    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
  });

  it("shows no notice for a start that is today in Managua", async () => {
    at("2026-11-20T05:30:00Z");
    getLiveDraft.mockResolvedValue({
      ...RETURNED,
      fechaInicio: "2026-11-19",
      fechaFin: "2026-11-21",
    });
    await renderPage("31", { step: "1" });

    expect(screen.queryByRole("note")).toBeNull();
  });

  it.each(["2", "3"])(
    "shows the request's current dates in the recap at step %s, with the way back inside the correction",
    async (step) => {
      at("2026-11-02T18:00:00Z");
      await renderPage("31", { step });

      expect(screen.getByText(RECAP_LABEL)).toBeInTheDocument();
      expect(
        screen.getByText(
          "Del jueves, 1 de octubre de 2026 al sábado, 3 de octubre de 2026",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Editar fechas" }),
      ).toHaveAttribute("href", "/requests/31/correct?step=1");
      expect(screen.queryByRole("note")).toBeNull();
    },
  );

  it.each(["2", "3"])(
    "carries the notice in the recap at step %s for a future start",
    async (step) => {
      at("2026-11-02T18:00:00Z");
      getLiveDraft.mockResolvedValue(FUTURE);
      await renderPage("31", { step });

      expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
    },
  );

  it("repeats the notice under the period on the review and keeps the resubmit enabled", async () => {
    at("2026-11-02T18:00:00Z");
    getLiveDraft.mockResolvedValue(FUTURE);
    await renderPage("31", { step: "4" });

    const details = within(
      screen.getByRole("region", { name: "Causa y fechas" }),
    );
    expect(details.getByRole("note")).toHaveTextContent(NOTICE);
    expect(
      screen.getByRole("button", { name: "Reenviar solicitud" }),
    ).toBeEnabled();
  });

  it("keeps step 1 usable with the notice shown", async () => {
    at("2026-11-02T18:00:00Z");
    getLiveDraft.mockResolvedValue(FUTURE);
    await renderPage("31", { step: "1" });

    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
