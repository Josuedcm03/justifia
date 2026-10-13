import { describe, expect, it } from "vitest";

import type {
  AsignaturaActiveResult,
  AsignaturaWriteResult,
  GrupoActiveResult,
  GrupoWriteResult,
} from "../catalog/types";
import { encodeDias } from "../catalog/dias";
import type { EntityCounts, ImportSummary } from "../import/types";
import { changedFields } from "./diff";
import {
  accountCreatedEvent,
  accountUpdatedEvent,
  asignaturaActiveChangedEvent,
  asignaturaCreatedEvent,
  asignaturaUpdatedEvent,
  asignaturaWriteEvents,
  buildAuditEvents,
  documentAttachedEvent,
  documentDownloadedEvent,
  documentRejectedEvent,
  documentRemovedEvent,
  documentoRetiradoEvent,
  grupoActiveChangedEvent,
  grupoCreatedEvent,
  grupoUpdatedEvent,
  grupoWriteEvents,
  importAppliedEvent,
  MANUAL_ORIGIN,
  solicitudColaConsultadaEvent,
  solicitudConsultadaEvent,
  solicitudCorregidaEvent,
  solicitudDecididaEvent,
  solicitudPresentadaEvent,
  type TouchedAccount,
} from "./events";
import {
  AUDIT_ACTIONS,
  AUDITABLE_ASIGNATURA_FIELDS,
  AUDITABLE_USER_FIELDS,
} from "./types";
import type { AuditEvent } from "./types";

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
    asignaturasReactivated: 0,
    manualGruposDeactivated: 0,
    ...overrides,
  };
}

