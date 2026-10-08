// src/lib/import/plan.ts — PURE. No db, no crypto, no clock reads, no I/O.
// `planImport(workbook, snapshot)` is the whole heart of the import: it
// reads a parsed workbook and a catalog snapshot and returns an `ImportPlan`
// with every write decided, every row error collected, and nothing written.

import type { AuditableUserField } from "@/lib/audit/types";

import {
  MAX_ACCOUNT_EVENTS_PER_APPLY,
  MAX_NEW_ACCOUNTS_PER_APPLY,
} from "./limits";
import { parseDiasCell } from "./dias";
import { deriveLogin, normalizeEmail, normalizeKey } from "./normalize";
import {
  AsignaturaRowSchema,
  DocenteRowSchema,
  GrupoRowSchema,
} from "./schemas";
import type {
  AsignaturaWrite,
  CatalogSnapshot,
  EntityCounts,
  EntityName,
  GrupoWrite,
  ImportPlan,
  ParsedWorkbook,
  RowError,
  UsuarioWrite,
} from "./types";

function zeroCounts(): EntityCounts {
  return { create: 0, update: 0, unchanged: 0, deactivate: 0, error: 0 };
}

/** zod's `safeParse` issue messages already ARE the i18n keys `schemas.ts`
 *  defines; one `RowError` per issue keeps every field-level problem on a
 *  bad row visible instead of collapsing to the first. */
function issuesToRowErrors(
  sheet: string,
  rowNumber: number,
  issues: readonly { message: string; path: PropertyKey[] }[],
): RowError[] {
  return issues.map((issue) => ({
    sheet,
    row: rowNumber,
    reason: issue.message,
    value: issue.path.length > 0 ? String(issue.path[0]) : undefined,
  }));
}

type DocenteIdentity = {
  /** Existing account id, when the docente already exists. */
  id?: number;
  login: string;
  isNew: boolean;
};

