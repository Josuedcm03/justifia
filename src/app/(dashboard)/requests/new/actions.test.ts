// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { CONSENT_VERSION } from "@/lib/intake/consent";
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
  discardDraft: vi.fn(),
  submitDraft: vi.fn(),
  listEligibleGroups: vi.fn(),
  finalizeDocument: vi.fn(),
  removeDocument: vi.fn(),
  getIntakeDeps: vi.fn(),
  getExtractionDeps: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/auth/dal", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/data/solicitudes", () => ({
  getLiveDraft: h.getLiveDraft,
  saveDraftDetails: h.saveDraftDetails,
  saveDraftSubjects: h.saveDraftSubjects,
  discardDraft: h.discardDraft,
  submitDraft: h.submitDraft,
}));
vi.mock("@/lib/data/enrollment", () => ({
  listEligibleGroups: h.listEligibleGroups,
}));
vi.mock("@/lib/data/documentos", () => ({
  finalizeDocument: h.finalizeDocument,
  removeDocument: h.removeDocument,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: h.getIntakeDeps }));
vi.mock("@/lib/extraction/deps", () => ({
  getExtractionDeps: h.getExtractionDeps,
}));

import {
  discardDraftAction,
  finalizeDocumentAction,
  removeDocumentAction,
  saveDetailsAction,
  saveSubjectsAction,
  submitRequestAction,
} from "./actions";

const USER = 7;
const DRAFT = 4;
/** The intake flow edits the caller's draft, never a returned request. */
const TARGET = { kind: "draft" } as const;
// 2026-10-07 09:00 in Managua (UTC-6).
const NOW = new Date("2026-10-07T15:00:00.000Z");

/** The payload the review step sends when the box is checked (RC-5). */
const CONSENTED = { consentVersion: CONSENT_VERSION };

const G1: Group = group(21, 10); // subject 10: one group
const G2A: Group = group(30, 11); // subject 11: two groups
const G2B: Group = group(31, 11);

type Group = ReturnType<typeof group>;

function group(grupoId: number, asignaturaId: number) {
  return {
    grupoId,
    asignaturaId,
    asignaturaCodigo: `A-${asignaturaId}`,
    asignaturaNombre: `Subject ${asignaturaId}`,
    periodo: "2026-II",
    numeroGrupo: "01",
    docenteNombre: null,
  };
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: DRAFT,
    causa: "medica",
    fechaInicio: "2026-10-01",
    fechaFin: "2026-10-03",
    actualizadoEn: NOW,
    subjects: [{ grupoId: 21, asignaturaId: 10 }],
    documents: [
      {
        id: 11,
        nombreOriginal: "constancia.pdf",
        tipo: "pdf",
        tamanoBytes: 2048,
        estado: "valido",
      },
    ],
    ...overrides,
  };
}

const noDraft = {
  ok: false,
  errors: [{ field: "form", key: "intake.errors.no_draft" }],
};

let deps: ReturnType<typeof createFakeIntakeDeps>;

