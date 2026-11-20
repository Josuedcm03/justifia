import "server-only";

import { and, asc, eq, isNull, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { documentoRespaldo, extraccionDocumento } from "@/db/schema";
import type { TipoDocumento } from "@/lib/document-data/types";

// The narrow read behind the read-only block of the coordination detail
// (manual-document-data, MD-30). It selects the type, the firma and the sello
// of each current student document, plus its id and name: never the manual
// record and never an extracted value, so the name, the issuer, the dates and
// the rest period cannot reach the coordinator (RNF-01, RNF-02). The only
// extraction column in the statement is the state, used to leave out the same
// documents the staff read leaves out. It writes nothing and adds no audit row.

/** One current student document and its registered type and marks. */
export type DocumentMarksItem = {
  documentoId: number;
  nombreOriginal: string;
  /** Null is "not registered", never "No". */
  type: TipoDocumento | null;
  hasSignature: boolean | null;
  hasSeal: boolean | null;
};

export type DocumentMarksList = {
  data: DocumentMarksItem[];
  /** True when the read failed: show one notice, never partial entries. */
  degraded: boolean;
};

/**
 * The type and marks of every current, finalized student document of a
 * request, oldest first. The filters are those of `listExtractions`, so the
 * coordinator and the secretary see the same documents. Fail-soft: a failed
 * query is an empty, degraded result and logs the request id and the error
 * name only. The caller has already proven the request is an escalation of the
 * coordinator's own career.
 */
export async function listDocumentMarks(
  solicitudId: number,
): Promise<DocumentMarksList> {
  try {
    const rows = await db
      .select({
        documentoId: documentoRespaldo.id,
        nombreOriginal: documentoRespaldo.nombreOriginal,
        tipoDocumento: documentoRespaldo.tipoDocumento,
        tieneFirma: documentoRespaldo.tieneFirma,
        tieneSello: documentoRespaldo.tieneSello,
      })
      .from(documentoRespaldo)
      .leftJoin(
        extraccionDocumento,
        eq(extraccionDocumento.documentoId, documentoRespaldo.id),
      )
      .where(
        and(
          eq(documentoRespaldo.solicitudId, solicitudId),
          eq(documentoRespaldo.estado, "valido"),
          isNull(documentoRespaldo.retiradoEn),
          isNull(documentoRespaldo.subidoPorId),
          or(
            isNull(extraccionDocumento.estado),
            ne(extraccionDocumento.estado, "no_aplica"),
          ),
        ),
      )
      .orderBy(asc(documentoRespaldo.id));
    return {
      degraded: false,
      data: rows.map((r) => ({
        documentoId: r.documentoId,
        nombreOriginal: r.nombreOriginal,
        type: r.tipoDocumento as TipoDocumento | null,
        hasSignature: r.tieneFirma,
        hasSeal: r.tieneSello,
      })),
    };
  } catch (error) {
    console.error("document_marks_read_failed", {
      solicitudId,
      code: error instanceof Error ? error.name : "unknown",
    });
    return { data: [], degraded: true };
  }
}
