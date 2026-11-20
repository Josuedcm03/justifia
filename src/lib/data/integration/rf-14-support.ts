import { createHash, randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { expect } from "vitest";

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import {
  documentoRespaldo,
  extraccionDocumento,
  solicitud,
  solicitudAsignatura,
  type NuevaExtraccionDocumento,
  type NuevoDocumentoRespaldo,
} from "@/db/schema";
import {
  saveDocumentData,
  type DocumentDataInput,
  type SaveDocumentDataResult,
} from "@/lib/data/document-data";
import { listDocumentMarks } from "@/lib/data/document-marks-read";
import { listExtractions } from "@/lib/data/extraction";
import { createFixtures, PDF_BYTES } from "@/lib/data/integration/fixtures";
import { loadSignals } from "@/lib/data/signals";
import type { ExtractionError } from "@/lib/extraction/states";
import type { Causa } from "@/lib/intake/causes";
import { inclusiveDays } from "@/lib/intake/dates";
import { buildPathname } from "@/lib/intake/pathnames";
import type { RequestScope } from "@/lib/intake/request-scope";
import type { EstadoSolicitud } from "@/lib/intake/states";
import type {
  SignalCode,
  SignalReport,
  SignalResult,
} from "@/lib/signals/types";

// Shared harness of the RF-14 acceptance suites (manual-document-data, tasks
// 8.7 to 8.10). One file per inciso names its own scenarios, in the pattern of
// `src/lib/signals/rf-05-e.test.ts`, so the thesis can cite each file; this
// module only holds what they share: the opt-in gate, the fixtures of a
// presented request with its documents, the call of `saveDocumentData` (the
// one writer, called directly, as the review action does) and the readers.
//
// Every suite writes rows for real, so it runs only on a disposable Neon
// branch with the owner's explicit yes (tasks 9.2 and 10.1):
//   INTEGRATION_DATABASE_URL=<disposable branch url> \
//   INTEGRATION_ALLOW_WRITES=1 npm run test:integration -- \
//     src/lib/data/integration/rf-14-a.integration.test.ts
// The branch needs migration `0015_manual_document_data` applied. Without
// INTEGRATION_DATABASE_URL the suites report skipped, and `npm test` never
// collects them. Audit rows are append-only, so the secretary that saved data
// stays on the branch with its rows, by design (see `fixtures.ts`).

/**
 * The decision of `vitest.integration.setup.ts`, made before it replaced
 * DATABASE_URL. A refused gate fails loudly instead of skipping.
 */
export function integrationGate(): "run" | "skip" {
  const mode = process.env.INTEGRATION_GATE_MODE ?? "skip";
  if (mode === "refuse") {
    throw new Error(
      `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
    );
  }
  return mode === "run" ? "run" : "skip";
}

/** What a save submits when nothing is entered: no value and no mark. */
export const NOTHING: DocumentDataInput = {
  studentName: null,
  issuer: null,
  issueDate: null,
  restFrom: null,
  restTo: null,
  type: null,
  hasSignature: null,
  hasSeal: null,
};

/** An instant the evaluation reads as on time for an absence ending 2026-08-26. */
export const PRESENTED_AFTER_AUGUST = new Date(Date.UTC(2026, 7, 27, 15, 0, 0));
/** An instant the evaluation reads as on time for an absence ending 2026-11-10. */
export const PRESENTED_AFTER_NOVEMBER = new Date(
  Date.UTC(2026, 10, 11, 15, 0, 0),
);

/**
 * The extraction row of a document as the worker would have left it, as the
 * values of an insert. Only the values are built here: the insert stays in each
 * suite file, because a structural test of `src/lib/data/extraction.test.ts`
 * allows no other non-test module to write `ExtraccionDocumento`.
 */
export function extractionValues(
  documentoId: number,
  spec: ExtractionSpec,
): NuevaExtraccionDocumento {
  const at = new Date(Date.UTC(2026, 8, 1, 16, 0, 0));
  if (spec.state === "completada") {
    const restFrom = spec.restFrom ?? null;
    const restTo = spec.restTo ?? null;
    return {
      documentoId,
      estado: "completada",
      nombreEstudiante: spec.studentName ?? null,
      emisor: spec.issuer ?? null,
      fechaEmision: spec.issueDate ?? null,
      reposoDesde: restFrom,
      reposoHasta: restTo,
      reposoDias:
        restFrom !== null && restTo !== null
          ? inclusiveDays(restFrom, restTo)
          : null,
      motor: "it",
      procesadoEn: at,
    };
  }
  if (spec.state === "fallida") {
    return {
      documentoId,
      estado: "fallida",
      errorCodigo: spec.error,
      procesadoEn: at,
    };
  }
  return { documentoId, estado: "pendiente" };
}

/**
 * The values of a current student document (finalized, not retired, not
 * special format) with no registered data: the state of a document while
 * extraction is off. Only the values are built here; the insert, which adds the
 * fingerprint, stays in each suite file because the structural tests of
 * `src/lib/signals/fingerprint-exposure.test.ts` allow no other non-test module
 * to name or write that column.
 */
export function documentValues(
  requestId: number,
  name = "constancia.pdf",
): NuevoDocumentoRespaldo {
  return {
    solicitudId: requestId,
    pathname: buildPathname(requestId, randomUUID(), "pdf"),
    nombreOriginal: name,
    tipoDetectado: "pdf",
    tamanoBytes: PDF_BYTES.length,
    estado: "valido",
  };
}

export type ExtractionSpec =
  | {
      state: "completada";
      studentName?: string | null;
      issuer?: string | null;
      issueDate?: string | null;
      restFrom?: string | null;
      restTo?: string | null;
    }
  | { state: "fallida"; error: ExtractionError }
  | { state: "pendiente" };

type PresentedOptions = {
  causa: Causa;
  from: string;
  to: string;
  presentedAt: Date;
  /** Left out, a new student of the run's facultad. */
  studentId?: number;
  estado?: Exclude<EstadoSolicitud, "borrador">;
};

/** The outcome of one signal, with the reason a `not_evaluable` one carries. */
export function outcomeOf(
  report: SignalReport,
  code: SignalCode,
): SignalResult["outcome"] {
  return resultOf(report, code).outcome;
}

export function resultOf(report: SignalReport, code: SignalCode): SignalResult {
  const result = report.results.find((r) => r.signal === code);
  if (!result) throw new Error(`The report has no ${code} result`);
  return result;
}

/** The outcomes of the three signals the secretary's registration feeds. */
export function manualSignals(report: SignalReport) {
  return {
    rn11: outcomeOf(report, "rn11"),
    rn12: outcomeOf(report, "rn12"),
    rn13: outcomeOf(report, "rn13"),
  };
}

export function createWorld() {
  const fixtures = createFixtures();
  let groupId = 0;
  let staffId = 0;
  let scope: RequestScope = { kind: "none" };

  /** A fingerprint no other document of any run shares (RN-26 stays quiet). */
  const fingerprint = () =>
    createHash("sha256")
      .update(`${fixtures.run}:${randomUUID()}`)
      .digest("hex");

  /**
   * One save of `saveDocumentData` as the secretary of the run. The input is
   * the complete submitted state: whatever the call leaves out is `null`, so
   * a value not named here is cleared and a mark not named is not registered.
   */
  async function save(
    requestId: number,
    documentoId: number,
    data: Partial<DocumentDataInput>,
  ): Promise<SaveDocumentDataResult> {
    return saveDocumentData({
      actorId: staffId,
      scope,
      solicitudId: requestId,
      documentoId,
      data: { ...NOTHING, ...data },
    });
  }

  return {
    fixtures,

    /** A fingerprint no other document of any run shares (RN-26 stays quiet). */
    fingerprint,

    /** Fails fast and readable when the branch is unreachable or unmigrated. */
    async setup(): Promise<void> {
      await db
        .select({ tipo: documentoRespaldo.tipoDocumento })
        .from(documentoRespaldo)
        .limit(1);
      groupId = await fixtures.addGroup({ periodo: "IT-RF14" });
      const secretaria = await fixtures.addSecretaria();
      staffId = secretaria.id;
      scope = { kind: "facultad", facultadId: secretaria.facultadId };
    },

    async teardown(): Promise<void> {
      await fixtures.cleanup();
    },

    get staffId() {
      return staffId;
    },

    /** The review scope of the secretary of the run. */
    get scope(): RequestScope {
      return scope;
    },

    /** A presented request with one subject of the run's group. */
    async request(
      options: PresentedOptions,
    ): Promise<{ id: number; studentId: number }> {
      const studentId = options.studentId ?? (await fixtures.addStudent()).id;
      const [row] = await db
        .insert(solicitud)
        .values({
          estudianteId: studentId,
          estado: options.estado ?? "pendiente",
          causa: options.causa,
          fechaInicio: options.from,
          fechaFin: options.to,
          presentadaEn: options.presentedAt,
          estudianteNombre: "IT Estudiante",
          estudianteCif: "IT0001",
          estudianteCarrera: "IT carrera",
          estudianteCorreo: "it@integration.invalid",
        })
        .returning({ id: solicitud.id });
      await db
        .insert(solicitudAsignatura)
        .values({ solicitudId: row.id, grupoId: groupId });
      return { id: row.id, studentId };
    },

    save,

    /** A save that must succeed and write; returns whether anything changed. */
    async saveOk(
      requestId: number,
      documentoId: number,
      data: Partial<DocumentDataInput>,
    ): Promise<boolean> {
      const result = await save(requestId, documentoId, data);
      expect(result.ok).toBe(true);
      return result.ok && result.changed;
    },

    /** The signals as the secretary reads them, never degraded. */
    async signals(requestId: number): Promise<SignalReport> {
      const read = await loadSignals({
        solicitudId: requestId,
        referenceScope: scope,
      });
      expect(read.degraded).toBe(false);
      if (!read.data) throw new Error(`No report for request ${requestId}`);
      return read.data;
    },

    /** The staff read of one document of a request: effective row and marks. */
    async staffItem(requestId: number, documentoId: number) {
      const read = await listExtractions(requestId);
      expect(read.degraded).toBe(false);
      const item = read.data.find((i) => i.documentoId === documentoId);
      if (!item) throw new Error(`Document ${documentoId} is not listed`);
      return item;
    },

    /** The narrow read behind the coordination block. */
    async coordinationItem(requestId: number, documentoId: number) {
      const read = await listDocumentMarks(requestId);
      expect(read.degraded).toBe(false);
      const item = read.data.find((i) => i.documentoId === documentoId);
      if (!item) throw new Error(`Document ${documentoId} is not listed`);
      return item;
    },

    /** The extraction row exactly as stored, to prove a save never touches it. */
    async storedExtraction(documentoId: number) {
      const [row] = await db
        .select()
        .from(extraccionDocumento)
        .where(eq(extraccionDocumento.documentoId, documentoId));
      return row ?? null;
    },

    /** The audit rows of the saves of one document, oldest first. */
    async auditRows(documentoId: number) {
      return db
        .select({
          actorId: eventoAuditoria.actorId,
          accion: eventoAuditoria.accion,
          entidadTipo: eventoAuditoria.entidadTipo,
          entidadId: eventoAuditoria.entidadId,
          datos: eventoAuditoria.datos,
        })
        .from(eventoAuditoria)
        .where(
          and(
            eq(eventoAuditoria.entidadTipo, "DocumentoRespaldo"),
            eq(eventoAuditoria.entidadId, documentoId),
            eq(eventoAuditoria.accion, "documento.datos_registrados"),
          ),
        )
        .orderBy(asc(eventoAuditoria.id));
    },

    /** The state of the request as stored. */
    async requestState(requestId: number): Promise<string> {
      const [row] = await db
        .select({ estado: solicitud.estado })
        .from(solicitud)
        .where(eq(solicitud.id, requestId));
      return row.estado;
    },
  };
}

export type World = ReturnType<typeof createWorld>;