describe("intake actions", () => {
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
    h.getExtractionDeps.mockReturnValue({ queue: { enqueue: h.enqueue } });
    h.getLiveDraft.mockResolvedValue(draft());
    h.listEligibleGroups.mockResolvedValue([G1, G2A, G2B]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("authorization (RNF-01)", () => {
    const calls: [string, () => Promise<unknown>][] = [
      ["saveDetailsAction", () => saveDetailsAction({})],
      ["saveSubjectsAction", () => saveSubjectsAction({ selections: [] })],
      [
        "finalizeDocumentAction",
        () => finalizeDocumentAction({ pathname: "a", nombreOriginal: "a" }),
      ],
      ["removeDocumentAction", () => removeDocumentAction(11)],
      ["discardDraftAction", () => discardDraftAction()],
      ["submitRequestAction", () => submitRequestAction(CONSENTED)],
      [
        "submitRequestAction with an invalid payload",
        () => submitRequestAction(null),
      ],
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
          h.discardDraft,
          h.submitDraft,
          h.finalizeDocument,
          h.removeDocument,
          h.listEligibleGroups,
        ]) {
          expect(touched).not.toHaveBeenCalled();
        }
      },
    );

    it("another student's document id looks exactly like a nonexistent one", async () => {
      h.removeDocument.mockResolvedValue({ ok: false, reason: "not_found" });

      const foreign = await removeDocumentAction(999);
      const missing = await removeDocumentAction(1000);

      expect(foreign).toEqual(missing);
      expect(foreign).toEqual({
        ok: false,
        errors: [{ field: "documents", key: "intake.errors.not_found" }],
      });
      expect(h.removeDocument).toHaveBeenNthCalledWith(
        1,
        { userId: USER, documentId: 999, target: TARGET },
        deps.store,
      );
    });
  });

  describe("saveDetailsAction (step 1)", () => {
    const valid = {
      causa: "medica",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
    };

    it("saves for the session user and ignores any identity in the payload", async () => {
      h.saveDraftDetails.mockResolvedValue(true);

      const result = await saveDetailsAction({
        ...valid,
        estudianteId: 999,
        estado: "pendiente",
      });

      expect(result).toEqual({ ok: true });
      expect(h.saveDraftDetails).toHaveBeenCalledWith(USER, NOW, valid, TARGET);
    });

    it("returns every invalid field and saves nothing", async () => {
      const result = await saveDetailsAction({
        causa: "vacaciones",
        fechaInicio: "2026-10-10",
        fechaFin: "2026-10-09",
      });

      expect(result).toEqual({
        ok: false,
        errors: [
          { field: "causa", key: "intake.errors.causa_invalid" },
          { field: "fechaFin", key: "intake.errors.end_before_start" },
        ],
      });
      expect(h.saveDraftDetails).not.toHaveBeenCalled();
    });

    it("evaluates RN-23 on the Managua date: 2026-11-01 02:00 UTC is still 10-31", async () => {
      vi.setSystemTime(new Date("2026-11-01T02:00:00.000Z"));
      h.saveDraftDetails.mockResolvedValue(true);

      const exactly30 = await saveDetailsAction({
        ...valid,
        fechaInicio: "2026-10-01",
        fechaFin: "2026-10-01",
      });
      const tooOld = await saveDetailsAction({
        ...valid,
        fechaInicio: "2026-09-30",
        fechaFin: "2026-09-30",
      });

      expect(exactly30).toEqual({ ok: true });
      expect(tooOld).toEqual({
        ok: false,
        errors: [{ field: "fechaFin", key: "intake.errors.end_too_old" }],
      });
    });

    it("reports no draft when the student has none live", async () => {
      h.saveDraftDetails.mockResolvedValue(false);

      expect(await saveDetailsAction(valid)).toEqual(noDraft);
    });
  });

  describe("saveSubjectsAction (step 2)", () => {
    it("resolves the only group of an unambiguous subject and saves it", async () => {
      h.saveDraftSubjects.mockResolvedValue(true);

      const result = await saveSubjectsAction({
        selections: [{ asignaturaId: 10, grupoId: null }],
      });

      expect(result).toEqual({ ok: true });
      expect(h.saveDraftSubjects).toHaveBeenCalledWith(USER, NOW, [21], TARGET);
    });

    it("lists groups through the port for the draft's dates", async () => {
      h.saveDraftSubjects.mockResolvedValue(true);

      await saveSubjectsAction({
        selections: [{ asignaturaId: 10, grupoId: null }],
      });

      expect(h.listEligibleGroups).toHaveBeenCalledWith(
        USER,
        { from: "2026-10-01", to: "2026-10-03" },
        deps.schedule,
      );
    });

    it("keeps the group the student chose for an ambiguous subject", async () => {
      h.saveDraftSubjects.mockResolvedValue(true);

      await saveSubjectsAction({
        selections: [
          { asignaturaId: 10, grupoId: null },
          { asignaturaId: 11, grupoId: 31 },
        ],
      });

      expect(h.saveDraftSubjects).toHaveBeenCalledWith(
        USER,
        NOW,
        [21, 31],
        TARGET,
      );
    });

    it("blocks an ambiguous subject without a chosen group", async () => {
      const result = await saveSubjectsAction({
        selections: [{ asignaturaId: 11, grupoId: null }],
      });

      expect(result).toEqual({
        ok: false,
        errors: [
          {
            field: "subjects",
            key: "intake.errors.group_required",
            asignaturaId: 11,
          },
        ],
      });
      expect(h.saveDraftSubjects).not.toHaveBeenCalled();
    });

    it("blocks a subject outside the enrollment and a group of another subject", async () => {
      const result = await saveSubjectsAction({
        selections: [
          { asignaturaId: 99, grupoId: null },
          { asignaturaId: 10, grupoId: 31 },
        ],
      });

      expect(result).toEqual({
        ok: false,
        errors: [
          {
            field: "subjects",
            key: "intake.errors.subject_not_eligible",
            asignaturaId: 99,
          },
          {
            field: "subjects",
            key: "intake.errors.group_not_in_subject",
            asignaturaId: 10,
          },
        ],
      });
      expect(h.saveDraftSubjects).not.toHaveBeenCalled();
    });

    it("asks for the dates first when the draft has none", async () => {
      h.getLiveDraft.mockResolvedValue(
        draft({ fechaInicio: null, fechaFin: null }),
      );

      const result = await saveSubjectsAction({
        selections: [{ asignaturaId: 10, grupoId: null }],
      });

      expect(result).toEqual({
        ok: false,
        errors: [{ field: "subjects", key: "intake.errors.dates_required" }],
      });
      expect(h.listEligibleGroups).not.toHaveBeenCalled();
    });

    it("reports no draft for an expired or missing one", async () => {
      h.getLiveDraft.mockResolvedValue(null);

      expect(await saveSubjectsAction({ selections: [] })).toEqual(noDraft);
    });

    it("rejects a malformed payload without reading the draft", async () => {
      const result = await saveSubjectsAction({ selections: "all" });

      expect(result).toEqual({
        ok: false,
        errors: [{ field: "form", key: "intake.errors.invalid_input" }],
      });
      expect(h.getLiveDraft).not.toHaveBeenCalled();
    });
  });

  describe("document actions", () => {
    it("finalizes for the session user, never for a user named in the input", async () => {
      h.finalizeDocument.mockResolvedValue({
        ok: true,
        documentId: 12,
        tipo: "png",
      });

      const result = await finalizeDocumentAction({
        pathname: "intake/4/x.png",
        nombreOriginal: "foto.png",
        userId: 999,
      });

      expect(result).toEqual({ ok: true, documentId: 12 });
      expect(h.finalizeDocument).toHaveBeenCalledWith(
        {
          userId: USER,
          pathname: "intake/4/x.png",
          nombreOriginal: "foto.png",
          target: TARGET,
        },
        deps.store,
      );
    });

    it.each([
      ["unsupported_format"],
      ["too_large"],
      ["too_many_documents"],
    ] as const)(
      "maps the %s refusal to a documents field error",
      async (reason) => {
        h.finalizeDocument.mockResolvedValue({ ok: false, reason });

        expect(
          await finalizeDocumentAction({
            pathname: "intake/4/x.png",
            nombreOriginal: "foto.png",
          }),
        ).toEqual({
          ok: false,
          errors: [{ field: "documents", key: `intake.errors.${reason}` }],
        });
      },
    );

    it("rejects an empty pathname before touching the data layer", async () => {
      const result = await finalizeDocumentAction({
        pathname: "",
        nombreOriginal: "x",
      });

      expect(result).toEqual({
        ok: false,
        errors: [{ field: "form", key: "intake.errors.invalid_input" }],
      });
      expect(h.finalizeDocument).not.toHaveBeenCalled();
    });

    it("removes the student's own document", async () => {
      h.removeDocument.mockResolvedValue({ ok: true });

      expect(await removeDocumentAction(11)).toEqual({ ok: true });
      expect(h.removeDocument).toHaveBeenCalledWith(
        { userId: USER, documentId: 11, target: TARGET },
        deps.store,
      );
    });

    it("rejects a non-numeric document id", async () => {
      expect(await removeDocumentAction("11; drop")).toEqual({
        ok: false,
        errors: [{ field: "form", key: "intake.errors.invalid_input" }],
      });
      expect(h.removeDocument).not.toHaveBeenCalled();
    });
  });

  describe("discardDraftAction (RNF-12, D14)", () => {
    it("discards the session user's draft with the store, then goes back to the flow", async () => {
      h.discardDraft.mockResolvedValue(true);

      await expect(discardDraftAction()).rejects.toThrow(
        "REDIRECT:/requests/new",
      );

      expect(h.discardDraft).toHaveBeenCalledWith(USER, deps.store);
    });

    it("refuses when there is no open draft (a submitted request is never discarded)", async () => {
      h.discardDraft.mockResolvedValue(false);

      expect(await discardDraftAction()).toEqual(noDraft);
      expect(h.redirect).not.toHaveBeenCalled();
    });
  });

  describe("submitRequestAction (RN-02, RN-06, RF-03, RF-04)", () => {
    const expectedInput = {
      userId: USER,
      solicitudId: DRAFT,
      now: NOW,
      causa: "medica",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
      grupoIds: [21],
      consentimientoVersion: CONSENT_VERSION,
    };

    it("stores the v2 consent version, so solicitud.presentada carries it (E6)", async () => {
      h.submitDraft.mockResolvedValue({ ok: true });

      await expect(
        submitRequestAction({ consentVersion: "2026-10-22" }),
      ).rejects.toThrow("REDIRECT:/requests/new/confirmation");

      expect(h.submitDraft.mock.calls[0][0].consentimientoVersion).toBe(
        "2026-10-22",
      );
    });

    it("submits the stored draft with the server clock and redirects to the confirmation", async () => {
      h.submitDraft.mockResolvedValue({ ok: true });

      await expect(submitRequestAction(CONSENTED)).rejects.toThrow(
        "REDIRECT:/requests/new/confirmation",
      );

      expect(h.submitDraft).toHaveBeenCalledWith(expectedInput);
    });

    it("ignores a forged snapshot, timestamp, state or consent instant sent with the call", async () => {
      h.submitDraft.mockResolvedValue({ ok: true });
      const forged = {
        ...CONSENTED,
        presentadaEn: "2000-01-01T00:00:00.000Z",
        consentimientoEn: "2000-01-01T00:00:00.000Z",
        consentimientoVersion: "1999-01-01",
        estudianteNombre: "Mallory",
        estudianteCif: "00000000",
        estado: "aprobada",
      };

      await expect(submitRequestAction(forged)).rejects.toThrow("REDIRECT:");

      const [sent] = h.submitDraft.mock.calls[0];
      expect(Object.keys(sent).sort()).toEqual(
        Object.keys(expectedInput).sort(),
      );
      expect(sent.now).toEqual(NOW);
      expect(sent.consentimientoVersion).toBe(CONSENT_VERSION);
      expect(JSON.stringify(sent)).not.toContain("Mallory");
      expect(JSON.stringify(sent)).not.toContain("1999-01-01");
    });

    it("stores the server constant, never the string it received", async () => {
      h.submitDraft.mockResolvedValue({ ok: true });

      await expect(submitRequestAction(CONSENTED)).rejects.toThrow("REDIRECT:");

      expect(h.submitDraft.mock.calls[0][0].consentimientoVersion).toBe(
        CONSENT_VERSION,
      );
    });

    describe("consent payload (fail closed, RC-5)", () => {
      it.each([
        ["no key", {}],
        ["null version", { consentVersion: null }],
        ["empty version", { consentVersion: "" }],
        ["boolean", { consentVersion: true }],
        ["number", { consentVersion: 1 }],
        ["object", { consentVersion: {} }],
        ["undefined version", { consentVersion: undefined }],
        ["no payload at all", undefined],
        ["null payload", null],
        ["a string payload", "2026-10-20"],
        ["an over-long version", { consentVersion: "x".repeat(21) }],
      ])(
        "answers consent_required for %s and stores nothing",
        async (_n, p) => {
          const result = await submitRequestAction(p);

          expect(result).toEqual({
            ok: false,
            errors: [
              { field: "consent", key: "intake.errors.consent_required" },
            ],
          });
          expect(h.submitDraft).not.toHaveBeenCalled();
          expect(h.redirect).not.toHaveBeenCalled();
        },
      );

      it.each(["2026-10-20", "2025-01-01", "x"])(
        "answers consent_outdated for version %s and stores nothing",
        async (consentVersion) => {
          const result = await submitRequestAction({ consentVersion });

          expect(result).toEqual({
            ok: false,
            errors: [
              { field: "consent", key: "intake.errors.consent_outdated" },
            ],
          });
          expect(h.submitDraft).not.toHaveBeenCalled();
        },
      );

      it("reports the consent error beside a documents error in one response", async () => {
        h.getLiveDraft.mockResolvedValue(draft({ documents: [] }));

        expect(await submitRequestAction({ consentVersion: null })).toEqual({
          ok: false,
          errors: [
            { field: "documents", key: "intake.errors.documents_required" },
            { field: "consent", key: "intake.errors.consent_required" },
          ],
        });
        expect(h.submitDraft).not.toHaveBeenCalled();
      });

      it("does not mask a documents error when the consent is valid", async () => {
        h.getLiveDraft.mockResolvedValue(draft({ documents: [] }));

        expect(await submitRequestAction(CONSENTED)).toEqual({
          ok: false,
          errors: [
            { field: "documents", key: "intake.errors.documents_required" },
          ],
        });
      });

      it("still reports no draft before looking at the consent", async () => {
        h.getLiveDraft.mockResolvedValue(null);

        expect(await submitRequestAction({ consentVersion: null })).toEqual(
          noDraft,
        );
      });
    });

    it("reports no draft for a missing or expired one", async () => {
      h.getLiveDraft.mockResolvedValue(null);

      expect(await submitRequestAction(CONSENTED)).toEqual(noDraft);
      expect(h.submitDraft).not.toHaveBeenCalled();
    });

    it("lists every invalid field at once and submits nothing", async () => {
      h.getLiveDraft.mockResolvedValue(
        draft({
          causa: null,
          fechaInicio: "2026-10-10",
          fechaFin: "2026-10-09",
          documents: [],
        }),
      );

      const result = await submitRequestAction(CONSENTED);

      expect(result).toEqual({
        ok: false,
        errors: [
          { field: "causa", key: "intake.errors.causa_required" },
          { field: "fechaFin", key: "intake.errors.end_before_start" },
          { field: "documents", key: "intake.errors.documents_required" },
        ],
      });
      expect(h.submitDraft).not.toHaveBeenCalled();
    });

    it("requires at least one subject (D15)", async () => {
      h.getLiveDraft.mockResolvedValue(draft({ subjects: [] }));

      expect(await submitRequestAction(CONSENTED)).toEqual({
        ok: false,
        errors: [{ field: "subjects", key: "intake.errors.subjects_required" }],
      });
    });

    it("counts only finalized documents (RN-03): a pendiente one does not qualify", async () => {
      h.getLiveDraft.mockResolvedValue(
        draft({
          documents: [
            {
              id: 12,
              nombreOriginal: "x.pdf",
              tipo: null,
              tamanoBytes: 1,
              estado: "pendiente",
            },
          ],
        }),
      );

      expect(await submitRequestAction(CONSENTED)).toEqual({
        ok: false,
        errors: [
          { field: "documents", key: "intake.errors.documents_required" },
        ],
      });
    });

    it("re-checks eligibility through the port with the draft's dates", async () => {
      h.listEligibleGroups.mockResolvedValue([]);

      const result = await submitRequestAction(CONSENTED);

      expect(h.listEligibleGroups).toHaveBeenCalledWith(
        USER,
        { from: "2026-10-01", to: "2026-10-03" },
        deps.schedule,
      );
      expect(result).toEqual({
        ok: false,
        errors: [
          {
            field: "subjects",
            key: "intake.errors.subject_not_eligible",
            asignaturaId: 10,
          },
        ],
      });
      expect(h.submitDraft).not.toHaveBeenCalled();
    });

    it("without valid dates the enrollment is read unfiltered and only date errors show", async () => {
      h.getLiveDraft.mockResolvedValue(
        draft({ fechaInicio: null, fechaFin: null }),
      );

      const result = await submitRequestAction(CONSENTED);

      expect(h.listEligibleGroups).toHaveBeenCalledWith(
        USER,
        null,
        deps.schedule,
      );
      expect(result).toEqual({
        ok: false,
        errors: [
          { field: "fechaInicio", key: "intake.errors.start_required" },
          { field: "fechaFin", key: "intake.errors.end_required" },
        ],
      });
    });

    it("applies RN-23 against the Managua date at submit", async () => {
      vi.setSystemTime(new Date("2026-11-01T02:00:00.000Z"));
      h.getLiveDraft.mockResolvedValue(
        draft({ fechaInicio: "2026-09-29", fechaFin: "2026-09-30" }),
      );

      expect(await submitRequestAction(CONSENTED)).toEqual({
        ok: false,
        errors: [{ field: "fechaFin", key: "intake.errors.end_too_old" }],
      });
    });

    it("a double submit loses cleanly: conflict error, no redirect", async () => {
      h.submitDraft.mockResolvedValue({ ok: false, reason: "conflict" });

      expect(await submitRequestAction(CONSENTED)).toEqual({
        ok: false,
        errors: [{ field: "form", key: "intake.errors.submit_conflict" }],
      });
      expect(h.redirect).not.toHaveBeenCalled();
    });

    it("reports an incomplete account profile instead of crashing", async () => {
      h.submitDraft.mockResolvedValue({
        ok: false,
        reason: "snapshot_incomplete",
      });

      expect(await submitRequestAction(CONSENTED)).toEqual({
        ok: false,
        errors: [{ field: "form", key: "intake.errors.profile_incomplete" }],
      });
    });

    it("lets a failure inside the submit transaction propagate (rollback) with no redirect", async () => {
      h.submitDraft.mockRejectedValue(new Error("audit down"));

      await expect(submitRequestAction(CONSENTED)).rejects.toThrow(
        "audit down",
      );
      expect(h.redirect).not.toHaveBeenCalled();
    });

    describe("document extraction hand-off (DE-5, RF-11)", () => {
      let logged: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      });

      afterEach(() => {
        logged.mockRestore();
      });

      it("hands the submitted request to extraction with the action's clock, before the redirect", async () => {
        h.submitDraft.mockResolvedValue({ ok: true });

        await expect(submitRequestAction(CONSENTED)).rejects.toThrow(
          "REDIRECT:/requests/new/confirmation",
        );

        expect(h.enqueue).toHaveBeenCalledTimes(1);
        expect(h.enqueue).toHaveBeenCalledWith(DRAFT, NOW);
        expect(h.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
          h.redirect.mock.invocationCallOrder[0],
        );
      });

      it("enqueues only after the submit transaction, which keeps the consent write", async () => {
        h.submitDraft.mockResolvedValue({ ok: true });

        await expect(submitRequestAction(CONSENTED)).rejects.toThrow();

        expect(h.submitDraft).toHaveBeenCalledWith(expectedInput);
        expect(h.submitDraft.mock.invocationCallOrder[0]).toBeLessThan(
          h.enqueue.mock.invocationCallOrder[0],
        );
      });

      it.each([
        ["no draft", () => h.getLiveDraft.mockResolvedValue(null)],
        [
          "an invalid draft",
          () => h.getLiveDraft.mockResolvedValue(draft({ documents: [] })),
        ],
        [
          "a double submit (conflict)",
          () =>
            h.submitDraft.mockResolvedValue({ ok: false, reason: "conflict" }),
        ],
        [
          "an incomplete profile",
          () =>
            h.submitDraft.mockResolvedValue({
              ok: false,
              reason: "snapshot_incomplete",
            }),
        ],
        [
          "a failing transaction",
          () => h.submitDraft.mockRejectedValue(new Error("audit down")),
        ],
      ])("enqueues nothing for %s", async (_name, arrange) => {
        arrange();

        await submitRequestAction(CONSENTED).catch(() => undefined);

        expect(h.enqueue).not.toHaveBeenCalled();
        expect(h.getExtractionDeps).not.toHaveBeenCalled();
      });

      it("enqueues nothing when the consent is missing: nothing was stored", async () => {
        h.submitDraft.mockResolvedValue({ ok: true });

        await submitRequestAction({ consentVersion: null });

        expect(h.submitDraft).not.toHaveBeenCalled();
        expect(h.enqueue).not.toHaveBeenCalled();
      });

      it("a throwing hand-off is logged by name and the student still reaches the confirmation", async () => {
        h.submitDraft.mockResolvedValue({ ok: true });
        h.enqueue.mockImplementation(() => {
          throw new RangeError("secret detail: postgres://u:p@host/db");
        });

        await expect(submitRequestAction(CONSENTED)).rejects.toThrow(
          "REDIRECT:/requests/new/confirmation",
        );

        expect(logged).toHaveBeenCalledTimes(1);
        expect(logged).toHaveBeenCalledWith("extraction_not_scheduled", {
          solicitudId: DRAFT,
          code: "RangeError",
        });
        expect(JSON.stringify(logged.mock.calls)).not.toContain("secret");
      });

      it("a composition root that cannot be built does not block the submission either", async () => {
        h.submitDraft.mockResolvedValue({ ok: true });
        h.getExtractionDeps.mockImplementation(() => {
          throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
        });

        await expect(submitRequestAction(CONSENTED)).rejects.toThrow(
          "REDIRECT:/requests/new/confirmation",
        );

        expect(h.enqueue).not.toHaveBeenCalled();
        expect(logged).toHaveBeenCalledWith("extraction_not_scheduled", {
          solicitudId: DRAFT,
          code: "Error",
        });
        expect(JSON.stringify(logged.mock.calls)).not.toContain("BLOB");
      });

      it("the draft steps never hand anything to extraction", async () => {
        h.finalizeDocument.mockResolvedValue({ ok: true, documentId: 12 });

        await finalizeDocumentAction({ pathname: "a", nombreOriginal: "a" });

        expect(h.getExtractionDeps).not.toHaveBeenCalled();
      });
    });
  });
});
