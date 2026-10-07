import { describe, expect, it } from "vitest";

import type { EntityCounts, ImportSummary } from "../import/types";
import {
  accountCreatedEvent,
  accountUpdatedEvent,
  buildAuditEvents,
  documentAttachedEvent,
  documentDownloadedEvent,
  documentRejectedEvent,
  documentRemovedEvent,
  importAppliedEvent,
  type TouchedAccount,
} from "./events";
import { AUDIT_ACTIONS, AUDITABLE_USER_FIELDS } from "./types";

function zeroCounts(): EntityCounts {
  return { create: 0, update: 0, unchanged: 0, deactivate: 0, error: 0 };
}

function makeSummary(overrides: Partial<ImportSummary> = {}): ImportSummary {
  return {
    actor: "secretaria@uam.edu",
    at: "2026-06-01T00:00:00.000Z",
    fileSha256: "a".repeat(64),
    counts: {
      Asignatura: zeroCounts(),
      Usuario: zeroCounts(),
      Grupo: zeroCounts(),
    },
    accountsCreated: 0,
    accountsUpdated: 0,
    ...overrides,
  };
}

describe("importAppliedEvent", () => {
  it("builds the import-level event with no actor/at on the payload", () => {
    const summary = makeSummary({ accountsCreated: 2, accountsUpdated: 1 });
    const event = importAppliedEvent(summary);

    expect(event.accion).toBe("catalogo.importacion.aplicada");
    expect(event.entidadTipo).toBe("Importacion");
    expect(event.entidadId).toBeNull();
    expect(event.datos).toEqual({
      archivoSha256: summary.fileSha256,
      conteos: summary.counts,
      cuentasCreadas: 2,
      cuentasActualizadas: 1,
    });
    expect("actor" in event.datos).toBe(false);
    expect("at" in event.datos).toBe(false);
  });
});

describe("accountCreatedEvent", () => {
  it("carries the real id, rol, origen and the import hash", () => {
    const event = accountCreatedEvent({
      usuarioId: 42,
      rol: "docente",
      importacionSha256: "b".repeat(64),
    });
    expect(event.accion).toBe("usuario.creado");
    expect(event.entidadTipo).toBe("Usuario");
    expect(event.entidadId).toBe(42);
    if (event.entidadTipo !== "Usuario") throw new Error("expected Usuario");
    expect(event.datos.rol).toBe("docente");
    expect(event.datos.origen).toBe("importacion");
    expect(event.datos.importacionSha256).toBe("b".repeat(64));
    expect(event.datos.campos).toEqual(AUDITABLE_USER_FIELDS);
  });
});

describe("accountUpdatedEvent", () => {
  it("lists only the changed fields, and only AUDITABLE_USER_FIELDS", () => {
    const event = accountUpdatedEvent({
      usuarioId: 7,
      rol: "docente",
      campos: ["nombreCompleto", "telefono"],
      importacionSha256: "c".repeat(64),
    });
    expect(event.accion).toBe("usuario.actualizado");
    if (event.entidadTipo !== "Usuario") throw new Error("expected Usuario");
    expect(event.datos.campos).toEqual(["nombreCompleto", "telefono"]);
    for (const field of event.datos.campos) {
      expect(AUDITABLE_USER_FIELDS).toContain(field);
    }
  });
});

describe("buildAuditEvents", () => {
  it("emits exactly 1 import event + 1 per created/updated account, and 0 for unchanged", () => {
    const summary = makeSummary({ accountsCreated: 1, accountsUpdated: 1 });
    const touched: TouchedAccount[] = [
      { usuarioId: 1, rol: "docente", kind: "creado", campos: [] },
      {
        usuarioId: 2,
        rol: "docente",
        kind: "actualizado",
        campos: ["telefono"],
      },
    ];
    const events = buildAuditEvents(summary, touched);
    expect(events).toHaveLength(3);
    expect(events[0].accion).toBe("catalogo.importacion.aplicada");
    expect(events[1].accion).toBe("usuario.creado");
    expect(events[2].accion).toBe("usuario.actualizado");
  });

  it("a re-import with everything unchanged yields exactly one event", () => {
    const events = buildAuditEvents(makeSummary(), []);
    expect(events).toHaveLength(1);
    expect(events[0].accion).toBe("catalogo.importacion.aplicada");
  });

  it("entidadId is null only for the Importacion event", () => {
    const events = buildAuditEvents(makeSummary(), [
      { usuarioId: 5, rol: "docente", kind: "creado", campos: [] },
    ]);
    for (const event of events) {
      if (event.entidadTipo === "Importacion") {
        expect(event.entidadId).toBeNull();
      } else {
        expect(event.entidadId).not.toBeNull();
      }
    }
  });

  it("no event carries actorId or ocurridoEn", () => {
    const events = buildAuditEvents(makeSummary(), [
      {
        usuarioId: 5,
        rol: "docente",
        kind: "actualizado",
        campos: ["telefono"],
      },
    ]);
    for (const event of events) {
      expect("actorId" in event).toBe(false);
      expect("ocurridoEn" in event).toBe(false);
    }
  });

  it("every action code is one of AUDIT_ACTIONS", () => {
    const events = buildAuditEvents(makeSummary(), [
      { usuarioId: 5, rol: "docente", kind: "creado", campos: [] },
      { usuarioId: 6, rol: "docente", kind: "actualizado", campos: ["cif"] },
    ]);
    for (const event of events) {
      expect(AUDIT_ACTIONS).toContain(event.accion);
    }
  });

  it("importacionSha256 propagates from summary.fileSha256, not re-derived", () => {
    const summary = makeSummary({ fileSha256: "d".repeat(64) });
    const events = buildAuditEvents(summary, [
      { usuarioId: 5, rol: "docente", kind: "creado", campos: [] },
    ]);
    const accountEvent = events[1];
    if (accountEvent.entidadTipo !== "Usuario")
      throw new Error("expected Usuario");
    expect(accountEvent.datos.importacionSha256).toBe("d".repeat(64));
  });
});

