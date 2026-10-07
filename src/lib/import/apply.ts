import "server-only";

import { eq, inArray } from "drizzle-orm";

import type { db as database } from "@/db";
import { asignatura, grupo, rol, usuario } from "@/db/schema";
import {
  asignaturaActiveChangedEvent,
  buildAuditEvents,
  type TouchedAccount,
} from "@/lib/audit/events";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import { loadCatalogSnapshot } from "@/lib/data/catalog";
import { acquireCatalogWriteLock } from "@/lib/data/catalog-write";
import { createUsuariosBulk } from "@/lib/data/users";

import { WRITE_CHUNK_ROWS } from "./limits";
import { normalizeEmail } from "./normalize";
import { planImport } from "./plan";
import { buildImportSummary } from "./summary";
import type {
  CatalogSnapshot,
  ImportPlan,
  ImportSummary,
  ImportWrites,
  ParsedWorkbook,
  RowError,
  TemporaryCredential,
} from "./types";

/** A planned new account's credential: the plaintext `clave` only travels back
 *  to the caller; `hashClave` (bcrypt, computed outside the transaction) is
 *  the only part ever written. */
export type ProvisionedAccount = TemporaryCredential & { hashClave: string };

export type ApplyContext = {
  /** Snapshot read on THIS transaction, the one `plan` was built from. */
  snapshot: CatalogSnapshot;
  actorId: number;
  /** Actor label for the summary (login), never an id. */
  actor: string;
  at: string;
  fileSha256: string;
};

export type ApplyResult = {
  summary: ImportSummary;
  /** Only for accounts actually created by this apply. */
  credentials: TemporaryCredential[];
};

function chunk<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += WRITE_CHUNK_ROWS) {
    out.push(items.slice(i, i + WRITE_CHUNK_ROWS));
  }
  return out;
}

/** Returns the `Id` of every Asignatura by `Codigo`: snapshot plus created. */
async function writeAsignaturas(
  tx: Transaction,
  writes: ImportWrites["asignaturas"],
  snapshot: CatalogSnapshot,
): Promise<Map<string, number>> {
  const idByCodigo = new Map(snapshot.asignaturas.map((a) => [a.codigo, a.id]));
  const creates = writes.flatMap((w) =>
    w.kind === "create"
      ? [
          {
            codigo: w.codigo,
            nombre: w.nombre,
            carreraId: w.carreraId,
            horasTotales: w.horasTotales,
          },
        ]
      : [],
  );
  for (const part of chunk(creates)) {
    const inserted = await tx
      .insert(asignatura)
      .values(part)
      .returning({ id: asignatura.id, codigo: asignatura.codigo });
    for (const r of inserted) idByCodigo.set(r.codigo, r.id);
  }
  for (const w of writes) {
    if (w.kind !== "update") continue;
    await tx
      .update(asignatura)
      .set({
        nombre: w.nombre,
        carreraId: w.carreraId,
        horasTotales: w.horasTotales,
        ...(w.reactivated ? { activo: true } : {}),
      })
      .where(eq(asignatura.id, w.id));
  }
  return idByCodigo;
}

type UsuariosWritten = {
  /** Account `Id` by normalized `Correo`: snapshot plus created. */
  idByCorreo: Map<string, number>;
  /** Created and updated accounts, for the audit log. */
  touched: TouchedAccount[];
  /** Plaintext credentials of the accounts created here, and only those. */
  credentials: TemporaryCredential[];
};

