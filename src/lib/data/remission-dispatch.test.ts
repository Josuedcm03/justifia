// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFakeDocumentStore,
  createFakeMailSender,
} from "@/lib/intake/fakes";
import { MAX_REMISSION_ATTACHMENT_BYTES } from "@/lib/remission/limits";

vi.mock("server-only", () => ({}));

const remisionMock = vi.hoisted(() => ({
  claimRemission: vi.fn(),
  completeBlocked: vi.fn(),
  completeFailed: vi.fn(),
  completeSent: vi.fn(),
  findApprovingSecretaryId: vi.fn(),
  findTeacherEmail: vi.fn(),
  loadRequestForRemission: vi.fn(),
  refreshRemissionEmail: vi.fn(),
}));
vi.mock("@/lib/data/remision", () => remisionMock);

import type {
  DispatchDocument,
  RemissionClaim,
  RemissionRequestContext,
} from "@/lib/data/remision";
import {
  dispatchRemission,
  dispatchRemissions,
} from "@/lib/data/remission-dispatch";

const NOW = new Date("2026-10-19T15:00:00.000Z");
const ACTOR = 20;
const PDF = [0x25, 0x50, 0x44, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47];

const clase = {
  asignaturaId: 10,
  codigo: "MAT101",
  nombre: "Matematica I",
  numeroGrupo: "A",
};

