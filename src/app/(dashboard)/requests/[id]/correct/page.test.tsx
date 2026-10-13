import { screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  renderIntl,
} from "@/app/(dashboard)/requests/new/test-support";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import type { Draft } from "@/lib/data/solicitudes";

const { requireRole, getLiveDraft, openDraft, listEnrollmentFailSoft } =
  vi.hoisted(() => ({
    requireRole: vi.fn(),
    getLiveDraft: vi.fn(),
    openDraft: vi.fn(),
    listEnrollmentFailSoft: vi.fn(),
  }));
const deps = vi.hoisted(() => ({
  store: { id: "store" },
  schedule: { id: "schedule" },
}));

vi.mock("@/lib/auth/dal", () => ({ requireRole }));
vi.mock("@/lib/data/solicitudes", () => ({ getLiveDraft, openDraft }));
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