async function writeUsuarios(
  tx: Transaction,
  writes: ImportWrites["usuarios"],
  provisioned: readonly ProvisionedAccount[],
  snapshot: CatalogSnapshot,
): Promise<UsuariosWritten> {
  const idByCorreo = new Map(
    snapshot.usuarios.flatMap((u) =>
      u.correo === null ? [] : [[normalizeEmail(u.correo), u.id] as const],
    ),
  );
  const touched: TouchedAccount[] = [];
  const credentials: TemporaryCredential[] = [];

  const creates = writes.flatMap((w) => (w.kind === "create" ? [w] : []));
  if (creates.length > 0) {
    const [docenteRol] = await tx
      .select({ id: rol.id })
      .from(rol)
      .where(eq(rol.codigo, "docente"))
      .limit(1);
    if (!docenteRol) throw new Error('applyImport: role "docente" not found');
    const provisionedByLogin = new Map(provisioned.map((c) => [c.login, c]));
    const rows = creates.map((w) => {
      const account = provisionedByLogin.get(w.login);
      if (!account) {
        throw new Error(`applyImport: no credential for "${w.login}"`);
      }
      credentials.push({
        login: account.login,
        nombreCompleto: account.nombreCompleto,
        clave: account.clave,
      });
      return {
        login: w.login,
        correo: w.correo,
        nombreCompleto: w.nombreCompleto,
        telefono: w.telefono,
        hashClave: account.hashClave,
        rolId: docenteRol.id,
      };
    });
    const ids = await createUsuariosBulk(tx, rows);
    creates.forEach((w, i) => {
      idByCorreo.set(w.correo, ids[i]);
      touched.push({
        usuarioId: ids[i],
        rol: "docente",
        kind: "creado",
        campos: [],
      });
    });
  }

  for (const w of writes) {
    if (w.kind !== "update") continue;
    // Never `hashClave`, `login` or `activo`: an update keeps the account
    // credentials and an inactive matched account stays inactive.
    await tx
      .update(usuario)
      .set({ nombreCompleto: w.nombreCompleto, telefono: w.telefono })
      .where(eq(usuario.id, w.id));
    touched.push({
      usuarioId: w.id,
      rol: "docente",
      kind: "actualizado",
      campos: w.changedFields,
    });
  }
  return { idByCorreo, touched, credentials };
}

/** Group references travel as natural keys; they resolve here, after the
 *  Asignatura and Usuario writes have produced their ids. */
async function writeGrupos(
  tx: Transaction,
  writes: ImportWrites["grupos"],
  asignaturaIdByCodigo: ReadonlyMap<string, number>,
  usuarioIdByCorreo: ReadonlyMap<string, number>,
): Promise<void> {
  const docenteId = (correo: string): number => {
    const id = usuarioIdByCorreo.get(correo);
    if (id === undefined) {
      throw new Error(`applyImport: unresolved docente "${correo}"`);
    }
    return id;
  };
  const creates = writes.flatMap((w) => {
    if (w.kind !== "create") return [];
    const asignaturaId = asignaturaIdByCodigo.get(w.asignaturaCodigo);
    if (asignaturaId === undefined) {
      throw new Error(
        `applyImport: unresolved asignatura "${w.asignaturaCodigo}"`,
      );
    }
    return [
      {
        asignaturaId,
        periodo: w.periodo,
        numeroGrupo: w.numeroGrupo,
        docenteId: docenteId(w.docenteCorreo),
      },
    ];
  });
  for (const part of chunk(creates)) {
    await tx.insert(grupo).values(part);
  }
  for (const w of writes) {
    if (w.kind !== "update") continue;
    await tx
      .update(grupo)
      .set({
        docenteId: docenteId(w.docenteCorreo),
        ...(w.reactivated ? { activo: true } : {}),
      })
      .where(eq(grupo.id, w.id));
  }
}

/** Deactivate absent: an update, never a delete. */
async function deactivateGrupos(
  tx: Transaction,
  ids: readonly number[],
): Promise<void> {
  for (const part of chunk(ids)) {
    await tx
      .update(grupo)
      .set({ activo: false })
      .where(inArray(grupo.id, part));
  }
}

/**
 * Executes an already-decided plan on the transaction handle: entity writes
 * in dependency order (Asignatura, Usuario, Grupo, deactivations), then the
 * audit rows as the LAST statement group on the same `tx` (decision 23). No
 * delete statement exists in this file.
 */
