// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  documentoRespaldo,
  escalamiento,
  remision,
  reporteInasistencia,
  solicitud,
  solicitudDecision,
  usuario,
} from "@/db/schema";
import { createFakeDocumentStore } from "@/lib/intake/fakes";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, insertAuditMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  insertAuditMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: insertAuditMock }));

import { BATCH_SIZE, MAX_BATCHES, runRetention } from "./retention";

const NOW = new Date("2031-03-10T09:00:00.000Z");
const ACTOR = 900;

const actor: Step = { kind: "select", rows: [{ id: ACTOR }] };
const due = (n: number): Step => ({ kind: "select", rows: [{ n }] });
const batch = (...ids: number[]): Step => ({
  kind: "select",
  rows: ids.map((id) => ({ id })),
});

/** The statements of one cancellation, in the order its transaction issues
 *  them. `failAt` makes that statement reject and ends the script there. */
function cancel(
  id: number,
  o: { requests?: number; paths?: string[]; failAt?: number } = {},
): Step[] {
  const steps: Step[] = [
    { kind: "update", rows: [{ id }] }, // guarded Usuario
    { kind: "select", rows: (o.paths ?? []).map((pathname) => ({ pathname })) },
    {
      kind: "update", // Solicitud
      rows: Array.from({ length: o.requests ?? 1 }, (_, i) => ({ id: i + 1 })),
    },
    { kind: "update" }, // SolicitudDecision
    { kind: "update" }, // Remision
    { kind: "update" }, // ReporteInasistencia
    { kind: "update" }, // Escalamiento
    { kind: "delete" }, // DocumentoRespaldo
  ];
  if (o.failAt === undefined) return steps;
  const failing = { ...steps[o.failAt], error: new Error("write failed") };
  return [...steps.slice(0, o.failAt), failing];
}

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function storeWith(...pathnames: string[]) {
  const store = createFakeDocumentStore();
  for (const pathname of pathnames) store.seed(pathname, [1, 2, 3]);
  return store;
}

const render = (value: unknown) =>
  new PgDialect().sqlToQuery(value as Parameters<PgDialect["sqlToQuery"]>[0]);

beforeEach(() => {
  insertAuditMock.mockReset();
});

describe("runRetention: dry run and actor (DR-9, D2)", () => {
  it("counts the due students and issues only reads", async () => {
    const double = use([actor, due(2)]);
    const store = storeWith("intake/1/a.pdf");

    const counts = await runRetention(NOW, store, { dryRun: true });

    expect(counts).toEqual({
      dryRun: true,
      due: 2,
      cancelled: 0,
      documentsDeleted: 0,
      blobsDeleted: 0,
      failures: 0,
    });
    expect(double.log.map((s) => s.kind)).toEqual(["select", "select"]);
    expect(double.transactions).toBe(0);
    expect(insertAuditMock).not.toHaveBeenCalled();
    expect(store.has("intake/1/a.pdf")).toBe(true);
  });

  it("builds a due rule that excludes students with an active enrollment (DR-2)", async () => {
    const double = use([actor, due(0)]);

    await runRetention(NOW, storeWith(), { dryRun: true });

    // The count read carries the due predicate exactly as the module built it.
    expect(render(double.log[1].where).sql).toContain(
      'NOT EXISTS (SELECT 1 FROM "Inscripcion" WHERE "Inscripcion"."EstudianteId" = "Usuario"."Id" AND "Inscripcion"."Activo")',
    );
  });

  it("throws when the system actor is missing, so the run fails closed", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await expect(runRetention(NOW, storeWith())).rejects.toThrow();
    expect(double.exhausted).toBe(true);
    expect(double.transactions).toBe(0);

    use([{ kind: "select", rows: [] }]);
    await expect(
      runRetention(NOW, storeWith(), { dryRun: true }),
    ).rejects.toThrow();
  });
});

