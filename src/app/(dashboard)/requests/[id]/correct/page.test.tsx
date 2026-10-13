import { screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  renderIntl,
} from "@/app/(dashboard)/requests/new/test-support";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import type { Draft } from "@/lib/data/solicitudes";

const {
  requireRole,
  getLiveDraft,
  openDraft,
  getCorrectionReason,
  listEnrollmentFailSoft,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getLiveDraft: vi.fn(),
  openDraft: vi.fn(),
  getCorrectionReason: vi.fn(),
  listEnrollmentFailSoft: vi.fn(),
}));
const deps = vi.hoisted(() => ({
  store: { id: "store" },
  schedule: { id: "schedule" },
}));

vi.mock("@/lib/auth/dal", () => ({ requireRole }));
vi.mock("@/lib/data/solicitudes", () => ({ getLiveDraft, openDraft }));
vi.mock("@/lib/data/student-requests", () => ({ getCorrectionReason }));
vi.mock("@/lib/data/enrollment", () => ({ listEnrollmentFailSoft }));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: () => deps }));
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
  listEnrollmentFailSoft
    .mockReset()
    .mockResolvedValue({ data: [GROUP], degraded: false });
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