export async function applyImport(
  tx: Transaction,
  plan: ImportPlan,
  credentials: readonly ProvisionedAccount[],
  ctx: ApplyContext,
): Promise<ApplyResult> {
  if (!plan.ok) {
    throw new Error("applyImport: refusing to apply a plan with errors");
  }
  const { asignaturas, usuarios, grupos } = plan.writes;

  const asignaturaIds = await writeAsignaturas(tx, asignaturas, ctx.snapshot);
  const written = await writeUsuarios(tx, usuarios, credentials, ctx.snapshot);
  await writeGrupos(tx, grupos, asignaturaIds, written.idByCorreo);
  await deactivateGrupos(tx, plan.deactivateGrupoIds);

  const accountsCreated = written.touched.filter(
    (t) => t.kind === "creado",
  ).length;
  const summary = buildImportSummary({
    actor: ctx.actor,
    at: ctx.at,
    fileSha256: ctx.fileSha256,
    counts: plan.counts,
    accountsCreated,
    accountsUpdated: written.touched.length - accountsCreated,
    asignaturasReactivated: plan.asignaturasToReactivate,
    manualGruposDeactivated: plan.manualGruposToDeactivate,
  });

  // Created accounts only have an id after their INSERT ... RETURNING, so the
  // events cannot be built earlier; a rollback discards them with the rest.
  const origin = {
    origen: "importacion",
    importacionSha256: ctx.fileSha256,
  } as const;
  const reactivations = asignaturas.flatMap((w) =>
    w.kind === "update" && w.reactivated
      ? [
          asignaturaActiveChangedEvent({
            asignaturaId: w.id,
            activo: true,
            origin,
          }),
        ]
      : [],
  );
  await insertAuditEvents(tx, ctx.actorId, [
    ...buildAuditEvents(summary, written.touched),
    ...reactivations,
  ]);

  return { summary, credentials: written.credentials };
}

/** Re-exported so the Server Action maps a busy lock without importing the
 *  write wrapper itself (the preview must never touch the lock). */
export { CatalogBusyError } from "@/lib/data/catalog-write";

/** The workbook no longer plans cleanly (at preview time, or by confirm time
 *  inside the transaction). Carries every row error; nothing was written. */
export class ImportRejectedError extends Error {
  constructor(readonly errors: readonly RowError[]) {
    super(`Import rejected: ${errors.length} row error(s)`);
    this.name = "ImportRejectedError";
  }
}

export type RunImportApplyInput = {
  db: typeof database;
  parsed: ParsedWorkbook;
  /** Digest of the bytes the server actually received (decision 15). */
  sha256: string;
  actor: { id: number; login: string };
  /** bcrypt (cost 12). Injected so tests need no real hashing. */
  hash: (plain: string) => Promise<string>;
  /** Temporary password generator (CSPRNG by default at the call site). */
  generate: () => string;
  now?: () => Date;
};

/**
 * Whole-import orchestration. Order matters:
 *  1. plan against a snapshot read on `db` to learn WHICH accounts are new;
 *  2. generate + bcrypt a password for those only, OUTSIDE the transaction
 *     (~0.25 s each; keeping it out keeps the transaction short);
 *  3. open the transaction, take the catalog write lock, re-read the snapshot on `tx`, plan AGAIN and apply
 *     that plan, so a database that changed since step 1 is never trusted.
 * Any throw rolls everything back and the caller gets no credentials.
 */
export async function runImportApply(
  input: RunImportApplyInput,
): Promise<ApplyResult> {
  const { db, parsed, sha256, actor, hash, generate } = input;
  const now = input.now ?? (() => new Date());

  const preview = planImport(parsed, await loadCatalogSnapshot(db));
  if (!preview.ok) throw new ImportRejectedError(preview.errors);

  const provisioned: ProvisionedAccount[] = [];
  for (const w of preview.writes.usuarios) {
    if (w.kind !== "create") continue;
    const clave = generate();
    provisioned.push({
      login: w.login,
      nombreCompleto: w.nombreCompleto,
      clave,
      hashClave: await hash(clave),
    });
  }

  return db.transaction(async (tx) => {
    // First statement of the transaction: serialises with manual catalog
    // writers; a busy lock surfaces as `CatalogBusyError` (CEI-BUSY).
    await acquireCatalogWriteLock(tx);
    const snapshot = await loadCatalogSnapshot(tx);
    const plan = planImport(parsed, snapshot);
    if (!plan.ok) throw new ImportRejectedError(plan.errors);
    return applyImport(tx, plan, provisioned, {
      snapshot,
      actorId: actor.id,
      actor: actor.login,
      at: now().toISOString(),
      fileSha256: sha256,
    });
  });
}
