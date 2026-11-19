// @vitest-environment node
import { getTableColumns } from "drizzle-orm";
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

import { BATCH_SIZE, runRetention } from "./retention";

// Pass-at-write tests (RNF-04, RN-27). They pin what the data module and the
// schema already do, so they have no RED step; each carries a revert-only
// mutation check recorded in apply-progress.md.

// The reviewed classification of every column the retention run can touch
// (DR-4, DR-5). A column added to one of these tables fails here until a
// reviewer decides whether it is personal data (rewritten) or residue (kept).
const INVENTORY = {
  usuario: {
    table: usuario,
    rewritten: [
      "nombreCompleto",
      "login",
      "correo",
      "telefono",
      "cif",
      "hashClave",
      "activo",
      "debeCambiarClave",
      "canceladoEn",
    ],
    kept: ["id", "rolId", "carreraId", "facultadId", "creadoEn"],
    deleted: [],
  },
  solicitud: {
    table: solicitud,
    rewritten: [
      "estudianteNombre",
      "estudianteCif",
      "estudianteCarrera",
      "estudianteCorreo",
      "canceladaEn",
    ],
    kept: [
      "id",
      "estudianteId",
      "estado",
      "causa",
      "fechaInicio",
      "fechaFin",
      "presentadaEn",
      "reenviadaEn",
      "plazoInicioEn",
      "formatoEspecial",
      "consentimientoEn",
      "consentimientoVersion",
      "creadoEn",
      "actualizadoEn",
    ],
    deleted: [],
  },
  solicitudDecision: {
    table: solicitudDecision,
    rewritten: ["texto"],
    kept: [
      "id",
      "solicitudId",
      "tipo",
      "plantillaCodigo",
      "motivoCodigo",
      "revisionId",
      "secretariaId",
      "decididaEn",
    ],
    deleted: [],
  },
  remision: {
    table: remision,
    rewritten: ["docenteNombre", "correo"],
    kept: [
      "id",
      "solicitudId",
      "docenteId",
      "clases",
      "estado",
      "motivoCodigo",
      "intentos",
      "reclamoId",
      "reclamadaEn",
      "enviadaEn",
      "proveedorMensajeId",
      "creadaEn",
      "actualizadaEn",
    ],
    deleted: [],
  },
  reporteInasistencia: {
    table: reporteInasistencia,
    rewritten: ["docenteNombre", "nota"],
    kept: [
      "id",
      "solicitudId",
      "docenteId",
      "comunicadoEl",
      "registradoPorId",
      "registradoEn",
    ],
    deleted: [],
  },
  escalamiento: {
    table: escalamiento,
    rewritten: ["nota", "respuesta"],
    kept: [
      "id",
      "solicitudId",
      "tipo",
      "estadoPrevio",
      "reporteId",
      "secretariaId",
      "creadoEn",
      "respondidaPorId",
      "respondidaEn",
      "notificacionEstado",
      "notificacionMotivo",
      "intentos",
      "reclamoId",
      "reclamadaEn",
      "enviadaEn",
      "proveedorMensajeId",
      "actualizadaEn",
    ],
    deleted: [],
  },
  // Every row of the student's requests goes (the extraction rows cascade).
  documentoRespaldo: {
    table: documentoRespaldo,
    rewritten: [],
    kept: [],
    deleted: [
      "id",
      "solicitudId",
      "pathname",
      "nombreOriginal",
      "tipoDetectado",
      "tamanoBytes",
      "estado",
      "retiradoEn",
      "subidoPorId",
      "formatoEspecial",
      "huellaSha256",
      "creadoEn",
    ],
  },
} as const;

describe("column inventory of the tables retention touches (DR-4, DR-5)", () => {
  it.each(Object.entries(INVENTORY))(
    "%s: every column is classified exactly once",
    (_name, { table, rewritten, kept, deleted }) => {
      const classified = [...rewritten, ...kept, ...deleted];

      expect(new Set(classified).size).toBe(classified.length);
      expect([...classified].sort()).toEqual(
        Object.keys(getTableColumns(table)).sort(),
      );
    },
  );
});

const NOW = new Date("2031-03-10T09:00:00.000Z");
const CUTOFF = "2026-03-10T09:00:00.000Z";