describe("importAppliedEvent", () => {
  it("builds the import-level event with no actor/at on the payload", () => {
    const summary = makeSummary({
      accountsCreated: 2,
      accountsUpdated: 1,
      asignaturasReactivated: 2,
      manualGruposDeactivated: 3,
    });
    const event = importAppliedEvent(summary);

    expect(event.accion).toBe("catalogo.importacion.aplicada");
    expect(event.entidadTipo).toBe("Importacion");
    expect(event.entidadId).toBeNull();
    expect(event.datos).toEqual({
      archivoSha256: summary.fileSha256,
      conteos: summary.counts,
      cuentasCreadas: 2,
      cuentasActualizadas: 1,
      asignaturasReactivadas: 2,
      gruposManualesDesactivados: 3,
    });
    expect("actor" in event.datos).toBe(false);
    expect("at" in event.datos).toBe(false);
  });

  it("carries the two losing-side counts as zero when nothing applies", () => {
    const event = importAppliedEvent(makeSummary());
    expect(event.datos).toMatchObject({
      asignaturasReactivadas: 0,
      gruposManualesDesactivados: 0,
    });
  });

  it("holds counts only: no Codigo, cell content or credential key (CEI-AUD, AL-PAY)", () => {
    const event = importAppliedEvent(
      makeSummary({ asignaturasReactivated: 1, manualGruposDeactivated: 1 }),
    );
    expect(Object.keys(event.datos).toSorted()).toEqual(
      [
        "archivoSha256",
        "asignaturasReactivadas",
        "conteos",
        "cuentasActualizadas",
        "cuentasCreadas",
        "gruposManualesDesactivados",
      ].toSorted(),
    );
    expect(JSON.stringify(event.datos)).not.toMatch(
      /clave|password|hash|codigo|nombre|correo/i,
    );
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

  it("documentDownloadedEvent targets DocumentoRespaldo with request id, type and mode", () => {
    expect(
      documentDownloadedEvent({
        documentoId: 11,
        solicitudId: 4,
        tipo: "png",
        modo: "descarga",
      }),
    ).toEqual({
      accion: "documento.descargado",
      entidadTipo: "DocumentoRespaldo",
      entidadId: 11,
      datos: { solicitudId: 4, tipo: "png", modo: "descarga" },
    });
    expect(
      documentDownloadedEvent({
        documentoId: 12,
        solicitudId: 5,
        tipo: "pdf",
        modo: "ver",
      }).datos,
    ).toEqual({ solicitudId: 5, tipo: "pdf", modo: "ver" });
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
      documentDownloadedEvent({
        documentoId: 1,
        solicitudId: 2,
        tipo: "pdf",
        modo: "ver",
      }),
    ].map((e) => JSON.stringify(e.datos));
    for (const json of payloads) {
      expect(json).not.toMatch(/nombre|pathname|url|http|token/i);
    }
  });
});

describe("manual catalog event builders (AL-SET, AL-PAY)", () => {
  const SHA = "f".repeat(64);

  it("exposes the manual origin as a digest-free constant", () => {
    expect(MANUAL_ORIGIN).toEqual({ origen: "manual" });
  });

  describe("Asignatura", () => {
    it("created: asignatura.creada, numeric id, full closed field list", () => {
      const event = asignaturaCreatedEvent({
        asignaturaId: 11,
        origin: MANUAL_ORIGIN,
      });
      expect(event.accion).toBe("asignatura.creada");
      expect(event.entidadTipo).toBe("Asignatura");
      expect(event.entidadId).toBe(11);
      expect(event.datos).toEqual({
        origen: "manual",
        campos: [...AUDITABLE_ASIGNATURA_FIELDS],
      });
    });

    it("updated: asignatura.actualizada lists exactly the given names", () => {
      const event = asignaturaUpdatedEvent({
        asignaturaId: 12,
        campos: ["nombre", "horasTotales"],
        origin: MANUAL_ORIGIN,
      });
      expect(event.accion).toBe("asignatura.actualizada");
      expect(event.entidadTipo).toBe("Asignatura");
      expect(event.entidadId).toBe(12);
      expect(event.datos).toEqual({
        origen: "manual",
        campos: ["nombre", "horasTotales"],
      });
    });

    it.each([
      [true, "asignatura.reactivada"],
      [false, "asignatura.desactivada"],
    ] as const)(
      "activeChanged(%s) -> %s with campos [activo]",
      (activo, accion) => {
        const event = asignaturaActiveChangedEvent({
          asignaturaId: 13,
          activo,
          origin: MANUAL_ORIGIN,
        });
        expect(event.accion).toBe(accion);
        expect(event.entidadTipo).toBe("Asignatura");
        expect(event.entidadId).toBe(13);
        expect(event.datos).toEqual({ origen: "manual", campos: ["activo"] });
      },
    );

    it("carries the import digest only for the importacion origin", () => {
      const event = asignaturaActiveChangedEvent({
        asignaturaId: 14,
        activo: true,
        origin: { origen: "importacion", importacionSha256: SHA },
      });
      expect(event.datos).toEqual({
        origen: "importacion",
        importacionSha256: SHA,
        campos: ["activo"],
      });
    });
  });

  describe("Grupo", () => {
    it("created: grupo.creado, numeric id, full closed field list", () => {
      const event = grupoCreatedEvent({ grupoId: 21, origin: MANUAL_ORIGIN });
      expect(event.accion).toBe("grupo.creado");
      expect(event.entidadTipo).toBe("Grupo");
      expect(event.entidadId).toBe(21);
      expect(event.datos).toEqual({
        origen: "manual",
        campos: [
          "asignaturaId",
          "periodo",
          "numeroGrupo",
          "docenteId",
          "activo",
          "origen",
          "dias",
        ],
      });
    });

    describe("days-only and docente edits (AL-PAY, CM-GRP-6)", () => {
      const FIELDS = ["docenteId", "dias"] as const;
      const monday = encodeDias(["lunes"]);
      const mondayWednesday = encodeDias(["lunes", "miercoles"]);

      function updateFor(
        before: { docenteId: number; dias: number },
        after: { docenteId: number; dias: number },
      ) {
        return changedFields([...FIELDS], before, after);
      }

      it("a days-only change names dias and no day", () => {
        const campos = updateFor(
          { docenteId: 4, dias: monday },
          { docenteId: 4, dias: mondayWednesday },
        );
        const event = grupoUpdatedEvent({
          grupoId: 24,
          campos,
          origin: MANUAL_ORIGIN,
        });
        expect(event.datos).toEqual({ campos: ["dias"], origen: "manual" });
      });

      it("a change of both names docenteId then dias", () => {
        const campos = updateFor(
          { docenteId: 4, dias: monday },
          { docenteId: 5, dias: mondayWednesday },
        );
        expect(campos).toEqual(["docenteId", "dias"]);
        const event = grupoUpdatedEvent({
          grupoId: 24,
          campos,
          origin: MANUAL_ORIGIN,
        });
        expect(event.datos).toEqual({
          campos: ["docenteId", "dias"],
          origen: "manual",
        });
      });

      it("a docente-only change names docenteId and not dias", () => {
        const campos = updateFor(
          { docenteId: 4, dias: monday },
          { docenteId: 5, dias: monday },
        );
        expect(campos).toEqual(["docenteId"]);
      });

      it("selecting the same set again, in another order, reports no field", () => {
        const campos = updateFor(
          { docenteId: 4, dias: encodeDias(["lunes", "miercoles"]) },
          { docenteId: 4, dias: encodeDias(["miercoles", "lunes", "lunes"]) },
        );
        expect(campos).toEqual([]);
        expect(grupoWriteEvents({ kind: "unchanged", id: 24 })).toEqual([]);
      });
    });

    it("updated: grupo.actualizado lists exactly the given names", () => {
      const event = grupoUpdatedEvent({
        grupoId: 22,
        campos: ["docenteId"],
        origin: MANUAL_ORIGIN,
      });
      expect(event.accion).toBe("grupo.actualizado");
      expect(event.entidadTipo).toBe("Grupo");
      expect(event.entidadId).toBe(22);
      expect(event.datos).toEqual({ origen: "manual", campos: ["docenteId"] });
    });

    it.each([
      [true, "grupo.reactivado"],
      [false, "grupo.desactivado"],
    ] as const)(
      "activeChanged(%s) -> %s with campos [activo]",
      (activo, accion) => {
        const event = grupoActiveChangedEvent({
          grupoId: 23,
          activo,
          origin: MANUAL_ORIGIN,
        });
        expect(event.accion).toBe(accion);
        expect(event.entidadTipo).toBe("Grupo");
        expect(event.entidadId).toBe(23);
        expect(event.datos).toEqual({ origen: "manual", campos: ["activo"] });
      },
    );
  });

  it("every new action code is one of AUDIT_ACTIONS", () => {
    const events = [
      asignaturaCreatedEvent({ asignaturaId: 1, origin: MANUAL_ORIGIN }),
      asignaturaUpdatedEvent({
        asignaturaId: 1,
        campos: ["nombre"],
        origin: MANUAL_ORIGIN,
      }),
      asignaturaActiveChangedEvent({
        asignaturaId: 1,
        activo: false,
        origin: MANUAL_ORIGIN,
      }),
      asignaturaActiveChangedEvent({
        asignaturaId: 1,
        activo: true,
        origin: MANUAL_ORIGIN,
      }),
      grupoCreatedEvent({ grupoId: 1, origin: MANUAL_ORIGIN }),
      grupoUpdatedEvent({
        grupoId: 1,
        campos: ["docenteId"],
        origin: MANUAL_ORIGIN,
      }),
      grupoActiveChangedEvent({
        grupoId: 1,
        activo: false,
        origin: MANUAL_ORIGIN,
      }),
      grupoActiveChangedEvent({
        grupoId: 1,
        activo: true,
        origin: MANUAL_ORIGIN,
      }),
    ];
    for (const event of events) {
      expect(AUDIT_ACTIONS).toContain(event.accion);
      expect("actorId" in event).toBe(false);
      expect("ocurridoEn" in event).toBe(false);
    }
  });

  it("a manual origin cannot carry importacionSha256 (compile-time pin)", () => {
    const event = asignaturaCreatedEvent({
      asignaturaId: 1,
      // @ts-expect-error - the manual variant has no digest field at all.
      origin: { origen: "manual", importacionSha256: SHA },
    });
    expect(event).toBeDefined();
  });

  it("payloads hold field names only: forbidden-key and value sweep over every builder", () => {
    const forbiddenKeys = [
      "clave",
      "password",
      "hash",
      "hashClave",
      "nombre",
      "correo",
      "codigo",
      "periodo",
      "numeroGrupo",
      "importacionSha256",
      "dias",
    ];
    // Sentinel values a builder must never be able to echo: none of these can
    // even be passed in (ids, booleans and closed names are the only inputs).
    // The day sentinels are two masks (Mon+Wed+Fri+Sun, Tue+Thu+Sat), a day
    // code, its display form and a count of days (AL-PAY).
    const sentinels = [
      "SENTINEL-NOMBRE",
      "SENTINEL-CORREO",
      "2026-I",
      "G-77",
      String(encodeDias(["lunes", "miercoles", "viernes", "domingo"])),
      String(encodeDias(["martes", "jueves", "sabado"])),
      "lunes",
      "Lunes",
      "4 days",
    ];

    const events = [
      asignaturaCreatedEvent({ asignaturaId: 7, origin: MANUAL_ORIGIN }),
      asignaturaUpdatedEvent({
        asignaturaId: 7,
        campos: ["nombre", "horasTotales"],
        origin: MANUAL_ORIGIN,
      }),
      asignaturaActiveChangedEvent({
        asignaturaId: 7,
        activo: false,
        origin: MANUAL_ORIGIN,
      }),
      grupoCreatedEvent({ grupoId: 8, origin: MANUAL_ORIGIN }),
      grupoUpdatedEvent({
        grupoId: 8,
        campos: ["docenteId"],
        origin: MANUAL_ORIGIN,
      }),
      grupoUpdatedEvent({
        grupoId: 8,
        campos: ["docenteId", "dias"],
        origin: MANUAL_ORIGIN,
      }),
      grupoActiveChangedEvent({
        grupoId: 8,
        activo: true,
        origin: MANUAL_ORIGIN,
      }),
    ];

    function sweep(value: unknown): void {
      if (value === null || typeof value !== "object") return;
      for (const [key, nested] of Object.entries(value)) {
        expect(forbiddenKeys).not.toContain(key);
        sweep(nested);
      }
    }

    for (const event of events) {
      // `campos` entries are field NAMES (strings in an array), never keys.
      sweep(event.datos);
      const serialised = JSON.stringify(event.datos);
      for (const sentinel of sentinels) {
        expect(serialised).not.toContain(sentinel);
      }
      expect(Object.keys(event.datos).sort()).toEqual(["campos", "origen"]);
    }
  });
});

describe("solicitudPresentadaEvent (justification-intake RNF-06, RNF-02)", () => {
  it("targets the Solicitud and carries only counts", () => {
    expect(
      solicitudPresentadaEvent({
        solicitudId: 4,
        asignaturas: 2,
        documentos: 3,
      }),
    ).toEqual({
      accion: "solicitud.presentada",
      entidadTipo: "Solicitud",
      entidadId: 4,
      datos: { asignaturas: 2, documentos: 3 },
    });
  });

  it("is registered in AUDIT_ACTIONS and the payload holds no personal data", () => {
    expect(AUDIT_ACTIONS).toContain("solicitud.presentada");
    const json = JSON.stringify(
      solicitudPresentadaEvent({
        solicitudId: 9,
        asignaturas: 1,
        documentos: 1,
      }).datos,
    );
    expect(json).not.toMatch(
      /causa|fecha|nombre|cif|correo|carrera|pathname|url|http|token/i,
    );
  });
});

describe("write results to events (AL-ONE, CM-AUD-1)", () => {
  type AsignaturaResult = AsignaturaWriteResult | AsignaturaActiveResult;
  type GrupoResult = GrupoWriteResult | GrupoActiveResult;

  // `Record` over the kind union: a kind added to a result union without a row
  // here fails the typecheck (exhaustiveness over each union).
  const ASIGNATURA_EVENT_COUNT: Record<AsignaturaResult["kind"], 0 | 1> = {
    created: 1,
    updated: 1,
    changed: 1,
    unchanged: 0,
    not_found: 0,
    codigo_taken: 0,
    carrera_invalid: 0,
    has_active_groups: 0,
    inactive: 0,
  };
  const GRUPO_EVENT_COUNT: Record<GrupoResult["kind"], 0 | 1> = {
    created: 1,
    updated: 1,
    changed: 1,
    unchanged: 0,
    not_found: 0,
    grupo_taken: 0,
    asignatura_unavailable: 0,
    docente_unavailable: 0,
    inactive: 0,
  };

  const asignaturaResults: AsignaturaResult[] = [
    { kind: "created", id: 1 },
    { kind: "updated", id: 1, campos: ["nombre"] },
    { kind: "changed", id: 1, activo: false },
    { kind: "unchanged", id: 1 },
    { kind: "not_found" },
    { kind: "codigo_taken", inScope: true, activo: false },
    { kind: "carrera_invalid" },
    { kind: "has_active_groups", count: 2 },
    { kind: "inactive" },
  ];
  const grupoResults: GrupoResult[] = [
    { kind: "created", id: 2 },
    { kind: "updated", id: 2, campos: ["docenteId"] },
    { kind: "changed", id: 2, activo: true },
    { kind: "unchanged", id: 2 },
    { kind: "not_found" },
    { kind: "grupo_taken", activo: true },
    { kind: "asignatura_unavailable" },
    { kind: "docente_unavailable" },
    { kind: "inactive" },
  ];

  it("asignaturaWriteEvents: one event per success, [] per refusal and no-op", () => {
    expect(new Set(asignaturaResults.map((r) => r.kind))).toEqual(
      new Set(Object.keys(ASIGNATURA_EVENT_COUNT)),
    );
    for (const result of asignaturaResults) {
      expect(asignaturaWriteEvents(result)).toHaveLength(
        ASIGNATURA_EVENT_COUNT[result.kind],
      );
    }
  });

  it("grupoWriteEvents: one event per success, [] per refusal and no-op", () => {
    expect(new Set(grupoResults.map((r) => r.kind))).toEqual(
      new Set(Object.keys(GRUPO_EVENT_COUNT)),
    );
    for (const result of grupoResults) {
      expect(grupoWriteEvents(result)).toHaveLength(
        GRUPO_EVENT_COUNT[result.kind],
      );
    }
  });

  it("maps each success to its manual-origin builder", () => {
    expect(asignaturaWriteEvents({ kind: "created", id: 5 })).toEqual([
      asignaturaCreatedEvent({ asignaturaId: 5, origin: MANUAL_ORIGIN }),
    ]);
    expect(
      asignaturaWriteEvents({ kind: "updated", id: 5, campos: ["nombre"] }),
    ).toEqual([
      asignaturaUpdatedEvent({
        asignaturaId: 5,
        campos: ["nombre"],
        origin: MANUAL_ORIGIN,
      }),
    ]);
    expect(
      asignaturaWriteEvents({ kind: "changed", id: 5, activo: true }),
    ).toEqual([
      asignaturaActiveChangedEvent({
        asignaturaId: 5,
        activo: true,
        origin: MANUAL_ORIGIN,
      }),
    ]);
    expect(grupoWriteEvents({ kind: "created", id: 6 })).toEqual([
      grupoCreatedEvent({ grupoId: 6, origin: MANUAL_ORIGIN }),
    ]);
    expect(
      grupoWriteEvents({ kind: "updated", id: 6, campos: ["docenteId"] }),
    ).toEqual([
      grupoUpdatedEvent({
        grupoId: 6,
        campos: ["docenteId"],
        origin: MANUAL_ORIGIN,
      }),
    ]);
    expect(grupoWriteEvents({ kind: "changed", id: 6, activo: false })).toEqual(
      [
        grupoActiveChangedEvent({
          grupoId: 6,
          activo: false,
          origin: MANUAL_ORIGIN,
        }),
      ],
    );
  });

  it("an inactive edit is refused and writes nothing (A-1)", () => {
    expect(asignaturaWriteEvents({ kind: "inactive" })).toEqual([]);
    expect(grupoWriteEvents({ kind: "inactive" })).toEqual([]);
  });
});

describe("review event builders (RF-07, RF-08, RNF-06, RN-02)", () => {
  type Case = {
    name: string;
    event: AuditEvent;
    accion: string;
    entidadTipo: string;
    entidadId: number;
  };

  const cases: Case[] = [
    {
      name: "approval",
      event: solicitudDecididaEvent({
        solicitudId: 41,
        tipo: "aprobada",
        decisionId: 7,
        plantilla: "aprobacion.general",
        textoEditado: false,
      }),
      accion: "solicitud.aprobada",
      entidadTipo: "Solicitud",
      entidadId: 41,
    },
    {
      name: "rejection",
      event: solicitudDecididaEvent({
        solicitudId: 42,
        tipo: "rechazada",
        decisionId: 8,
        plantilla: "rechazo.general",
        textoEditado: true,
      }),
      accion: "solicitud.rechazada",
      entidadTipo: "Solicitud",
      entidadId: 42,
    },
    {
      name: "return",
      event: solicitudDecididaEvent({
        solicitudId: 43,
        tipo: "devuelta",
        decisionId: 9,
        plantilla: "devolucion.fecha_alterada",
        motivo: "fecha_alterada",
        textoEditado: false,
      }),
      accion: "solicitud.devuelta",
      entidadTipo: "Solicitud",
      entidadId: 43,
    },
    {
      name: "correction",
      event: solicitudCorregidaEvent({
        solicitudId: 44,
        revision: 2,
        asignaturas: 3,
        documentos: 2,
        documentosRetirados: 1,
      }),
      accion: "solicitud.corregida",
      entidadTipo: "Solicitud",
      entidadId: 44,
    },
    {
      name: "detail read",
      event: solicitudConsultadaEvent({ solicitudId: 45, estado: "pendiente" }),
      accion: "solicitud.consultada",
      entidadTipo: "Solicitud",
      entidadId: 45,
    },
    {
      name: "queue read",
      event: solicitudColaConsultadaEvent({ facultadId: 3, total: 12 }),
      accion: "solicitud.cola.consultada",
      entidadTipo: "Facultad",
      entidadId: 3,
    },
    {
      name: "document retirement",
      event: documentoRetiradoEvent({ documentoId: 77, solicitudId: 46 }),
      accion: "documento.retirado",
      entidadTipo: "DocumentoRespaldo",
      entidadId: 77,
    },
  ];

  it.each(cases)(
    "$name maps to $accion on $entidadTipo $entidadId",
    ({ event, accion, entidadTipo, entidadId }) => {
      expect(event.accion).toBe(accion);
      expect(event.entidadTipo).toBe(entidadTipo);
      expect(event.entidadId).toBe(entidadId);
      expect(AUDIT_ACTIONS).toContain(accion);
    },
  );

  it("decision payloads carry ids and codes only", () => {
    expect(cases[0].event.datos).toEqual({
      decisionId: 7,
      plantilla: "aprobacion.general",
      textoEditado: false,
    });
    expect(cases[2].event.datos).toEqual({
      decisionId: 9,
      plantilla: "devolucion.fecha_alterada",
      motivo: "fecha_alterada",
      textoEditado: false,
    });
  });

  it("omits the return reason key for approval and rejection", () => {
    expect(Object.keys(cases[0].event.datos)).not.toContain("motivo");
    expect(Object.keys(cases[1].event.datos)).not.toContain("motivo");
  });

  it("correction, read and retirement payloads are counts, state and ids", () => {
    expect(cases[3].event.datos).toEqual({
      revision: 2,
      asignaturas: 3,
      documentos: 2,
      documentosRetirados: 1,
    });
    expect(cases[4].event.datos).toEqual({ estado: "pendiente" });
    expect(cases[5].event.datos).toEqual({ total: 12 });
    expect(cases[6].event.datos).toEqual({ solicitudId: 46 });
  });

  it("the queue payload carries the count and no request id list", () => {
    const { datos } = solicitudColaConsultadaEvent({ facultadId: 3, total: 3 });
    expect(Object.keys(datos)).toEqual(["total"]);
  });

  it("no payload leaks text, names, CIF, email, dates, file names or id lists", () => {
    // Builders accept only ids, codes and counts, so the serialized payloads
    // can hold nothing else: pin the key sets and value types.
    for (const { event } of cases) {
      const datos = event.datos as Record<string, unknown>;
      expect(Object.keys(datos).length).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(datos)) {
        expect(key).not.toMatch(
          /texto$|nombre|cif|correo|email|fecha|causa|carrera|pathname|ids$/i,
        );
        expect(["number", "string", "boolean"]).toContain(typeof value);
        if (typeof value === "string") {
          expect(value).toMatch(/^[a-z_.]+$/);
        }
      }
      expect(JSON.stringify(datos)).not.toMatch(/\d{4}-\d{2}-\d{2}|@|\.pdf/);
    }
  });

  it("leaves the existing solicitud.presentada payload unchanged", () => {
    expect(
      solicitudPresentadaEvent({
        solicitudId: 4,
        asignaturas: 2,
        documentos: 1,
      }).datos,
    ).toEqual({ asignaturas: 2, documentos: 1 });
  });
});
