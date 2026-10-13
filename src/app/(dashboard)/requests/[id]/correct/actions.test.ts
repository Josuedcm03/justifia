// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { createFakeIntakeDeps } from "@/lib/intake/fakes";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireRole: vi.fn(),
  getLiveDraft: vi.fn(),
  saveDraftDetails: vi.fn(),
  saveDraftSubjects: vi.fn(),
  listEligibleGroups: vi.fn(),
  finalizeDocument: vi.fn(),
  removeDocument: vi.fn(),
  resubmitCorrection: vi.fn(),
  getIntakeDeps: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/auth/dal", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/data/solicitudes", () => ({
  getLiveDraft: h.getLiveDraft,
  saveDraftDetails: h.saveDraftDetails,
  saveDraftSubjects: h.saveDraftSubjects,
}));
vi.mock("@/lib/data/enrollment", () => ({
  listEligibleGroups: h.listEligibleGroups,
}));
vi.mock("@/lib/data/documentos", () => ({
  finalizeDocument: h.finalizeDocument,
  removeDocument: h.removeDocument,
}));
vi.mock("@/lib/data/solicitud-correction", () => ({
  resubmitCorrection: h.resubmitCorrection,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: h.getIntakeDeps }));

import {
  finalizeCorrectionDocumentAction,
  removeCorrectionDocumentAction,
  resubmitCorrectionAction,
  saveCorrectionDetailsAction,
  saveCorrectionSubjectsAction,
} from "./actions";

const USER = 7;
const REQUEST = 31;
const TARGET = { kind: "correction", solicitudId: REQUEST } as const;
// 2026-10-07 09:00 in Managua (UTC-6).
const NOW = new Date("2026-10-07T15:00:00.000Z");
const GROUP = {
  grupoId: 21,
  asignaturaId: 10,
  asignaturaCodigo: "A-10",
  asignaturaNombre: "Subject 10",
  periodo: "2026-II",
  numeroGrupo: "01",
  docenteNombre: null,
};
const notCorrectable = {
  ok: false,
  errors: [{ field: "form", key: "intake.errors.not_correctable" }],
};