function claim(overrides: Partial<RemissionClaim> = {}): RemissionClaim {
  return {
    id: 31,
    solicitudId: 42,
    docenteId: 5,
    docenteNombre: "Ana Perez",
    correo: "ana@uam.edu.ni",
    clases: [clase],
    estado: "pendiente",
    motivoCodigo: null,
    intentos: 1,
    reclamoId: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

function doc(overrides: Partial<DispatchDocument> = {}): DispatchDocument {
  return {
    id: 1,
    pathname: "intake/42/a.pdf",
    nombreOriginal: "constancia.pdf",
    tipoDetectado: "pdf",
    tamanoBytes: PDF.length,
    subidoPorId: null,
    formatoEspecial: false,
    ...overrides,
  };
}

function context(
  documentos: DispatchDocument[] = [doc()],
  formatoEspecial = false,
): RemissionRequestContext {
  return {
    solicitud: {
      causa: formatoEspecial ? "fuerza_mayor" : "medica",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
      estudianteNombre: "Carlos Ruiz",
      estudianteCif: "2021-0042",
      estudianteCorreo: "estudiante@uam.edu.ni",
      formatoEspecial,
    },
    documentos,
  };
}

function setup() {
  const store = createFakeDocumentStore();
  const mail = createFakeMailSender();
  store.seed("intake/42/a.pdf", PDF);
  return { deps: { store, mail, now: () => NOW }, store, mail };
}

const trigger = { trigger: "aprobacion", actorId: ACTOR } as const;

describe("dispatchRemission (TR-7)", () => {
  beforeEach(() => {
    for (const mock of Object.values(remisionMock)) mock.mockReset();
    remisionMock.claimRemission.mockResolvedValue(claim());
    remisionMock.loadRequestForRemission.mockResolvedValue(context());
    remisionMock.completeSent.mockResolvedValue(true);
    remisionMock.completeFailed.mockResolvedValue(true);
    remisionMock.completeBlocked.mockResolvedValue(true);
    remisionMock.refreshRemissionEmail.mockResolvedValue(true);
    remisionMock.findTeacherEmail.mockResolvedValue(null);
    remisionMock.findApprovingSecretaryId.mockResolvedValue(77);
  });

  describe("success", () => {
    it("sends once to the snapshot email with the student in copy and the documents attached", async () => {
      const { deps, mail } = setup();

      const result = await dispatchRemission(31, trigger, deps);

      expect(result).toEqual({ outcome: "sent" });
      expect(mail.sent).toHaveLength(1);
      const [message] = mail.sent;
      expect(message.to).toBe("ana@uam.edu.ni");
      expect(message.cc).toEqual(["estudiante@uam.edu.ni"]);
      expect(message.subject).toBe("Justificar la inasistencia de Carlos Ruiz");
      expect(message.idempotencyKey).toMatch(/^remision-31-[0-9a-f]{16}$/);
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].filename).toBe("constancia.pdf");
      expect(message.attachments[0].contentType).toBe("application/pdf");
      expect([...message.attachments[0].content]).toEqual(PDF);
    });

    it("completes as enviada with the provider id, the attachment count and the actor", async () => {
      const { deps } = setup();

      await dispatchRemission(31, trigger, deps);

      expect(remisionMock.claimRemission).toHaveBeenCalledWith(
        31,
        "aprobacion",
        NOW,
      );
      expect(remisionMock.completeSent).toHaveBeenCalledWith(claim(), {
        now: NOW,
        actorId: ACTOR,
        origen: "aprobacion",
        providerId: "fake-1",
        adjuntos: 1,
      });
      expect(remisionMock.completeFailed).not.toHaveBeenCalled();
      expect(remisionMock.completeBlocked).not.toHaveBeenCalled();
    });

    it("attaches every document of the student in id order with its own type", async () => {
      const { deps, store, mail } = setup();
      store.seed("intake/42/b.png", PNG);
      remisionMock.loadRequestForRemission.mockResolvedValue(
        context([
          doc({
            id: 2,
            pathname: "intake/42/b.png",
            nombreOriginal: "b.png",
            tipoDetectado: "png",
            tamanoBytes: PNG.length,
          }),
          doc(),
        ]),
      );

      await dispatchRemission(31, trigger, deps);

      expect(
        mail.sent[0].attachments.map((a) => [a.filename, a.contentType]),
      ).toEqual([
        ["constancia.pdf", "application/pdf"],
        ["b.png", "image/png"],
      ]);
    });
  });

  describe("RN-19 document selection end to end", () => {
    it("sends only the staff format of a marked request", async () => {
      const { deps, store, mail } = setup();
      store.seed("intake/42/format.pdf", [0x25, 0x50, 0x44, 0x46, 1]);
      remisionMock.loadRequestForRemission.mockResolvedValue(
        context(
          [
            doc(),
            doc({
              id: 90,
              pathname: "intake/42/format.pdf",
              nombreOriginal: "formato-firmado.pdf",
              tamanoBytes: 5,
              subidoPorId: 7,
              formatoEspecial: true,
            }),
          ],
          true,
        ),
      );

      await dispatchRemission(31, trigger, deps);

      expect(mail.sent[0].attachments.map((a) => a.filename)).toEqual([
        "formato-firmado.pdf",
      ]);
    });

    it("never sends a staff upload of an unmarked request", async () => {
      const { deps, store, mail } = setup();
      store.seed("intake/42/format.pdf", [1]);
      remisionMock.loadRequestForRemission.mockResolvedValue(
        context([
          doc(),
          doc({
            id: 90,
            pathname: "intake/42/format.pdf",
            nombreOriginal: "formato-firmado.pdf",
            tamanoBytes: 1,
            subidoPorId: 7,
            formatoEspecial: true,
          }),
        ]),
      );

      await dispatchRemission(31, trigger, deps);

      expect(mail.sent[0].attachments.map((a) => a.filename)).toEqual([
        "constancia.pdf",
      ]);
    });
  });

  describe("provider failures", () => {
    it.each(["unavailable", "rejected"] as const)(
      "a %s answer leaves the remission pending with that code",
      async (code) => {
        const { deps, mail } = setup();
        mail.failWith(code);

        const result = await dispatchRemission(31, trigger, deps);

        expect(result).toEqual({ outcome: "failed", codigo: code });
        expect(remisionMock.completeFailed).toHaveBeenCalledWith(claim(), {
          now: NOW,
          actorId: ACTOR,
          origen: "aprobacion",
          codigo: code,
        });
        expect(remisionMock.completeSent).not.toHaveBeenCalled();
      },
    );

    it("a missing mail configuration leaves it pending with not_configured", async () => {
      const { deps, mail } = setup();
      mail.failWith("not_configured");

      const result = await dispatchRemission(31, trigger, deps);

      expect(result).toEqual({ outcome: "failed", codigo: "not_configured" });
      expect(remisionMock.completeFailed).toHaveBeenCalledWith(
        claim(),
        expect.objectContaining({ codigo: "not_configured" }),
      );
    });

    it("hands the audit only a closed code, never provider text", async () => {
      const { deps, mail } = setup();
      mail.failWith("rejected");

      await dispatchRemission(31, trigger, deps);

      const [, args] = remisionMock.completeFailed.mock.calls[0];
      expect(JSON.stringify(args)).not.toContain("@");
      expect(Object.keys(args).sort()).toEqual([
        "actorId",
        "codigo",
        "now",
        "origen",
      ]);
    });
  });

  describe("blockers", () => {
    it("blocks sin_correo without reading or sending anything", async () => {
      const { deps, store, mail } = setup();
      const stream = vi.spyOn(store, "stream");
      remisionMock.claimRemission.mockResolvedValue(
        claim({
          correo: null,
          estado: "bloqueada",
          motivoCodigo: "sin_correo",
        }),
      );

      const result = await dispatchRemission(
        31,
        { trigger: "reenvio_manual", actorId: ACTOR },
        deps,
      );

      expect(result).toEqual({ outcome: "blocked", motivo: "sin_correo" });
      expect(remisionMock.completeBlocked).toHaveBeenCalledWith(
        expect.anything(),
        {
          now: NOW,
          actorId: ACTOR,
          origen: "reenvio_manual",
          motivo: "sin_correo",
        },
      );
      expect(stream).not.toHaveBeenCalled();
      expect(mail.calls).toHaveLength(0);
    });

    it("blocks a marked request that has no format yet", async () => {
      const { deps, mail } = setup();
      remisionMock.loadRequestForRemission.mockResolvedValue(
        context([doc()], true),
      );

      const result = await dispatchRemission(31, trigger, deps);

      expect(result).toEqual({
        outcome: "blocked",
        motivo: "formato_especial_faltante",
      });
      expect(mail.calls).toHaveLength(0);
    });

    it("checks the size guard before any download", async () => {
      const { deps, store, mail } = setup();
      const stream = vi.spyOn(store, "stream");
      remisionMock.loadRequestForRemission.mockResolvedValue(
        context([
          doc({ tamanoBytes: MAX_REMISSION_ATTACHMENT_BYTES }),
          doc({ id: 2, pathname: "intake/42/b.pdf", tamanoBytes: 1 }),
        ]),
      );

      const result = await dispatchRemission(31, trigger, deps);

      expect(result).toEqual({
        outcome: "blocked",
        motivo: "adjuntos_exceden_limite",
      });
      expect(stream).not.toHaveBeenCalled();
      expect(mail.calls).toHaveLength(0);
    });
  });

  describe("storage failures", () => {
    it("keeps the remission pending with documento_no_disponible when a blob is missing", async () => {
      const { deps, store, mail } = setup();
      await store.delete(["intake/42/a.pdf"]);

      const result = await dispatchRemission(31, trigger, deps);

      expect(result).toEqual({
        outcome: "failed",
        codigo: "documento_no_disponible",
      });
      expect(mail.calls).toHaveLength(0);
      expect(remisionMock.completeFailed).toHaveBeenCalledWith(
        claim(),
        expect.objectContaining({ codigo: "documento_no_disponible" }),
      );
    });

    it("keeps it pending when reading the stream fails", async () => {
      const { deps, store, mail } = setup();
      vi.spyOn(store, "stream").mockRejectedValue(new Error("blob down"));

      const result = await dispatchRemission(31, trigger, deps);

      expect(result).toEqual({
        outcome: "failed",
        codigo: "documento_no_disponible",
      });
      expect(mail.calls).toHaveLength(0);
    });
  });

  describe("manual resend of a remission without email (D6)", () => {
    const blockedClaim = () =>
      claim({ correo: null, estado: "bloqueada", motivoCodigo: "sin_correo" });

    it("refreshes the email when the teacher now has one, then sends to it", async () => {
      const { deps, mail } = setup();
      remisionMock.claimRemission.mockResolvedValue(blockedClaim());
      remisionMock.findTeacherEmail.mockResolvedValue("nueva@uam.edu.ni");

      const result = await dispatchRemission(
        31,
        { trigger: "reenvio_manual", actorId: ACTOR },
        deps,
      );

      expect(result).toEqual({ outcome: "sent" });
      expect(remisionMock.findTeacherEmail).toHaveBeenCalledWith(5);
      expect(remisionMock.refreshRemissionEmail).toHaveBeenCalledWith(
        expect.anything(),
        "nueva@uam.edu.ni",
        NOW,
      );
      expect(mail.sent[0].to).toBe("nueva@uam.edu.ni");
    });

    it("keeps the blocker when the teacher still has no email", async () => {
      const { deps } = setup();
      remisionMock.claimRemission.mockResolvedValue(blockedClaim());

      const result = await dispatchRemission(
        31,
        { trigger: "reenvio_manual", actorId: ACTOR },
        deps,
      );

      expect(result).toEqual({ outcome: "blocked", motivo: "sin_correo" });
      expect(remisionMock.refreshRemissionEmail).not.toHaveBeenCalled();
    });

    it("does not look up a fresh email for a remission that already has one", async () => {
      const { deps } = setup();

      await dispatchRemission(31, trigger, deps);

      expect(remisionMock.findTeacherEmail).not.toHaveBeenCalled();
    });
  });

  describe("already sent or held (idempotency)", () => {
    it("sends nothing and writes no audit when the claim matches no row", async () => {
      const { deps, store, mail } = setup();
      const stream = vi.spyOn(store, "stream");
      remisionMock.claimRemission.mockResolvedValue(null);

      const result = await dispatchRemission(
        31,
        { trigger: "reenvio_manual", actorId: ACTOR },
        deps,
      );

      expect(result).toEqual({ outcome: "skipped" });
      expect(remisionMock.loadRequestForRemission).not.toHaveBeenCalled();
      expect(stream).not.toHaveBeenCalled();
      expect(mail.calls).toHaveLength(0);
      expect(remisionMock.completeSent).not.toHaveBeenCalled();
      expect(remisionMock.completeFailed).not.toHaveBeenCalled();
      expect(remisionMock.completeBlocked).not.toHaveBeenCalled();
    });

    it("reports a lost claim when the guarded completion matches nothing", async () => {
      const { deps } = setup();
      remisionMock.completeSent.mockResolvedValue(false);

      await expect(dispatchRemission(31, trigger, deps)).resolves.toEqual({
        outcome: "lost",
      });
    });
  });

  describe("actor of the scheduled retry (TR-13)", () => {
    it("uses the approving secretary when there is no session", async () => {
      const { deps } = setup();

      await dispatchRemission(31, { trigger: "reintento_automatico" }, deps);

      expect(remisionMock.findApprovingSecretaryId).toHaveBeenCalledWith(42);
      expect(remisionMock.completeSent).toHaveBeenCalledWith(
        claim(),
        expect.objectContaining({
          actorId: 77,
          origen: "reintento_automatico",
        }),
      );
    });

    it("never looks the approver up when the caller supplied the actor", async () => {
      const { deps } = setup();

      await dispatchRemission(31, trigger, deps);

      expect(remisionMock.findApprovingSecretaryId).not.toHaveBeenCalled();
    });

    it("throws when no actor can be resolved, leaving the claim to expire", async () => {
      const { deps, mail } = setup();
      remisionMock.findApprovingSecretaryId.mockResolvedValue(null);

      await expect(
        dispatchRemission(31, { trigger: "reintento_automatico" }, deps),
      ).rejects.toThrow("remission_actor_missing");
      expect(mail.calls).toHaveLength(0);
    });
  });
});

