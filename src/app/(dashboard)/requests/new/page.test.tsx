import { screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  renderIntl,
} from "@/app/(dashboard)/requests/new/test-support";
import type { Draft } from "@/lib/data/solicitudes";
import { rolesSolicitantes } from "@/lib/auth/permissions";

const { requireRole, openDraft, listEnrollmentFailSoft } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  openDraft: vi.fn(),
  listEnrollmentFailSoft: vi.fn(),
}));
const deps = vi.hoisted(() => ({
  store: { id: "store" },
  schedule: { id: "schedule" },
}));

vi.mock("@/lib/auth/dal", () => ({ requireRole }));
vi.mock("@/lib/data/solicitudes", () => ({ openDraft }));
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
vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  saveDetailsAction: vi.fn(),
  saveSubjectsAction: vi.fn(),
  finalizeDocumentAction: vi.fn(),
  removeDocumentAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

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
    .mockResolvedValue({ data: [GROUP], degraded: false });
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

  it("marks the saved subjects at step 2", async () => {
    openDraft.mockResolvedValue({
      ...WITH_DETAILS,
      subjects: [{ grupoId: 1, asignaturaId: 10 }],
    });
    await renderPage({ step: "2" });
    expect(screen.getByRole("checkbox", { name: /MAT-101/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
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

  it.each([{ step: "4" }, { step: "99" }])(
    "keeps %j on the last step that exists",
    async (params) => {
      await renderPage(params);
      expect(screen.getByText("Paso 3 de 4")).toBeInTheDocument();
    },
  );

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