let deps: ReturnType<typeof createFakeIntakeDeps>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  for (const mock of Object.values(h)) mock.mockReset();
  h.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  h.requireRole.mockResolvedValue({
    sub: String(USER),
    login: "ana",
    rol: "estudiante",
    nombre: "Ana",
  });
  deps = createFakeIntakeDeps();
  h.getIntakeDeps.mockReturnValue(deps);
  h.getLiveDraft.mockResolvedValue({
    id: REQUEST,
    causa: "medica",
    fechaInicio: "2026-08-20",
    fechaFin: "2026-08-28",
    subjects: [],
    documents: [],
  });
  h.listEligibleGroups.mockResolvedValue([GROUP]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("correction actions: authorization (RNF-01)", () => {
  const calls: [string, () => Promise<unknown>][] = [
    [
      "saveCorrectionDetailsAction",
      () => saveCorrectionDetailsAction(REQUEST, {}),
    ],
    [
      "saveCorrectionSubjectsAction",
      () => saveCorrectionSubjectsAction(REQUEST, { selections: [] }),
    ],
    [
      "finalizeCorrectionDocumentAction",
      () =>
        finalizeCorrectionDocumentAction(REQUEST, {
          pathname: "a",
          nombreOriginal: "a",
        }),
    ],
    [
      "removeCorrectionDocumentAction",
      () => removeCorrectionDocumentAction(REQUEST, 11),
    ],
    ["resubmitCorrectionAction", () => resubmitCorrectionAction(REQUEST)],
  ];

  it.each(calls)(
    "%s re-checks the student role and touches nothing when denied",
    async (_name, call) => {
      h.requireRole.mockImplementation(async () => {
        throw new Error(`REDIRECT:${ACCESS_DENIED_PATH}`);
      });

      await expect(call()).rejects.toThrow(`REDIRECT:${ACCESS_DENIED_PATH}`);

      expect(h.requireRole).toHaveBeenCalledWith("estudiante");
      for (const touched of [
        h.getLiveDraft,
        h.saveDraftDetails,
        h.saveDraftSubjects,
        h.finalizeDocument,
        h.removeDocument,
        h.resubmitCorrection,
        h.listEligibleGroups,
      ]) {
        expect(touched).not.toHaveBeenCalled();
      }
    },
  );

  it.each([["abc"], [0], [-3], [1.5], [null], [undefined]])(
    "a request id of %j is refused before any data is read",
    async (id) => {
      for (const call of [
        () => saveCorrectionDetailsAction(id, {}),
        () => saveCorrectionSubjectsAction(id, { selections: [] }),
        () => finalizeCorrectionDocumentAction(id, {}),
        () => removeCorrectionDocumentAction(id, 11),
        () => resubmitCorrectionAction(id),
      ]) {
        expect(await call()).toEqual(notCorrectable);
      }
      for (const touched of [
        h.getLiveDraft,
        h.saveDraftDetails,
        h.finalizeDocument,
        h.removeDocument,
        h.resubmitCorrection,
      ]) {
        expect(touched).not.toHaveBeenCalled();
      }
    },
  );
});

describe("saveCorrectionDetailsAction (step 1)", () => {
  const old = {
    causa: "medica",
    fechaInicio: "2026-08-20",
    fechaFin: "2026-08-28",
  };

  it("saves in place for the session user, accepting an end date 40 days old (RN-23 not re-applied)", async () => {
    h.saveDraftDetails.mockResolvedValue(true);

    const result = await saveCorrectionDetailsAction(REQUEST, {
      ...old,
      estudianteId: 999,
    });

    expect(result).toEqual({ ok: true });
    expect(h.saveDraftDetails).toHaveBeenCalledWith(USER, NOW, old, TARGET);
  });

  it("RN-05 still applies and nothing is saved", async () => {
    const result = await saveCorrectionDetailsAction(REQUEST, {
      ...old,
      fechaInicio: "2026-08-28",
      fechaFin: "2026-08-20",
    });

    expect(result).toEqual({
      ok: false,
      errors: [{ field: "fechaFin", key: "intake.errors.end_before_start" }],
    });
    expect(h.saveDraftDetails).not.toHaveBeenCalled();
  });

  it("refuses a request that is not the caller's returned one", async () => {
    h.saveDraftDetails.mockResolvedValue(false);

    expect(await saveCorrectionDetailsAction(REQUEST, old)).toEqual(
      notCorrectable,
    );
  });
});

describe("saveCorrectionSubjectsAction (step 2)", () => {
  it("resolves the groups for the stored dates and saves them against the returned request", async () => {
    h.saveDraftSubjects.mockResolvedValue(true);

    const result = await saveCorrectionSubjectsAction(REQUEST, {
      selections: [{ asignaturaId: 10, grupoId: null }],
    });

    expect(result).toEqual({ ok: true });
    expect(h.getLiveDraft).toHaveBeenCalledWith(USER, NOW, TARGET);
    expect(h.listEligibleGroups).toHaveBeenCalledWith(
      USER,
      { from: "2026-08-20", to: "2026-08-28" },
      deps.schedule,
    );
    expect(h.saveDraftSubjects).toHaveBeenCalledWith(USER, NOW, [21], TARGET);
  });

  it("answers not_correctable when the request is not the caller's returned one", async () => {
    h.getLiveDraft.mockResolvedValue(null);

    expect(
      await saveCorrectionSubjectsAction(REQUEST, { selections: [] }),
    ).toEqual(notCorrectable);
    expect(h.saveDraftSubjects).not.toHaveBeenCalled();
  });
});

describe("correction documents (step 3)", () => {
  it("finalizes against the returned request for the session user", async () => {
    h.finalizeDocument.mockResolvedValue({ ok: true, documentId: 12 });

    const result = await finalizeCorrectionDocumentAction(REQUEST, {
      pathname: "intake/31/x.png",
      nombreOriginal: "foto.png",
      userId: 999,
    });

    expect(result).toEqual({ ok: true, documentId: 12 });
    expect(h.finalizeDocument).toHaveBeenCalledWith(
      {
        userId: USER,
        pathname: "intake/31/x.png",
        nombreOriginal: "foto.png",
        target: TARGET,
      },
      deps.store,
    );
  });

  it("removes (or retires) a document of the returned request", async () => {
    h.removeDocument.mockResolvedValue({ ok: true });

    expect(await removeCorrectionDocumentAction(REQUEST, 11)).toEqual({
      ok: true,
    });
    expect(h.removeDocument).toHaveBeenCalledWith(
      { userId: USER, documentId: 11, target: TARGET },
      deps.store,
    );
  });
});

describe("resubmitCorrectionAction (step 4)", () => {
  it("resubmits for the session user and goes to the request with the corrected flag", async () => {
    h.resubmitCorrection.mockResolvedValue({ ok: true });

    await expect(resubmitCorrectionAction(REQUEST)).rejects.toThrow(
      `REDIRECT:/requests/${REQUEST}?corrected=1`,
    );

    expect(h.resubmitCorrection).toHaveBeenCalledWith({
      userId: USER,
      solicitudId: REQUEST,
      now: NOW,
      schedule: deps.schedule,
    });
  });

  it("returns every invalid field together, keeping the subject they concern, and does not redirect", async () => {
    h.resubmitCorrection.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [
        { field: "fechaFin", code: "end_before_start" },
        { field: "subjects", code: "subject_not_eligible", asignaturaId: 10 },
        { field: "documents", code: "too_many_documents" },
      ],
    });

    expect(await resubmitCorrectionAction(REQUEST)).toEqual({
      ok: false,
      errors: [
        { field: "fechaFin", key: "intake.errors.end_before_start" },
        {
          field: "subjects",
          key: "intake.errors.subject_not_eligible",
          asignaturaId: 10,
        },
        { field: "documents", key: "intake.errors.too_many_documents" },
      ],
    });
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["conflict", "submit_conflict"],
    ["not_found", "not_correctable"],
  ])("maps %s to the %s message", async (reason, code) => {
    h.resubmitCorrection.mockResolvedValue({ ok: false, reason });

    expect(await resubmitCorrectionAction(REQUEST)).toEqual({
      ok: false,
      errors: [{ field: "form", key: `intake.errors.${code}` }],
    });
    expect(h.redirect).not.toHaveBeenCalled();
  });
});
