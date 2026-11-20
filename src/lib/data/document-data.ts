import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { documentoDatoManual, documentoRespaldo, solicitud } from "@/db/schema";
import { documentDataRecordedEvent } from "@/lib/audit/events";
import { insertAuditEvents } from "@/lib/data/audit";
import { requestRowInScope } from "@/lib/data/request-scope-sql";
import {
  DOCUMENT_DATA_FIELDS,
  type DocumentDataField,
  type DocumentMarks,
  type ManualFields,
} from "@/lib/document-data/types";
import type { RequestScope } from "@/lib/intake/request-scope";

// The one writer of the manual data record and of the three marks of a
// document (manual-document-data, MD-9). One transaction per save: it locks the
// request, re-checks that it is still `pendiente` (D6), writes the data of that
// one document and records one audit row. It reads no signal (VS-2, RN-15),
// never touches the extraction row or the request state, and logs nothing: a
// value is personal data (MD-11). Mutating and security-critical, so a failure
// throws and the transaction rolls back.

/** What a save submits: the five manual values and the three marks, `null`
 *  meaning "no value" (a cleared manual datum, or a mark not registered). */
export type DocumentDataInput = ManualFields & DocumentMarks;

export type SaveDocumentDataResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: "not_found" | "not_editable" };

const EDITABLE_STATE = "pendiente";

// The names of the closed list that live in each table.
const MANUAL_FIELDS: readonly DocumentDataField[] = [
  "nombreEstudiante",
  "emisor",
  "fechaEmision",
  "reposo",
];
const MARK_FIELDS: readonly DocumentDataField[] = [
  "tipoDocumento",
  "tieneFirma",
  "tieneSello",
];

/** The fields whose values differ, by name and in the order of the closed
 *  list (MD-33). The rest period is one field: its two dates move together. */
function changedFields(
  stored: DocumentDataInput,
  submitted: DocumentDataInput,
): DocumentDataField[] {
  const changed: Record<DocumentDataField, boolean> = {
    nombreEstudiante: stored.studentName !== submitted.studentName,
    emisor: stored.issuer !== submitted.issuer,
    fechaEmision: stored.issueDate !== submitted.issueDate,
    reposo:
      stored.restFrom !== submitted.restFrom ||
      stored.restTo !== submitted.restTo,
    tipoDocumento: stored.type !== submitted.type,
    tieneFirma: stored.hasSignature !== submitted.hasSignature,
    tieneSello: stored.hasSeal !== submitted.hasSeal,
  };
  return DOCUMENT_DATA_FIELDS.filter((field) => changed[field]);
}

/**
 * Records the data, the type and the marks of one current document (RF-14 a,
 * b, d). `data` is the complete submitted state: a manual value that is `null`
 * is cleared, so the effective value reverts to the extracted one (D8).
 *
 * Order, inside one transaction: the request is read with `FOR UPDATE` in the
 * caller's scope; a state other than `pendiente` is refused; the document must
 * be a current one (same request, `valido`, not retired, student-uploaded);
 * a save that changes nothing returns `changed: false` and writes nothing.
 * Unknown, out-of-scope and not-current ids are the same `not_found`, so the
 * action leaks nothing about which one it was (RNF-01).
 */
export async function saveDocumentData(
  input: {
    actorId: number;
    scope: RequestScope;
    solicitudId: number;
    documentoId: number;
    data: DocumentDataInput;
  },
  now: Date = new Date(),
): Promise<SaveDocumentDataResult> {
  const { scope, solicitudId, documentoId, data } = input;
  if (scope.kind === "none") return { ok: false, reason: "not_found" };

  return db.transaction(async (tx): Promise<SaveDocumentDataResult> => {
    const [locked] = await tx
      .select({ id: solicitud.id, estado: solicitud.estado })
      .from(solicitud)
      .where(requestRowInScope(scope, solicitudId))
      .limit(1)
      .for("update");
    if (!locked) return { ok: false, reason: "not_found" };
    if (locked.estado !== EDITABLE_STATE) {
      return { ok: false, reason: "not_editable" };
    }

    const [document] = await tx
      .select({
        id: documentoRespaldo.id,
        type: documentoRespaldo.tipoDocumento,
        hasSignature: documentoRespaldo.tieneFirma,
        hasSeal: documentoRespaldo.tieneSello,
      })
      .from(documentoRespaldo)
      .where(
        and(
          eq(documentoRespaldo.id, documentoId),
          eq(documentoRespaldo.solicitudId, solicitudId),
          eq(documentoRespaldo.estado, "valido"),
          isNull(documentoRespaldo.retiradoEn),
          isNull(documentoRespaldo.subidoPorId),
        ),
      )
      .limit(1);
    if (!document) return { ok: false, reason: "not_found" };

    const [record] = await tx
      .select({
        studentName: documentoDatoManual.nombreEstudiante,
        issuer: documentoDatoManual.emisor,
        issueDate: documentoDatoManual.fechaEmision,
        restFrom: documentoDatoManual.reposoDesde,
        restTo: documentoDatoManual.reposoHasta,
      })
      .from(documentoDatoManual)
      .where(eq(documentoDatoManual.documentoId, documentoId))
      .limit(1);

    const stored: DocumentDataInput = {
      studentName: record?.studentName ?? null,
      issuer: record?.issuer ?? null,
      issueDate: record?.issueDate ?? null,
      restFrom: record?.restFrom ?? null,
      restTo: record?.restTo ?? null,
      type: document.type,
      hasSignature: document.hasSignature,
      hasSeal: document.hasSeal,
    };
    const campos = changedFields(stored, data);
    if (campos.length === 0) return { ok: true, changed: false };

    const touches = (names: readonly DocumentDataField[]) =>
      campos.some((field) => names.includes(field));

    if (touches(MARK_FIELDS)) {
      await tx
        .update(documentoRespaldo)
        .set({
          tipoDocumento: data.type,
          tieneFirma: data.hasSignature,
          tieneSello: data.hasSeal,
        })
        .where(eq(documentoRespaldo.id, documentoId));
    }

    if (touches(MANUAL_FIELDS)) {
      // A manual record exists only while some value is entered (CK_DatoManual_
      // NoVacio): clearing the last one deletes it. The rest period counts
      // through its start, because CK_DatoManual_Reposo ties the two dates.
      const hasValue =
        data.studentName !== null ||
        data.issuer !== null ||
        data.issueDate !== null ||
        data.restFrom !== null;
      const values = {
        nombreEstudiante: data.studentName,
        emisor: data.issuer,
        fechaEmision: data.issueDate,
        reposoDesde: data.restFrom,
        reposoHasta: data.restTo,
        registradoPorId: input.actorId,
        actualizadoEn: now,
      };
      if (!hasValue) {
        await tx
          .delete(documentoDatoManual)
          .where(eq(documentoDatoManual.documentoId, documentoId));
      } else if (record) {
        // The row was read under the request lock, which every writer of this
        // table takes, so no other save can create or remove it meanwhile.
        await tx
          .update(documentoDatoManual)
          .set(values)
          .where(eq(documentoDatoManual.documentoId, documentoId));
      } else {
        await tx.insert(documentoDatoManual).values({ documentoId, ...values });
      }
    }

    await insertAuditEvents(tx, input.actorId, [
      documentDataRecordedEvent({ documentoId, solicitudId, campos }),
    ]);
    return { ok: true, changed: true };
  });
}