export function planImport(
  workbook: ParsedWorkbook,
  snapshot: CatalogSnapshot,
): ImportPlan {
  const errors: RowError[] = [];
  const counts: Record<EntityName, EntityCounts> = {
    Asignatura: zeroCounts(),
    Usuario: zeroCounts(),
    Grupo: zeroCounts(),
  };

  // ---------------------------------------------------------------------
  // Stage A — Asignaturas: create/update by natural key `Codigo`; `Carrera`
  // is resolved read-only against the snapshot, never written (scope
  // reduction, X5). Absent Asignatura rows are never deactivated.
  // ---------------------------------------------------------------------
  const carreraIdByName = new Map(
    snapshot.carreras.map((c) => [normalizeKey(c.nombre), c.id]),
  );
  const asignaturaByCodigo = new Map(
    snapshot.asignaturas.map((a) => [a.codigo, a]),
  );
  const asignaturaWrites: AsignaturaWrite[] = [];
  const seenCodigos = new Set<string>();
  /** Codigo -> true once resolved OK, consumed by Stage C to validate the
   *  Grupos sheet's `CodigoAsignatura` reference (workbook or snapshot). */
  const knownAsignaturaCodigos = new Set(
    snapshot.asignaturas.map((a) => a.codigo),
  );
  /** Codigos the Asignaturas sheet resolved OK this run (declared), and the
   *  snapshot codes that are inactive: a Grupos row may reference an inactive
   *  Asignatura only when the workbook declares it (it is reactivated then). */
  const declaredAsignaturaCodigos = new Set<string>();
  const inactiveAsignaturaCodigos = new Set(
    snapshot.asignaturas.filter((a) => !a.activo).map((a) => a.codigo),
  );

  for (const r of workbook.sheets.Asignaturas) {
    const parsed = AsignaturaRowSchema.safeParse(r.cells);
    if (!parsed.success) {
      errors.push(
        ...issuesToRowErrors("Asignaturas", r.row, parsed.error.issues),
      );
      counts.Asignatura.error++;
      continue;
    }
    const { Codigo, Nombre, Carrera, HorasTotales } = parsed.data;

    if (seenCodigos.has(Codigo)) {
      errors.push({
        sheet: "Asignaturas",
        row: r.row,
        reason: "codigo.duplicate",
        value: Codigo,
      });
      counts.Asignatura.error++;
      continue;
    }
    seenCodigos.add(Codigo);

    const carreraId = carreraIdByName.get(normalizeKey(Carrera));
    if (carreraId === undefined) {
      errors.push({
        sheet: "Asignaturas",
        row: r.row,
        reason: "carrera.unresolved",
        value: Carrera,
      });
      counts.Asignatura.error++;
      continue;
    }

    knownAsignaturaCodigos.add(Codigo);
    declaredAsignaturaCodigos.add(Codigo);
    const existing = asignaturaByCodigo.get(Codigo);
    if (!existing) {
      asignaturaWrites.push({
        kind: "create",
        codigo: Codigo,
        nombre: Nombre,
        carreraId,
        horasTotales: HorasTotales,
      });
      counts.Asignatura.create++;
    } else if (
      !existing.activo ||
      existing.nombre !== Nombre ||
      existing.carreraId !== carreraId ||
      existing.horasTotales !== HorasTotales
    ) {
      // A match on an inactive row is always an update: the workbook lists the
      // subject, so the import reactivates it (CEI-UPS, counted as `update`).
      asignaturaWrites.push({
        kind: "update",
        id: existing.id,
        nombre: Nombre,
        carreraId,
        horasTotales: HorasTotales,
        ...(existing.activo ? {} : { reactivated: true as const }),
      });
      counts.Asignatura.update++;
    } else {
      counts.Asignatura.unchanged++;
    }
  }

  // ---------------------------------------------------------------------
  // Stage B — Docentes: identity resolution by normalized `Correo`, login
  // derivation, and update-in-place for an existing docente account. No
  // Estudiante branch: the import never creates or matches a student.
  // ---------------------------------------------------------------------
  const usuarioByCorreo = new Map(
    snapshot.usuarios
      .filter((u): u is typeof u & { correo: string } => u.correo !== null)
      .map((u) => [normalizeEmail(u.correo), u]),
  );
  const usuarioLoginsInUse = new Set(snapshot.usuarios.map((u) => u.login));
  const usuarioWrites: UsuarioWrite[] = [];
  const docenteByCorreo = new Map<string, DocenteIdentity>();
  let accountsToCreate = 0;
  const seenDocenteCorreos = new Set<string>();

  for (const r of workbook.sheets.Docentes) {
    const parsed = DocenteRowSchema.safeParse(r.cells);
    if (!parsed.success) {
      errors.push(...issuesToRowErrors("Docentes", r.row, parsed.error.issues));
      counts.Usuario.error++;
      continue;
    }
    const { Correo, Nombre, Telefono } = parsed.data;
    const correo = normalizeEmail(Correo);

    if (seenDocenteCorreos.has(correo)) {
      errors.push({
        sheet: "Docentes",
        row: r.row,
        reason: "correo.duplicate",
        value: Correo,
      });
      counts.Usuario.error++;
      continue;
    }
    seenDocenteCorreos.add(correo);

    const existing = usuarioByCorreo.get(correo);
    if (existing && existing.rol !== "docente") {
      errors.push({
        sheet: "Docentes",
        row: r.row,
        reason: "correo.assignedToOtherRole",
        value: Correo,
      });
      counts.Usuario.error++;
      continue;
    }

    const derived = deriveLogin(Correo);
    if ("error" in derived) {
      errors.push({
        sheet: "Docentes",
        row: r.row,
        reason: `correo.${derived.error}`,
        value: Correo,
      });
      counts.Usuario.error++;
      continue;
    }

    const telefono = Telefono ?? null;

    if (!existing) {
      // A brand-new docente's login is its whole normalized email — a
      // collision means an unrelated account (not matched by Correo above)
      // already carries that exact login string.
      if (usuarioLoginsInUse.has(derived.login)) {
        errors.push({
          sheet: "Docentes",
          row: r.row,
          reason: "login.collision",
          value: Correo,
        });
        counts.Usuario.error++;
        continue;
      }
      usuarioWrites.push({
        kind: "create",
        correo,
        login: derived.login,
        nombreCompleto: Nombre,
        telefono,
      });
      counts.Usuario.create++;
      accountsToCreate++;
      docenteByCorreo.set(correo, { login: derived.login, isNew: true });
      usuarioLoginsInUse.add(derived.login);
    } else {
      const changedFields: AuditableUserField[] = [];
      if (existing.nombreCompleto !== Nombre)
        changedFields.push("nombreCompleto");
      if (existing.telefono !== telefono) changedFields.push("telefono");

      if (changedFields.length > 0) {
        usuarioWrites.push({
          kind: "update",
          id: existing.id,
          nombreCompleto: Nombre,
          telefono,
          changedFields,
        });
        counts.Usuario.update++;
      } else {
        counts.Usuario.unchanged++;
      }
      docenteByCorreo.set(correo, {
        id: existing.id,
        login: existing.login,
        isNew: false,
      });
    }
  }

  // ---------------------------------------------------------------------
  // Stage C — Grupos: natural key `(Codigo, Periodo, NumGrupo)`; the
  // docente is resolved from the SAME workbook or the snapshot, and must
  // already be (or be about to become, in this same import) a docente.
  // ---------------------------------------------------------------------
  const grupoByKey = new Map(
    snapshot.grupos.map((g) => [
      `${g.asignaturaId}|${g.periodo}|${g.numeroGrupo}`,
      g,
    ]),
  );
  const asignaturaIdByCodigo = new Map(
    snapshot.asignaturas.map((a) => [a.codigo, a.id]),
  );
  const grupoWrites: GrupoWrite[] = [];
  const seenGrupoKeys = new Set<string>();
  /** Grupo ids matched by the workbook this run (present, whether create or
   *  update): everything else that was already in the snapshot is absent
   *  and gets deactivated (Stage D), never deleted. */
  const matchedGrupoIds = new Set<number>();

  for (const r of workbook.sheets.Grupos) {
    const parsed = GrupoRowSchema.safeParse(r.cells);
    if (!parsed.success) {
      errors.push(...issuesToRowErrors("Grupos", r.row, parsed.error.issues));
      counts.Grupo.error++;
      continue;
    }
    const { CodigoAsignatura, Periodo, NumGrupo, CorreoDocente, Dias } =
      parsed.data;

    // The days cell is judged right after the row schema: an unrecognised
    // token is a row error that wins over any reference error (CEI-DIAS-3).
    const diasCell = parseDiasCell(Dias ?? "");
    if (!diasCell.ok) {
      errors.push({
        sheet: "Grupos",
        row: r.row,
        reason: "dias.invalid",
        value: diasCell.token,
      });
      counts.Grupo.error++;
      continue;
    }
    const mask = diasCell.mask;

    if (!knownAsignaturaCodigos.has(CodigoAsignatura)) {
      errors.push({
        sheet: "Grupos",
        row: r.row,
        reason: "asignatura.unresolved",
        value: CodigoAsignatura,
      });
      counts.Grupo.error++;
      continue;
    }

    // Reactivating a subject the workbook never listed would be a write the
    // operator did not ask for: refuse the row instead (design decision 7).
    if (
      inactiveAsignaturaCodigos.has(CodigoAsignatura) &&
      !declaredAsignaturaCodigos.has(CodigoAsignatura)
    ) {
      errors.push({
        sheet: "Grupos",
        row: r.row,
        reason: "asignatura.inactive",
        value: CodigoAsignatura,
      });
      counts.Grupo.error++;
      continue;
    }

    const docenteCorreo = normalizeEmail(CorreoDocente);
    const docente =
      docenteByCorreo.get(docenteCorreo) ??
      (() => {
        const existing = usuarioByCorreo.get(docenteCorreo);
        return existing && existing.rol === "docente"
          ? { id: existing.id, login: existing.login, isNew: false }
          : undefined;
      })();

    if (!docente) {
      errors.push({
        sheet: "Grupos",
        row: r.row,
        reason: "docente.unresolved",
        value: CorreoDocente,
      });
      counts.Grupo.error++;
      continue;
    }

    const key = `${CodigoAsignatura}|${Periodo}|${NumGrupo}`;
    if (seenGrupoKeys.has(key)) {
      errors.push({
        sheet: "Grupos",
        row: r.row,
        reason: "grupo.duplicate",
        value: `${CodigoAsignatura} ${Periodo} ${NumGrupo}`,
      });
      counts.Grupo.error++;
      continue;
    }
    seenGrupoKeys.add(key);

    // Only groups whose Asignatura already existed BEFORE this import (i.e.
    // is in the snapshot) can possibly already have a Grupo row: a
    // same-import new Asignatura can never match an existing Grupo.
    const existingAsignaturaId = asignaturaIdByCodigo.get(CodigoAsignatura);
    const existingGrupo =
      existingAsignaturaId !== undefined
        ? grupoByKey.get(`${existingAsignaturaId}|${Periodo}|${NumGrupo}`)
        : undefined;

    if (!existingGrupo) {
      grupoWrites.push({
        kind: "create",
        asignaturaCodigo: CodigoAsignatura,
        periodo: Periodo,
        numeroGrupo: NumGrupo,
        docenteCorreo,
        ...(mask > 0 ? { dias: mask } : {}),
      });
      counts.Grupo.create++;
    } else {
      matchedGrupoIds.add(existingGrupo.id);
      const docenteChanged = existingGrupo.docenteId !== docente.id;
      const reactivated = !existingGrupo.activo;
      // An empty cell or an absent column (mask 0) never touches stored days.
      const diasChanged = mask > 0 && mask !== existingGrupo.dias;
      if (docenteChanged || reactivated || diasChanged) {
        grupoWrites.push({
          kind: "update",
          id: existingGrupo.id,
          docenteCorreo,
          reactivated,
          ...(diasChanged ? { dias: mask } : {}),
        });
        counts.Grupo.update++;
      } else {
        counts.Grupo.unchanged++;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Stage D — deactivate absent, never delete. Only ACTIVE snapshot grupos
  // that were not matched by any workbook row are deactivated; Asignatura
  // rows are never deactivated (no lifecycle for them in this import).
  // ---------------------------------------------------------------------
  const deactivateGrupoIds = snapshot.grupos
    .filter((g) => g.activo && !matchedGrupoIds.has(g.id))
    .map((g) => g.id);
  counts.Grupo.deactivate = deactivateGrupoIds.length;
  // Hand-created groups are not exempt (D3); the preview only needs to say how
  // many of the deactivations above are of that kind, so it is derived from
  // the very same list the apply executes.
  const deactivatedIds = new Set(deactivateGrupoIds);
  const manualGruposToDeactivate = snapshot.grupos.filter(
    (g) => deactivatedIds.has(g.id) && g.origen === "manual",
  ).length;

  // ---------------------------------------------------------------------
  // Stage F — caps as validation, not throws.
  // ---------------------------------------------------------------------
  if (accountsToCreate > MAX_NEW_ACCOUNTS_PER_APPLY) {
    errors.push({
      sheet: "Docentes",
      row: 0,
      reason: "accountsToCreate.capExceeded",
    });
  }
  const accountEvents = counts.Usuario.create + counts.Usuario.update;
  if (accountEvents > MAX_ACCOUNT_EVENTS_PER_APPLY) {
    errors.push({
      sheet: "Docentes",
      row: 0,
      reason: "accountEvents.capExceeded",
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    counts,
    accountsToCreate,
    writes: {
      asignaturas: asignaturaWrites,
      usuarios: usuarioWrites,
      grupos: grupoWrites,
    },
    deactivateGrupoIds,
    asignaturasToReactivate: asignaturaWrites.filter(
      (w) => w.kind === "update" && w.reactivated,
    ).length,
    manualGruposToDeactivate,
  };
}
