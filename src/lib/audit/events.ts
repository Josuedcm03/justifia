// src/lib/audit/events.ts — PURE, total, the ONLY constructors of `AuditEvent`
// (decision 22). No parameter here has a credential type; adding one would be
// a visible signature change, which is what makes a leak compile-time
// impossible. `actorId` and `ocurridoEn` are never accepted: the actor comes
// from the session at write time, and the timestamp is the column default.

import type { RolUsuario } from "@/lib/validations/auth";

import type { ImportSummary } from "../import/types";
import { AUDITABLE_USER_FIELDS } from "./types";
import type { AuditableUserField, AuditEvent } from "./types";

export function importAppliedEvent(summary: ImportSummary): AuditEvent {
  return {
    accion: "catalogo.importacion.aplicada",
    entidadTipo: "Importacion",
    entidadId: null,
    datos: {
      archivoSha256: summary.fileSha256,
      conteos: summary.counts,
      cuentasCreadas: summary.accountsCreated,
      cuentasActualizadas: summary.accountsUpdated,
    },
  };
}

/** A newly created account has every auditable field set at once — `campos`
 *  reports the closed field-name list itself, never a value, so this stays
 *  a total function with no "which fields did I just set" bookkeeping to
 *  thread through the caller. */
export function accountCreatedEvent(args: {
  usuarioId: number;
  rol: RolUsuario;
  importacionSha256: string;
}): AuditEvent {
  return {
    accion: "usuario.creado",
    entidadTipo: "Usuario",
    entidadId: args.usuarioId,
    datos: {
      campos: AUDITABLE_USER_FIELDS,
      rol: args.rol,
      origen: "importacion",
      importacionSha256: args.importacionSha256,
    },
  };
}

export function accountUpdatedEvent(args: {
  usuarioId: number;
  rol: RolUsuario;
  campos: readonly AuditableUserField[];
  importacionSha256: string;
}): AuditEvent {
  return {
    accion: "usuario.actualizado",
    entidadTipo: "Usuario",
    entidadId: args.usuarioId,
    datos: {
      campos: args.campos,
      rol: args.rol,
      origen: "importacion",
      importacionSha256: args.importacionSha256,
    },
  };
}

export type TouchedAccount = {
  usuarioId: number;
  rol: RolUsuario;
  kind: "creado" | "actualizado";
  /** Ignored for `kind: "creado"` (see `accountCreatedEvent`); required for
   *  `kind: "actualizado"`, where it must list only the fields that
   *  actually changed. */
  campos: readonly AuditableUserField[];
};

/** 1 import event + one per created/updated account. `unchanged` accounts
 *  (absent from `touched`) never produce an event. `importacionSha256`
 *  always propagates from `summary.fileSha256` — never re-derived, never a
 *  second source of truth. */
export function buildAuditEvents(
  summary: ImportSummary,
  touched: readonly TouchedAccount[],
): AuditEvent[] {
  return [
    importAppliedEvent(summary),
    ...touched.map((t) =>
      t.kind === "creado"
        ? accountCreatedEvent({
            usuarioId: t.usuarioId,
            rol: t.rol,
            importacionSha256: summary.fileSha256,
          })
        : accountUpdatedEvent({
            usuarioId: t.usuarioId,
            rol: t.rol,
            campos: t.campos,
            importacionSha256: summary.fileSha256,
          }),
    ),
  ];
}