describe("AUDITABLE_USER_FIELDS excludes credentials", () => {
  it("never contains login or hashClave", () => {
    expect(AUDITABLE_USER_FIELDS).not.toContain("login");
    expect(AUDITABLE_USER_FIELDS).not.toContain("hashClave");
  });
});

describe("credential-leak pins (decision 22)", () => {
  it("rejects a `clave` key on an updated-account payload literal at compile time", () => {
    const event = accountUpdatedEvent({
      usuarioId: 1,
      rol: "docente",
      campos: ["nombreCompleto"],
      importacionSha256: "e".repeat(64),
      // @ts-expect-error — `clave` is not a member of UserChangedPayload; a
      // credential can never be smuggled onto an update event's `datos`.
      clave: "should-not-typecheck",
    });
    expect(event).toBeDefined();
  });

  it("rejects a TemporaryCredential passed where a builder expects ids/enums", () => {
    const credential = { login: "a@b.c", nombreCompleto: "A", clave: "secret" };
    // @ts-expect-error — a TemporaryCredential is not assignable to
    // accountCreatedEvent's argument type: no builder accepts a credential.
    const event = accountCreatedEvent(credential);
    expect(event).toBeDefined();
  });

  it("no built payload's key set (recursively) intersects a forbidden-key list, across the fixture matrix", () => {
    const forbidden = ["clave", "password", "hash", "hashClave"];
    const summary = makeSummary({ accountsCreated: 1, accountsUpdated: 1 });
    const matrices: TouchedAccount[][] = [
      [],
      [{ usuarioId: 1, rol: "docente", kind: "creado", campos: [] }],
      [
        {
          usuarioId: 2,
          rol: "docente",
          kind: "actualizado",
          campos: ["telefono"],
        },
      ],
      [
        { usuarioId: 1, rol: "docente", kind: "creado", campos: [] },
        {
          usuarioId: 2,
          rol: "docente",
          kind: "actualizado",
          campos: ["cif", "carreraId"],
        },
      ],
    ];

    function sweep(value: unknown): void {
      if (value === null || typeof value !== "object") return;
      for (const [key, nested] of Object.entries(value)) {
        expect(forbidden).not.toContain(key);
        sweep(nested);
      }
    }

    for (const touched of matrices) {
      for (const event of buildAuditEvents(summary, touched)) {
        sweep(event);
      }
    }
  });
});

describe("document events (justification-intake D13, D14)", () => {
  it("documentAttachedEvent targets DocumentoRespaldo and carries only ids, type and size", () => {
    expect(
      documentAttachedEvent({
        documentoId: 11,
        solicitudId: 4,
        tipo: "pdf",
        tamanoBytes: 2048,
      }),
    ).toEqual({
      accion: "documento.adjuntado",
      entidadTipo: "DocumentoRespaldo",
      entidadId: 11,
      datos: { solicitudId: 4, tipo: "pdf", tamanoBytes: 2048 },
    });
  });

  it("documentRejectedEvent targets the draft (Solicitud) and carries the reason code", () => {
    expect(
      documentRejectedEvent({
        solicitudId: 4,
        reason: "unsupported_format",
      }),
    ).toEqual({
      accion: "documento.rechazado",
      entidadTipo: "Solicitud",
      entidadId: 4,
      datos: { reason: "unsupported_format" },
    });
  });

  it("documentRemovedEvent targets DocumentoRespaldo", () => {
    expect(documentRemovedEvent({ documentoId: 11, solicitudId: 4 })).toEqual({
      accion: "documento.eliminado",
      entidadTipo: "DocumentoRespaldo",
      entidadId: 11,
      datos: { solicitudId: 4 },
    });
  });

  it("documentDownloadedEvent targets DocumentoRespaldo with request id and type", () => {
    expect(
      documentDownloadedEvent({ documentoId: 11, solicitudId: 4, tipo: "png" }),
    ).toEqual({
      accion: "documento.descargado",
      entidadTipo: "DocumentoRespaldo",
      entidadId: 11,
      datos: { solicitudId: 4, tipo: "png" },
    });
  });

  it("every document action code is registered in AUDIT_ACTIONS", () => {
    for (const accion of [
      "documento.adjuntado",
      "documento.rechazado",
      "documento.eliminado",
      "documento.descargado",
    ]) {
      expect(AUDIT_ACTIONS).toContain(accion);
    }
  });

  it("no payload contains a file name, location or URL key", () => {
    const payloads = [
      documentAttachedEvent({
        documentoId: 1,
        solicitudId: 2,
        tipo: "jpeg",
        tamanoBytes: 5,
      }),
      documentRejectedEvent({ solicitudId: 2, reason: "too_large" }),
      documentRemovedEvent({ documentoId: 1, solicitudId: 2 }),
      documentDownloadedEvent({ documentoId: 1, solicitudId: 2, tipo: "pdf" }),
    ].map((e) => JSON.stringify(e.datos));
    for (const json of payloads) {
      expect(json).not.toMatch(/nombre|pathname|url|http|token/i);
    }
  });
});