describe("runRetention: one transaction per student (DR-3 to DR-6)", () => {
  const paths = ["intake/7/a.pdf", "intake/7/b.png", "intake/7/c.pdf"];

  it("writes every table inside the transaction, then one audit row on its handle", async () => {
    const double = use([
      actor,
      due(1),
      batch(7),
      ...cancel(7, { requests: 2, paths }),
    ]);

    const counts = await runRetention(NOW, storeWith(...paths));

    expect(counts).toEqual({
      dryRun: false,
      due: 1,
      cancelled: 1,
      documentsDeleted: 3,
      blobsDeleted: 3,
      failures: 0,
    });
    expect(double.exhausted).toBe(true);
    expect(double.transactions).toBe(1);
    expect(double.log.map((s) => s.inTransaction)).toEqual([
      false,
      false,
      false,
      ...Array(8).fill(true),
    ]);
    expect(double.log.slice(3).map((s) => [s.kind, s.table])).toEqual([
      ["update", usuario],
      ["select", documentoRespaldo],
      ["update", solicitud],
      ["update", solicitudDecision],
      ["update", remision],
      ["update", reporteInasistencia],
      ["update", escalamiento],
      ["delete", documentoRespaldo],
    ]);
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    expect(insertAuditMock).toHaveBeenCalledWith(double.tx, ACTOR, [
      {
        accion: "usuario.cancelado",
        entidadTipo: "Usuario",
        entidadId: 7,
        datos: { motivo: "retencion_5_anios", solicitudes: 2, documentos: 3 },
      },
    ]);
  });

  it("anonymizes the account and redacts the snapshots and free text (DR-3, DR-4)", async () => {
    const double = use([actor, due(1), batch(7), ...cancel(7)]);

    await runRetention(NOW, storeWith());

    const set = (n: number) => double.log[n].set as Record<string, unknown>;
    expect(set(3)).toEqual({
      nombreCompleto: "[cancelado]",
      login: "cancelado-7",
      correo: null,
      telefono: null,
      cif: null,
      hashClave: "!cancelado",
      activo: false,
      debeCambiarClave: false,
      canceladoEn: NOW,
    });
    expect(Object.keys(set(5)).sort()).toEqual([
      "canceladaEn",
      "estudianteCarrera",
      "estudianteCif",
      "estudianteCorreo",
      "estudianteNombre",
    ]);
    expect(set(5).canceladaEn).toEqual(NOW);
    expect(Object.keys(set(6))).toEqual(["texto"]);
    expect(Object.keys(set(7)).sort()).toEqual(["correo", "docenteNombre"]);
    expect(Object.keys(set(8)).sort()).toEqual(["docenteNombre", "nota"]);
    expect(Object.keys(set(9)).sort()).toEqual(["nota", "respuesta"]);
    // Free text keeps its NULL-ness (D3): a NULL stays NULL, the rest is replaced.
    const redacted = render(set(5).estudianteNombre);
    expect(redacted.sql).toMatch(/CASE WHEN .* IS NULL THEN NULL ELSE .* END/);
    expect(redacted.params).toEqual(["[cancelado]"]);
    expect(set(7).docenteNombre).toBe("[cancelado]");
  });

  it("writes one audit row per student with the system actor id", async () => {
    use([
      actor,
      due(2),
      batch(7, 8),
      ...cancel(7),
      ...cancel(8, { requests: 0 }),
    ]);

    await runRetention(NOW, storeWith());

    expect(insertAuditMock).toHaveBeenCalledTimes(2);
    const rows = insertAuditMock.mock.calls.map(([, id, events]) => [
      id,
      events[0].entidadId,
      events[0].datos.solicitudes,
    ]);
    expect(rows).toEqual([
      [ACTOR, 7, 1],
      [ACTOR, 8, 0],
    ]);
  });

  it("skips a student whose guarded update matches no row: no other write, no audit row (DR-2, DR-8)", async () => {
    const double = use([actor, due(1), batch(5), { kind: "update", rows: [] }]);

    const counts = await runRetention(NOW, storeWith());

    expect(counts).toMatchObject({ cancelled: 0, failures: 0 });
    expect(double.exhausted).toBe(true);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("rolls back a failing student, counts it and carries on (DR-6)", async () => {
    use([
      actor,
      due(3),
      batch(1, 2, 3),
      ...cancel(1, { paths: ["intake/1/a.pdf"] }),
      ...cancel(2, { paths: ["intake/2/a.pdf"], failAt: 4 }),
      ...cancel(3, { paths: ["intake/3/a.pdf"] }),
    ]);
    const store = storeWith(
      "intake/1/a.pdf",
      "intake/2/a.pdf",
      "intake/3/a.pdf",
    );

    const counts = await runRetention(NOW, store);

    expect(counts).toMatchObject({ cancelled: 2, failures: 1 });
    expect(insertAuditMock.mock.calls.map((c) => c[2][0].entidadId)).toEqual([
      1, 3,
    ]);
    expect(store.has("intake/2/a.pdf")).toBe(true);
    expect(store.has("intake/1/a.pdf")).toBe(false);
    expect(store.has("intake/3/a.pdf")).toBe(false);
  });

  it("a second run with the same now finds nothing due and writes no audit row (DR-8)", async () => {
    const first = use([actor, due(1), batch(7), ...cancel(7)]);
    await runRetention(NOW, storeWith());
    expect(first.log[3].set).toMatchObject({ canceladoEn: NOW });

    use([actor, due(0), batch()]);
    const counts = await runRetention(NOW, storeWith());

    expect(counts).toMatchObject({ due: 0, cancelled: 0, failures: 0 });
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
  });
});

describe("runRetention: blobs after commit (DR-7)", () => {
  it("deletes the files only after the audit row, never before", async () => {
    const order: string[] = [];
    insertAuditMock.mockImplementation(async () => void order.push("audit"));
    const store = storeWith("intake/7/a.pdf");
    const remove = store.delete.bind(store);
    store.delete = async (pathnames) => {
      order.push("blob");
      await remove(pathnames);
    };
    use([actor, due(1), batch(7), ...cancel(7, { paths: ["intake/7/a.pdf"] })]);

    await runRetention(NOW, store);

    expect(order).toEqual(["audit", "blob"]);
  });

  it("keeps the files of a student whose transaction fails at the audit row", async () => {
    insertAuditMock.mockRejectedValue(new Error("audit failed"));
    const store = storeWith("intake/7/a.pdf");
    use([actor, due(1), batch(7), ...cancel(7, { paths: ["intake/7/a.pdf"] })]);

    const counts = await runRetention(NOW, store);

    expect(counts).toMatchObject({
      cancelled: 0,
      blobsDeleted: 0,
      failures: 1,
    });
    expect(store.has("intake/7/a.pdf")).toBe(true);
  });

  it("counts a failed file delete and leaves the student cancelled", async () => {
    const store = storeWith("intake/7/a.pdf");
    store.delete = async () => {
      throw new Error("blob store down");
    };
    use([actor, due(1), batch(7), ...cancel(7, { paths: ["intake/7/a.pdf"] })]);

    const counts = await runRetention(NOW, store);

    expect(counts).toMatchObject({
      cancelled: 1,
      documentsDeleted: 1,
      blobsDeleted: 0,
      failures: 1,
    });
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
  });
});

describe("runRetention: bounded run (D5)", () => {
  it("pins the batch size and the batch count, and stops after the last full batch", async () => {
    expect([BATCH_SIZE, MAX_BATCHES]).toEqual([50, 10]);
    const batches = Array.from({ length: MAX_BATCHES }, (_, b) =>
      Array.from({ length: BATCH_SIZE }, (_, i) => b * BATCH_SIZE + i + 1),
    );
    const double = use([
      actor,
      due(500),
      ...batches.flatMap((ids) => [
        batch(...ids),
        ...ids.map((): Step => ({ kind: "update", rows: [] })),
      ]),
    ]);

    const counts = await runRetention(NOW, storeWith());

    // An eleventh batch read would be an unscripted statement and throw.
    expect(double.exhausted).toBe(true);
    expect(counts).toMatchObject({ due: 500, cancelled: 0, failures: 0 });
    expect(double.log.filter((s) => s.limit === BATCH_SIZE)).toHaveLength(10);
  });
});

describe("retention write surface (D1, design carve-out note)", () => {
  const SRC = join(process.cwd(), "src");
  const MODULE = "lib/data/retention.ts";

  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  }
  const read = (name: string) => readFileSync(join(SRC, name), "utf8");

  it("lets only the retention module and the policy name the system account", () => {
    const named = sources(SRC)
      .filter((file) =>
        /SYSTEM_LOGIN|SYSTEM_HASH/.test(readFileSync(file, "utf8")),
      )
      .map((file) => relative(SRC, file).split(sep).join("/"))
      .sort();

    expect(named).toEqual([MODULE, "lib/retention/policy.ts"]);
  });

  it("names no extraction or fingerprint column and writes no enrollment, comments included", () => {
    const source = read(MODULE);

    expect(source).not.toMatch(/extraccionDocumento|huellaSha256/i);
    expect(source).not.toMatch(/\.(insert|update|delete)\(\s*inscripcion\b/);
    expect(source).not.toMatch(
      /\b(insert\s+into|update|delete\s+from)\s+"?Inscripcion"?/i,
    );
  });
});