const actor: Step = { kind: "select", rows: [{ id: 900 }] };
const due = (n: number): Step => ({ kind: "select", rows: [{ n }] });
const batch = (...ids: number[]): Step => ({
  kind: "select",
  rows: ids.map((id) => ({ id })),
});

function scripted(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

const render = (value: unknown) =>
  new PgDialect().sqlToQuery(value as Parameters<PgDialect["sqlToQuery"]>[0]);

/** The where clause of the count read, as the module built it. */
async function countRead() {
  const double = scripted([actor, due(0)]);
  await runRetention(NOW, createFakeDocumentStore(), { dryRun: true });
  return render(double.log[1].where);
}

beforeEach(() => {
  insertAuditMock.mockReset();
});

describe("the due rule as built (DR-1, DR-2)", () => {
  it("binds the student role and the cutoff five years before now", async () => {
    // The role, the account age and the request activity, in this order.
    expect((await countRead()).params).toEqual(["estudiante", CUTOFF, CUTOFF]);
  });

  it.each([
    [
      "the student role only",
      '"Usuario"."RolId" IN (SELECT "Rol"."Id" FROM "Rol" WHERE "Rol"."Codigo" = $1)',
    ],
    ["accounts not yet cancelled", '"Usuario"."CanceladoEn" is null'],
    ["an account old enough", '"Usuario"."CreadoEn" <= $2'],
    [
      "no request presented or resubmitted after the cutoff",
      'NOT EXISTS (SELECT 1 FROM "Solicitud" WHERE "Solicitud"."EstudianteId" = "Usuario"."Id" AND greatest("Solicitud"."PresentadaEn", "Solicitud"."ReenviadaEn") > $3::timestamptz)',
    ],
  ])("requires %s", async (_label, clause) => {
    expect((await countRead()).sql).toContain(clause);
  });

  it("uses the same rule to count, to select and to guard the write", async () => {
    const double = scripted([
      actor,
      due(1),
      batch(5),
      { kind: "update", rows: [] },
    ]);
    await runRetention(NOW, createFakeDocumentStore());

    const rule = (n: number) =>
      render(double.log[n].where).sql.replace(/\$\d+/g, "$");
    const counted = rule(1);
    expect(rule(2)).toContain(counted);
    expect(rule(3)).toContain(counted);
  });
});

describe("keyset batching on the account id (D5)", () => {
  it("reads in ascending id order and resumes after the last id of the batch", async () => {
    const first = Array.from({ length: BATCH_SIZE }, (_, i) => i + 1);
    const double = scripted([
      actor,
      due(51),
      batch(...first),
      ...first.map((): Step => ({ kind: "update", rows: [] })),
      batch(51),
      { kind: "update", rows: [] },
    ]);

    await runRetention(NOW, createFakeDocumentStore());

    const reads = double.log.filter((s) => s.limit === BATCH_SIZE);
    expect(reads).toHaveLength(2);
    expect(reads.map((s) => render(s.where).params.at(-1))).toEqual([0, 50]);
    for (const read of reads) {
      expect(render(read.orderBy?.[0]).sql).toBe('"Usuario"."Id" asc');
    }
  });
});

describe("the audit row of a cancellation (DR-6)", () => {
  it("carries the closed code and the two counts, and nothing else", async () => {
    scripted([
      actor,
      due(1),
      batch(7),
      { kind: "update", rows: [{ id: 7 }] },
      { kind: "select", rows: [{ pathname: "intake/7/a.pdf" }] },
      { kind: "update", rows: [{ id: 1 }, { id: 2 }] },
      { kind: "update" },
      { kind: "update" },
      { kind: "update" },
      { kind: "update" },
      { kind: "delete" },
    ]);

    await runRetention(NOW, createFakeDocumentStore());

    const [event] = insertAuditMock.mock.calls[0][2];
    expect(Object.keys(event.datos).sort()).toEqual([
      "documentos",
      "motivo",
      "solicitudes",
    ]);
    expect(event.datos).toEqual({
      motivo: "retencion_5_anios",
      solicitudes: 2,
      documentos: 1,
    });
  });
});
