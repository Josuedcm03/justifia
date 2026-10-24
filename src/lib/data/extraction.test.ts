// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLAIM_LEASE_MS, MAX_ATTEMPTS } from "@/lib/extraction/limits";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder } = vi.hoisted(() => ({
  holder: { current: null as unknown },
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

import {
  abandonExpiredExtractions,
  claimExtraction,
  completeExtraction,
  failExtraction,
  listExtractions,
  registerPendingExtractions,
  selectExtractionCandidates,
  type ExtractionClaim,
} from "@/lib/data/extraction";

const NOW = new Date("2026-10-22T15:00:00.000Z");
const CUTOFF = new Date(NOW.getTime() - CLAIM_LEASE_MS).toISOString();
const REQUEST = 42;
const HOLDER = "11111111-1111-4111-8111-111111111111";

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function render(fragment: unknown) {
  return new PgDialect().sqlToQuery(
    fragment as Parameters<PgDialect["sqlToQuery"]>[0],
  );
}

beforeEach(() => {
  holder.current = null;
});

describe("registerPendingExtractions (RF-11, DE-5)", () => {
  const eligible = [
    { id: 11, retiradoEn: null },
    { id: 12, retiradoEn: null },
  ];
  const claimable = [{ documentoId: 11 }, { documentoId: 12 }];

  it("registers each eligible document as pendiente and returns the claimable ids", async () => {
    const double = use([
      { kind: "select", rows: eligible },
      { kind: "insert" },
      { kind: "update" },
      { kind: "select", rows: claimable },
    ]);

    await expect(registerPendingExtractions(REQUEST, NOW)).resolves.toEqual([
      11, 12,
    ]);

    expect(double.log[1].values).toEqual([
      { documentoId: 11, estado: "pendiente" },
      { documentoId: 12, estado: "pendiente" },
    ]);
    expect(double.exhausted).toBe(true);
  });

  it("runs all four statements in one transaction", async () => {
    const double = use([
      { kind: "select", rows: eligible },
      { kind: "insert" },
      { kind: "update" },
      { kind: "select", rows: claimable },
    ]);

    await registerPendingExtractions(REQUEST, NOW);

    expect(double.transactions).toBe(1);
    expect(double.log.map((s) => s.inTransaction)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("never overwrites a row that already exists, whatever its state", async () => {
    const double = use([
      { kind: "select", rows: eligible },
      { kind: "insert" },
      { kind: "update" },
      { kind: "select", rows: claimable },
    ]);

    await registerPendingExtractions(REQUEST, NOW);

    expect(double.log[1].calls).toEqual(["onConflictDoNothing"]);
  });

  it("reads only finalized student documents of the request", async () => {
    const double = use([
      { kind: "select", rows: eligible },
      { kind: "insert" },
      { kind: "update" },
      { kind: "select", rows: claimable },
    ]);

    await registerPendingExtractions(REQUEST, NOW);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"DocumentoRespaldo"."SolicitudId" = $');
    expect(query.sql).toContain('"DocumentoRespaldo"."Estado" = $');
    expect(query.sql).toContain('"DocumentoRespaldo"."SubidoPorId" is null');
    expect(query.sql).toContain('"DocumentoRespaldo"."FormatoEspecial" = $');
    expect(query.params).toEqual([REQUEST, "valido", false]);
  });

  it("gives a retired document without a row no_aplica instead of pendiente", async () => {
    const double = use([
      {
        kind: "select",
        rows: [
          { id: 11, retiradoEn: null },
          { id: 12, retiradoEn: new Date("2026-10-21T10:00:00.000Z") },
        ],
      },
      { kind: "insert" },
      { kind: "update" },
      { kind: "select", rows: [{ documentoId: 11 }] },
    ]);

    await expect(registerPendingExtractions(REQUEST, NOW)).resolves.toEqual([
      11,
    ]);

    expect(double.log[1].values).toEqual([
      { documentoId: 11, estado: "pendiente" },
      { documentoId: 12, estado: "no_aplica" },
    ]);
  });

  it("skips the insert when the request has no student document", async () => {
    const double = use([
      { kind: "select", rows: [] },
      { kind: "update" },
      { kind: "select", rows: [] },
    ]);

    await expect(registerPendingExtractions(REQUEST, NOW)).resolves.toEqual([]);

    expect(double.log.map((s) => s.kind)).toEqual([
      "select",
      "update",
      "select",
    ]);
  });

  it("turns only the open rows of retired documents into no_aplica and frees their claim", async () => {
    const double = use([
      { kind: "select", rows: eligible },
      { kind: "insert" },
      { kind: "update" },
      { kind: "select", rows: claimable },
    ]);

    await registerPendingExtractions(REQUEST, NOW);

    expect(double.log[2].set).toEqual({
      estado: "no_aplica",
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
    const query = render(double.log[2].where);
    expect(query.sql).toContain('"DocumentoRespaldo"."RetiradoEn" is not null');
    expect(query.sql).toContain('"ExtraccionDocumento"."Estado" in ($');
    // completada and fallida are final: neither state is in the list.
    expect(query.params).toEqual([REQUEST, "pendiente", "procesando"]);
  });

  it("returns pending and expired-lease rows of live documents under the attempt cap, by id", async () => {
    const double = use([
      { kind: "select", rows: eligible },
      { kind: "insert" },
      { kind: "update" },
      { kind: "select", rows: claimable },
    ]);

    await registerPendingExtractions(REQUEST, NOW);

    const query = render(double.log[3].where);
    expect(query.sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
    expect(query.sql).toContain('"ExtraccionDocumento"."Intentos" < $');
    expect(query.sql).toContain('"ExtraccionDocumento"."ReclamadaEn" < $');
    expect(query.params).toEqual([
      REQUEST,
      MAX_ATTEMPTS,
      "pendiente",
      "procesando",
      CUTOFF,
    ]);
    expect(render(double.log[3].orderBy?.[0]).sql).toBe(
      '"ExtraccionDocumento"."DocumentoId" asc',
    );
  });

  it("fails the whole registration when a statement fails", async () => {
    use([
      { kind: "select", rows: eligible },
      { kind: "insert", error: new Error("connection reset") },
    ]);

    await expect(registerPendingExtractions(REQUEST, NOW)).rejects.toThrow(
      "connection reset",
    );
  });
});

describe("claimExtraction (RF-11, DE-3, DE-6)", () => {
  const claimedRow = {
    documentoId: 7,
    pathname: "intake/4/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf",
    tipoDetectado: "pdf",
    intentos: 1,
    reclamoId: HOLDER,
    reenviadaEn: null,
    presentadaEn: new Date("2026-10-20T14:00:00.000Z"),
  };

  it("returns the claim with the submission instant of a first presentation", async () => {
    use([{ kind: "update", rows: [claimedRow] }]);

    const claim: ExtractionClaim | null = await claimExtraction(7, NOW);

    expect(claim).toEqual({
      documentoId: 7,
      pathname: claimedRow.pathname,
      tipoDetectado: "pdf",
      intentos: 1,
      reclamoId: HOLDER,
      submittedAt: new Date("2026-10-20T14:00:00.000Z"),
    });
  });

  it("uses the resubmission instant when the request was corrected", async () => {
    const resent = new Date("2026-10-21T09:30:00.000Z");
    use([{ kind: "update", rows: [{ ...claimedRow, reenviadaEn: resent }] }]);

    await expect(claimExtraction(7, NOW)).resolves.toMatchObject({
      submittedAt: resent,
    });
  });

  it("returns null when the guarded update matched nothing", async () => {
    use([{ kind: "update", rows: [] }]);

    await expect(claimExtraction(7, NOW)).resolves.toBeNull();
  });

  it("stamps a fresh uuid, the time and one more attempt", async () => {
    const first = use([{ kind: "update", rows: [claimedRow] }]);
    await claimExtraction(7, NOW);
    const second = use([{ kind: "update", rows: [claimedRow] }]);
    await claimExtraction(7, NOW);

    const set = first.log[0].set as Record<string, unknown>;
    expect(set.estado).toBe("procesando");
    expect(set.reclamoId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(set.reclamadaEn).toEqual(NOW);
    expect(set.actualizadaEn).toEqual(NOW);
    expect(render(set.intentos).sql).toBe(
      '"ExtraccionDocumento"."Intentos" + 1',
    );
    expect((second.log[0].set as { reclamoId: string }).reclamoId).not.toBe(
      set.reclamoId,
    );
  });

  it("matches a pending row, or a processing row whose lease expired, under the cap", async () => {
    const double = use([{ kind: "update", rows: [claimedRow] }]);

    await claimExtraction(7, NOW);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"ExtraccionDocumento"."DocumentoId" = $');
    expect(query.sql).toContain('"ExtraccionDocumento"."Intentos" < $');
    expect(query.sql).toContain('"ExtraccionDocumento"."Estado" = $');
    expect(query.sql).toContain('"ExtraccionDocumento"."ReclamadaEn" < $');
    expect(query.params).toEqual([
      7,
      MAX_ATTEMPTS,
      "pendiente",
      "procesando",
      CUTOFF,
    ]);
    expect(query.params).not.toContain("completada");
    expect(query.params).not.toContain("fallida");
  });

  it("refuses a retired document and a request that was never presented", async () => {
    const double = use([{ kind: "update", rows: [claimedRow] }]);

    await claimExtraction(7, NOW);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
    expect(query.sql).toContain('"Solicitud"."PresentadaEn" is not null');
  });
});

describe("completeExtraction (RF-11, DE-3)", () => {
  const claim: ExtractionClaim = {
    documentoId: 7,
    pathname: "intake/4/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf",
    tipoDetectado: "pdf",
    intentos: 1,
    reclamoId: HOLDER,
    submittedAt: new Date("2026-10-20T14:00:00.000Z"),
  };
  const fields = {
    studentName: "Ana Perez",
    issuer: "Clinica Central",
    issueDate: "2026-10-19",
    restFrom: "2026-10-19",
    restTo: "2026-10-23",
    restDays: 5,
  };
  const ENGINE = "nuextract3-4b/image";

  it("stores the validated fields and the engine, ends the claim and reports success", async () => {
    const double = use([{ kind: "update", rows: [{ documentoId: 7 }] }]);

    await expect(completeExtraction(claim, fields, ENGINE, NOW)).resolves.toBe(
      true,
    );

    expect(double.log[0].set).toEqual({
      estado: "completada",
      nombreEstudiante: "Ana Perez",
      emisor: "Clinica Central",
      fechaEmision: "2026-10-19",
      reposoDesde: "2026-10-19",
      reposoHasta: "2026-10-23",
      reposoDias: 5,
      motor: ENGINE,
      errorCodigo: null,
      procesadoEn: NOW,
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
  });

  it("completes an answer with no recognized value", async () => {
    const empty = {
      studentName: null,
      issuer: null,
      issueDate: null,
      restFrom: null,
      restTo: null,
      restDays: null,
    };
    const double = use([{ kind: "update", rows: [{ documentoId: 7 }] }]);

    await expect(completeExtraction(claim, empty, ENGINE, NOW)).resolves.toBe(
      true,
    );

    expect(double.log[0].set).toMatchObject({
      estado: "completada",
      nombreEstudiante: null,
      reposoDias: null,
      motor: ENGINE,
    });
  });

  it("changes nothing for a holder whose claim was replaced", async () => {
    use([{ kind: "update", rows: [] }]);

    await expect(completeExtraction(claim, fields, ENGINE, NOW)).resolves.toBe(
      false,
    );
  });

  it("matches the row only by its document, its claim and the processing state", async () => {
    const double = use([{ kind: "update", rows: [{ documentoId: 7 }] }]);

    await completeExtraction(claim, fields, ENGINE, NOW);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"ExtraccionDocumento"."DocumentoId" = $');
    expect(query.sql).toContain('"ExtraccionDocumento"."ReclamoId" = $');
    expect(query.sql).toContain('"ExtraccionDocumento"."Estado" = $');
    expect(query.params).toEqual([7, HOLDER, "procesando"]);
  });
});

describe("failExtraction (RF-11, DE-3, DE-4)", () => {
  const at = (intentos: number): ExtractionClaim => ({
    documentoId: 7,
    pathname: "intake/4/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf",
    tipoDetectado: "png",
    intentos,
    reclamoId: HOLDER,
    submittedAt: new Date("2026-10-20T14:00:00.000Z"),
  });

  it.each([
    ["timeout", 1, "pendiente"],
    ["model_error", 2, "pendiente"],
    ["invalid_response", 2, "pendiente"],
    ["model_error", 3, "fallida"],
    ["document_unavailable", 3, "fallida"],
    ["unreadable_document", 1, "fallida"],
  ] as const)(
    "%s on attempt %i leaves the row %s with the code and no claim",
    async (error, attempts, estado) => {
      const double = use([{ kind: "update", rows: [{ documentoId: 7 }] }]);

      await expect(failExtraction(at(attempts), error, NOW)).resolves.toBe(
        true,
      );

      expect(double.log[0].set).toEqual({
        estado,
        errorCodigo: error,
        reclamoId: null,
        reclamadaEn: null,
        actualizadaEn: NOW,
        ...(estado === "fallida" ? { procesadoEn: NOW } : {}),
      });
    },
  );

  it.each([1, 3])(
    "hands a not_configured claim back as pendiente and returns the attempt (attempt %i)",
    async (attempts) => {
      const double = use([{ kind: "update", rows: [{ documentoId: 7 }] }]);

      await failExtraction(at(attempts), "not_configured", NOW);

      const set = double.log[0].set as Record<string, unknown>;
      expect(set).toMatchObject({
        estado: "pendiente",
        errorCodigo: "not_configured",
        reclamoId: null,
        reclamadaEn: null,
      });
      expect(set).not.toHaveProperty("procesadoEn");
      expect(render(set.intentos).sql).toBe(
        'greatest("ExtraccionDocumento"."Intentos" - 1, 0)',
      );
    },
  );

  it("does not touch the attempt count for an ordinary failure", async () => {
    const double = use([{ kind: "update", rows: [{ documentoId: 7 }] }]);

    await failExtraction(at(1), "timeout", NOW);

    expect(double.log[0].set).not.toHaveProperty("intentos");
  });

  it("changes nothing for a holder whose claim was replaced", async () => {
    const double = use([{ kind: "update", rows: [] }]);

    await expect(failExtraction(at(1), "timeout", NOW)).resolves.toBe(false);

    expect(render(double.log[0].where).params).toEqual([
      7,
      HOLDER,
      "procesando",
    ]);
  });
});

describe("abandonExpiredExtractions (RF-11, DE-3)", () => {
  it("turns expired leases on the last attempt into fallida with a timeout code", async () => {
    const double = use([
      { kind: "update", rows: [{ documentoId: 7 }, { documentoId: 9 }] },
    ]);

    await expect(abandonExpiredExtractions(NOW)).resolves.toBe(2);

    expect(double.log[0].set).toEqual({
      estado: "fallida",
      errorCodigo: "timeout",
      procesadoEn: NOW,
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
  });

  it("matches only processing rows with an expired lease and no attempt left", async () => {
    const double = use([{ kind: "update", rows: [] }]);

    await expect(abandonExpiredExtractions(NOW)).resolves.toBe(0);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"ExtraccionDocumento"."Estado" = $');
    expect(query.sql).toContain('"ExtraccionDocumento"."ReclamadaEn" < $');
    expect(query.sql).toContain('"ExtraccionDocumento"."Intentos" >= $');
    expect(query.params).toEqual(["procesando", CUTOFF, MAX_ATTEMPTS]);
  });
});

describe("selectExtractionCandidates (RF-11, DE-11)", () => {
  it("returns the request ids, oldest clock start first, at most the limit", async () => {
    const double = use([{ kind: "select", rows: [{ id: 5 }, { id: 9 }] }]);

    await expect(selectExtractionCandidates(NOW, 10)).resolves.toEqual([5, 9]);

    expect(double.log[0].limit).toBe(10);
    expect(render(double.log[0].orderBy?.[0]).sql).toBe(
      'coalesce("Solicitud"."ReenviadaEn", "Solicitud"."PresentadaEn") asc',
    );
    expect(render(double.log[0].orderBy?.[1]).sql).toBe('"Solicitud"."Id" asc');
  });

  it("passes the limit it is given", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await expect(selectExtractionCandidates(NOW, 3)).resolves.toEqual([]);

    expect(double.log[0].limit).toBe(3);
  });

  it("considers only requests still pending", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await selectExtractionCandidates(NOW, 10);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."Estado" = $');
    expect(query.params[0]).toBe("pendiente");
    for (const state of ["aprobada", "devuelta", "borrador"]) {
      expect(query.params).not.toContain(state);
    }
  });

  it("picks up a pending row, an expired lease under the cap, or a document with no row", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await selectExtractionCandidates(NOW, 10);

    const query = render(double.log[0].where);
    // Open rows of live documents: pending, or an expired lease, under the cap.
    expect(query.sql).toContain('"ExtraccionDocumento"."Intentos" < $');
    expect(query.sql).toContain('"ExtraccionDocumento"."ReclamadaEn" < $');
    // Eligible documents with no row at all (anti-join).
    expect(query.sql).toContain(
      'not exists (select 1 from "ExtraccionDocumento"',
    );
    expect(query.sql).toContain('"DocumentoRespaldo"."SubidoPorId" is null');
    expect(query.params).toEqual([
      "pendiente",
      MAX_ATTEMPTS,
      "pendiente",
      "procesando",
      CUTOFF,
      "valido",
      false,
    ]);
    // completada, fallida and no_aplica rows never qualify.
    for (const state of ["completada", "fallida", "no_aplica"]) {
      expect(query.params).not.toContain(state);
    }
  });
});

describe("listExtractions (RF-11, DE-13)", () => {
  const completed = {
    documentoId: 11,
    nombreOriginal: "constancia.pdf",
    estado: "completada",
    nombreEstudiante: "Ana Perez",
    emisor: "Clinica Central",
    fechaEmision: "2026-10-19",
    reposoDesde: "2026-10-19",
    reposoHasta: "2026-10-23",
    reposoDias: 5,
  };
  const unregistered = {
    documentoId: 12,
    nombreOriginal: "foto.jpg",
    estado: null,
    nombreEstudiante: null,
    emisor: null,
    fechaEmision: null,
    reposoDesde: null,
    reposoHasta: null,
    reposoDias: null,
  };

  it("returns one entry per current student document, with its row or none", async () => {
    use([{ kind: "select", rows: [completed, unregistered] }]);

    await expect(listExtractions(REQUEST)).resolves.toEqual({
      degraded: false,
      data: [
        {
          documentoId: 11,
          nombreOriginal: "constancia.pdf",
          row: {
            state: "completada",
            studentName: "Ana Perez",
            issuer: "Clinica Central",
            issueDate: "2026-10-19",
            restFrom: "2026-10-19",
            restTo: "2026-10-23",
            restDays: 5,
          },
        },
        { documentoId: 12, nombreOriginal: "foto.jpg", row: null },
      ],
    });
  });

  it("keeps a document that has no row (left join) and drops no_aplica and retired ones", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listExtractions(REQUEST);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"DocumentoRespaldo"."SolicitudId" = $');
    expect(query.sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
    expect(query.sql).toContain('"DocumentoRespaldo"."SubidoPorId" is null');
    expect(query.sql).toContain('"ExtraccionDocumento"."Estado" is null or');
    expect(query.sql).toContain('"ExtraccionDocumento"."Estado" <> $');
    expect(query.params).toEqual([REQUEST, "valido", "no_aplica"]);
    expect(render(double.log[0].orderBy?.[0]).sql).toBe(
      '"DocumentoRespaldo"."Id" asc',
    );
  });

  it("returns an empty degraded result, with no partial data, when the query throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    use([
      { kind: "select", error: new Error("password authentication failed") },
    ]);

    await expect(listExtractions(REQUEST)).resolves.toEqual({
      data: [],
      degraded: true,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("password");
    expect(spy.mock.calls[0]).toEqual([
      "extraction_read_failed",
      { solicitudId: REQUEST, code: "Error" },
    ]);
    spy.mockRestore();
  });
});

// Structural pins (RNF-04, RNF-06; D14). The table is a state machine, so its
// claim and completions stay in one module, which writes no audit row and logs
// only ids, states, codes and counts.
describe("extraction write surface", () => {
  const SRC = join(process.cwd(), "src");
  const MODULE = "lib/data/extraction.ts";

  type Verb = "insert" | "update" | "delete";
  const WRITE_PATTERNS: Record<Verb, RegExp[]> = {
    insert: [
      /\.insert\(\s*extraccionDocumento\b/,
      /insert\s+into\s+"?ExtraccionDocumento"?/i,
    ],
    update: [
      /\.update\(\s*extraccionDocumento\b/,
      /update\s+"?ExtraccionDocumento"?/i,
    ],
    delete: [
      /\.delete\(\s*extraccionDocumento\b/,
      /delete\s+from\s+"?ExtraccionDocumento"?/i,
    ],
  };

  function writesOf(source: string): Verb[] {
    return (Object.keys(WRITE_PATTERNS) as Verb[]).filter((verb) =>
      WRITE_PATTERNS[verb].some((pattern) => pattern.test(source)),
    );
  }

  function productionSources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return productionSources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  }

  const source = readFileSync(join(SRC, MODULE), "utf8");

  it("detects the write shapes it guards against", () => {
    expect(writesOf("tx.insert(extraccionDocumento).values(r)")).toEqual([
      "insert",
    ]);
    expect(writesOf("db.update( extraccionDocumento ).set(x)")).toEqual([
      "update",
    ]);
    expect(writesOf("db.delete(extraccionDocumento)")).toEqual(["delete"]);
    expect(writesOf('sql`UPDATE "ExtraccionDocumento" SET x = 1`')).toEqual([
      "update",
    ]);
    expect(writesOf("db.select().from(extraccionDocumento)")).toEqual([]);
  });

  it("has no module outside extraction.ts that writes ExtraccionDocumento", () => {
    const files = productionSources(SRC);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files
      .map((file) => relative(SRC, file).split(sep).join("/"))
      .filter((name) => name !== MODULE)
      .flatMap((name) =>
        writesOf(readFileSync(join(SRC, name), "utf8")).map(
          (verb) => `${name}: ${verb}`,
        ),
      );

    expect(offenders).toEqual([]);
  });

  it("finds the writer, so the pin is not vacuous", () => {
    expect(writesOf(source)).toEqual(["insert", "update"]);
  });

  it("imports nothing from the audit modules and writes no audit row", () => {
    expect(source).not.toMatch(/from\s+"@\/lib\/audit/);
    expect(source).not.toMatch(/from\s+"@\/lib\/data\/audit"/);
    expect(source).not.toMatch(/insertAuditEvents/);
  });

  it("logs one event, by id and code only, never a pathname, name or value", () => {
    const calls = [...source.matchAll(/console\.\w+\(([\s\S]*?)\);/g)].map(
      (m) => m[1],
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^\s*"extraction_read_failed"/);
    expect(calls[0]).not.toMatch(
      /pathname|nombre|emisor|studentName|issuer|message|stack/i,
    );
  });
});