describe("dispatchRemissions (RNF-07 a, b)", () => {
  beforeEach(() => {
    for (const mock of Object.values(remisionMock)) mock.mockReset();
    remisionMock.loadRequestForRemission.mockResolvedValue(context());
    remisionMock.completeSent.mockResolvedValue(true);
    remisionMock.completeFailed.mockResolvedValue(true);
    remisionMock.completeBlocked.mockResolvedValue(true);
    remisionMock.findApprovingSecretaryId.mockResolvedValue(77);
  });

  it("dispatches the rows one after another and counts the outcomes", async () => {
    const { deps } = setup();
    const order: number[] = [];
    remisionMock.claimRemission.mockImplementation(async (id: number) => {
      order.push(id);
      return id === 33 ? null : claim({ id });
    });

    const summary = await dispatchRemissions([31, 32, 33], trigger, deps);

    expect(order).toEqual([31, 32, 33]);
    expect(summary).toEqual({
      sent: 2,
      failed: 0,
      blocked: 0,
      skipped: 1,
      lost: 0,
      errored: 0,
    });
  });

  it("contains a throwing row, keeps going and logs codes only", async () => {
    const { deps, mail } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    remisionMock.claimRemission
      .mockRejectedValueOnce(new Error("boom for ana@uam.edu.ni"))
      .mockResolvedValueOnce(claim({ id: 32 }));

    const summary = await dispatchRemissions([31, 32], trigger, deps);

    expect(summary.errored).toBe(1);
    expect(summary.sent).toBe(1);
    expect(mail.sent).toHaveLength(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("@");
    expect(JSON.stringify(log.mock.calls)).toContain("31");
    log.mockRestore();
  });

  it("never throws, even when every row fails", async () => {
    const { deps } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    remisionMock.claimRemission.mockRejectedValue(new Error("db down"));

    await expect(
      dispatchRemissions([31, 32], trigger, deps),
    ).resolves.toMatchObject({ errored: 2, sent: 0 });
    log.mockRestore();
  });

  it("returns an empty summary for no ids", async () => {
    const { deps } = setup();

    await expect(dispatchRemissions([], trigger, deps)).resolves.toEqual({
      sent: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      lost: 0,
      errored: 0,
    });
    expect(remisionMock.claimRemission).not.toHaveBeenCalled();
  });
});
