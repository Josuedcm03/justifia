import { createHash, randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  documentoRespaldo,
  extraccionDocumento,
  solicitud,
  solicitudAsignatura,
} from "@/db/schema";
import {
  earlierMatchesQuery,
  loadSignals,
  readEarlierMatches,
  readIssuerHistory,
} from "@/lib/data/signals";
import { createFixtures, PDF_BYTES } from "@/lib/data/integration/fixtures";
import type { Causa } from "@/lib/intake/causes";
import { buildPathname } from "@/lib/intake/pathnames";
import type { RequestScope } from "@/lib/intake/request-scope";
import type { EstadoSolicitud } from "@/lib/intake/states";
import type { SignalCode, SignalResult } from "@/lib/signals/types";

// Real-Postgres proof of the document fingerprint (validation-signals, task
// 8.9, RN-26). The unit tests read the generated SQL; this suite makes the
// database itself accept and reject rows and plan the RN-26 lookup, so a CHECK
// written wrong, or a lookup that stops using its index, fails here.
//
// Every row case runs in its own transaction that is always rolled back, so the
// only rows left behind are the fixtures (removed by `cleanup()`). A rejected
// row is identified by SQLSTATE and by constraint name: a CHECK that fires for
// the wrong reason does not count as proof. The plan is read with
// `enable_seqscan = off` inside a read-only transaction: tiny tables otherwise
// choose a sequential scan, and a planner choice on a nearly empty branch is a
// signal, not a benchmark.
//
// HOW TO RUN (never part of `npm test`; owner-run, phase 10):
//   INTEGRATION_DATABASE_URL=<disposable branch url> \
//   INTEGRATION_ALLOW_WRITES=1 npm run test:integration
// The branch needs migration `0013_validation_signals` applied. Without
// INTEGRATION_DATABASE_URL the suite is skipped; the opt-in guard is the one of
// `intake-concurrency.integration.test.ts`.

// Decided by vitest.integration.setup.ts before it replaced DATABASE_URL.
const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CHECK_VIOLATION = "23514";
/** `value too long for type character(64)`: a 65 character value. */
const STRING_DATA_RIGHT_TRUNCATION = "22001";

const HASH = "0123456789abcdef".repeat(4);

/** Thrown at the end of every case so the transaction never commits. */
class RolledBack extends Error {}

type Outcome =
  | { accepted: true }
  | { accepted: false; code: string; constraint: string | undefined };

/** SQLSTATE and constraint of a database error, read through `cause`. */
function databaseError(error: unknown): {
  code: string;
  constraint: string | undefined;
} {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const { code, constraint_name } = current as {
      code?: unknown;
      constraint_name?: unknown;
    };
    if (typeof code === "string" && /^[0-9]{2}[0-9A-Z]{3}$/.test(code)) {
      return {
        code,
        constraint:
          typeof constraint_name === "string" ? constraint_name : undefined,
      };
    }
    current = (current as { cause?: unknown }).cause;
  }
  throw error;
}

/** Run `work` in a transaction that is rolled back whatever happens. */
async function attempt(work: (tx: Tx) => Promise<void>): Promise<Outcome> {
  try {
    await db.transaction(async (tx) => {
      await work(tx);
      throw new RolledBack();
    });
  } catch (error) {
    if (error instanceof RolledBack) return { accepted: true };
    return { accepted: false, ...databaseError(error) };
  }
  throw new Error("The transaction ended without rolling back");
}

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  Plans?: PlanNode[];
};

/** Every node of a plan tree, parents before children. */
function nodesOf(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(nodesOf)];
}

/** The generated `$n` placeholders as literals; only strings and numbers. */
function withLiterals(text: string, params: readonly unknown[]): string {
  return text.replace(/\$(\d+)/g, (_match, position: string) => {
    const value = params[Number(position) - 1];
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
    if (typeof value === "boolean") return String(value);
    throw new Error(`Unexpected type for the lookup parameter $${position}`);
  });
}

describe.skipIf(gate.mode !== "run")(
  "document fingerprint (real Postgres)",
  () => {
    const fixtures = createFixtures();
    let draftId: number;

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db
        .select({ huella: documentoRespaldo.huellaSha256 })
        .from(documentoRespaldo)
        .limit(1);
      const student = await fixtures.addStudent();
      draftId = await fixtures.addDraft(student.id);
    });

    afterAll(async () => {
      await fixtures.cleanup();
    });

    /** A document row with the given state and fingerprint, in the transaction. */
    async function insertDocument(
      tx: Tx,
      huellaSha256: string | null,
      estado: "valido" | "pendiente" = "valido",
    ) {
      await tx.insert(documentoRespaldo).values({
        solicitudId: draftId,
        pathname: buildPathname(draftId, randomUUID(), "pdf"),
        nombreOriginal: "constancia.pdf",
        tipoDetectado: estado === "valido" ? "pdf" : null,
        tamanoBytes: PDF_BYTES.length,
        estado,
        huellaSha256,
      });
    }

    describe("CK_Documento_Huella", () => {
      it.each([
        ["NULL", null],
        ["64 lower-case hexadecimal characters", HASH],
      ])("accepts %s", async (_label, value) => {
        expect(await attempt((tx) => insertDocument(tx, value))).toEqual({
          accepted: true,
        });
      });

      it.each([
        ["63 characters", HASH.slice(0, 63)],
        ["upper-case hexadecimal", HASH.toUpperCase()],
        ["a non-hexadecimal character", `${"a".repeat(63)}g`],
      ])("rejects %s with the CHECK", async (_label, value) => {
        expect(await attempt((tx) => insertDocument(tx, value))).toEqual({
          accepted: false,
          code: CHECK_VIOLATION,
          constraint: "CK_Documento_Huella",
        });
      });

      it("rejects 65 characters, here by the column type", async () => {
        const outcome = await attempt((tx) => insertDocument(tx, `${HASH}a`));

        expect(outcome).toMatchObject({
          accepted: false,
          code: STRING_DATA_RIGHT_TRUNCATION,
        });
      });

      it("rejects a fingerprint on a document that is not valido", async () => {
        expect(
          await attempt((tx) => insertDocument(tx, HASH, "pendiente")),
        ).toEqual({
          accepted: false,
          code: CHECK_VIOLATION,
          constraint: "CK_Documento_Huella",
        });
      });
    });

    describe("catalog", () => {
      it("keeps the CHECK and the partial index in the database", async () => {
        const check = (await db.execute(
          sql`SELECT pg_get_constraintdef(oid) AS def
              FROM pg_constraint
              WHERE conname = 'CK_Documento_Huella'`,
        )) as unknown as Array<{ def: string }>;
        expect(check).toHaveLength(1);
        expect(check[0].def).toContain('"HuellaSha256" IS NULL');
        expect(check[0].def).toContain("'valido'");
        expect(check[0].def).toContain("^[0-9a-f]{64}$");

        const index = (await db.execute(
          sql`SELECT indexdef FROM pg_indexes
              WHERE indexname = 'IX_Documento_Huella'`,
        )) as unknown as Array<{ indexdef: string }>;
        expect(index).toHaveLength(1);
        expect(index[0].indexdef).toContain('("HuellaSha256")');
        expect(index[0].indexdef).toContain('"HuellaSha256" IS NOT NULL');
      });
    });

    describe("RN-26 lookup", () => {
      it("is served by IX_Documento_Huella", async () => {
        const query = earlierMatchesQuery({
          solicitudId: draftId,
          hashes: [HASH],
          referenceScope: { kind: "facultad", facultadId: 1 },
        }).toSQL();
        const statement = withLiterals(query.sql, query.params);

        const nodes = await db.transaction(async (tx) => {
          await tx.execute(sql`SET TRANSACTION READ ONLY`);
          await tx.execute(sql`SET LOCAL enable_seqscan = off`);
          const rows = await tx.execute(
            sql`EXPLAIN (FORMAT JSON) ${sql.raw(statement)}`,
          );
          const [row] = rows as unknown as Array<{ "QUERY PLAN": unknown }>;
          const raw = row["QUERY PLAN"];
          const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as [
            { Plan: PlanNode },
          ];
          return nodesOf(parsed[0].Plan);
        });

        expect(nodes.map((n) => n["Index Name"])).toContain(
          "IX_Documento_Huella",
        );
        // No sequential scan of the documents table: the fingerprint is looked
        // up, never scanned for.
        expect(
          nodes.filter(
            (n) =>
              n["Node Type"] === "Seq Scan" &&
              n["Relation Name"] === "DocumentoRespaldo",
          ),
        ).toEqual([]);
      });
    });
  },
);

// Real-Postgres proof of the Q4 (RN-14) and Q5 (RN-26) predicates (validation-
// signals, remediation of verify W3). The unit tests read the rendered SQL and
// script the database; this block runs the exported statements and
// `loadSignals` on real rows, so a predicate that is wrong, or dropped, fails
// here. Rows are committed (the statements run on the pool, not in one
// transaction), so every case owns fresh students and a fingerprint derived
// from the run id and the case label, and `cleanup()` removes them at the end.
//
// Two rows of the specs cannot be built as separate shapes: the CHECK
// `CK_Documento_FormatoEspecial` ties `SubidoPorId IS NOT NULL` to
// `FormatoEspecial`, so "staff upload" and "special format" are one row shape,
// and `CK_Documento_Huella` allows a fingerprint on `valido` documents only, so
// a non-valid document can never match on the RN-26 side (it is covered on the
// RN-14 side, which has no fingerprint).
//
// HOW TO RUN: as the suite above (a disposable Neon branch with migration 0013,
// `INTEGRATION_DATABASE_URL` and `INTEGRATION_ALLOW_WRITES=1`, the owner's
// explicit yes).
describe.skipIf(gate.mode !== "run")(
  "RN-14 and RN-26 predicates (real Postgres)",
  () => {
    const fixtures = createFixtures();
    const ISSUER = "Clinica Santa Fe";
    const PERIOD = "IT-A";
    const BASE_TIME = Date.UTC(2026, 8, 1, 15, 0, 0);
    /** An instant `hours` after the base; the request id is the only other order. */
    const at = (hours: number) => new Date(BASE_TIME + hours * 3_600_000);

    type PresentedState = Exclude<EstadoSolicitud, "borrador">;
    type ExtractionKind = "completada" | "fallida" | "pendiente" | "no_aplica";
    type DocumentOptions = {
      huella?: string | null;
      retired?: boolean;
      staff?: boolean;
      estado?: "valido" | "pendiente";
    };

    let groupA: number;
    let groupB: number;
    let staffId: number;
    let scope: RequestScope;

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db
        .select({ huella: documentoRespaldo.huellaSha256 })
        .from(documentoRespaldo)
        .limit(1);
      groupA = await fixtures.addGroup({ periodo: PERIOD });
      groupB = await fixtures.addGroup({ periodo: "IT-B" });
      const secretaria = await fixtures.addSecretaria();
      staffId = secretaria.id;
      scope = { kind: "facultad", facultadId: secretaria.facultadId };
    });

    afterAll(async () => {
      await fixtures.cleanup();
    });

    /** A fingerprint no other case (or run) shares. */
    const hashFor = (label: string) =>
      createHash("sha256").update(`${fixtures.run}:${label}`).digest("hex");

    async function addPresented(
      studentId: number,
      presentadaEn: Date,
      options: {
        estado?: PresentedState;
        groupId?: number;
        reenviadaEn?: Date;
        causa?: Causa;
      } = {},
    ): Promise<number> {
      const [row] = await db
        .insert(solicitud)
        .values({
          estudianteId: studentId,
          estado: options.estado ?? "pendiente",
          causa: options.causa ?? "medica",
          fechaInicio: "2026-08-24",
          fechaFin: "2026-08-26",
          presentadaEn,
          reenviadaEn: options.reenviadaEn ?? null,
          estudianteNombre: "IT Estudiante",
          estudianteCif: "IT0001",
          estudianteCarrera: "IT carrera",
          estudianteCorreo: "it@integration.invalid",
        })
        .returning({ id: solicitud.id });
      if (options.groupId !== undefined) {
        await db
          .insert(solicitudAsignatura)
          .values({ solicitudId: row.id, grupoId: options.groupId });
      }
      return row.id;
    }

    /** An open draft (no `PresentadaEn`), with a subject when `groupId` is given. */
    async function addDraftIn(
      studentId: number,
      groupId?: number,
    ): Promise<number> {
      const id = await fixtures.addDraft(studentId);
      if (groupId !== undefined) {
        await db
          .insert(solicitudAsignatura)
          .values({ solicitudId: id, grupoId: groupId });
      }
      return id;
    }

    async function addDocument(
      solicitudId: number,
      options: DocumentOptions = {},
    ): Promise<number> {
      const estado = options.estado ?? "valido";
      const [row] = await db
        .insert(documentoRespaldo)
        .values({
          solicitudId,
          pathname: buildPathname(solicitudId, randomUUID(), "pdf"),
          nombreOriginal: "constancia.pdf",
          tipoDetectado: estado === "valido" ? "pdf" : null,
          tamanoBytes: PDF_BYTES.length,
          estado,
          huellaSha256: options.huella ?? null,
          retiradoEn: options.retired ? at(100) : null,
          // The CHECK ties both columns together: a staff upload is a special
          // format document.
          subidoPorId: options.staff ? staffId : null,
          formatoEspecial: options.staff === true,
        })
        .returning({ id: documentoRespaldo.id });
      return row.id;
    }

    async function addExtraction(
      documentoId: number,
      kind: ExtractionKind,
      emisor: string | null,
      dates: { issueDate?: string; restTo?: string } = {},
    ): Promise<void> {
      if (kind === "completada") {
        await db.insert(extraccionDocumento).values({
          documentoId,
          estado: kind,
          emisor,
          fechaEmision: dates.issueDate ?? null,
          reposoHasta: dates.restTo ?? null,
          motor: "it",
          procesadoEn: at(1),
        });
      } else if (kind === "fallida") {
        await db.insert(extraccionDocumento).values({
          documentoId,
          estado: kind,
          errorCodigo: "timeout",
          procesadoEn: at(1),
        });
      } else {
        await db.insert(extraccionDocumento).values({
          documentoId,
          estado: kind,
        });
      }
    }

    /** A document of `solicitudId` with its extraction row. */
    async function addIssuerDocument(
      solicitudId: number,
      document: DocumentOptions = {},
      extraction: { kind?: ExtractionKind; emisor?: string | null } = {},
    ): Promise<number> {
      const id = await addDocument(solicitudId, document);
      const kind = extraction.kind ?? "completada";
      const emisor =
        extraction.emisor === undefined ? ISSUER : extraction.emisor;
      await addExtraction(id, kind, kind === "completada" ? emisor : null);
      return id;
    }

    async function signalOf(
      solicitudId: number,
      referenceScope: RequestScope,
      code: SignalCode,
    ): Promise<SignalResult> {
      const read = await loadSignals({ solicitudId, referenceScope });
      expect(read.degraded).toBe(false);
      const result = read.data?.results.find((r) => r.signal === code);
      if (!result) throw new Error(`No ${code} result for ${solicitudId}`);
      return result;
    }

    describe("RN-14 history (Q4)", () => {
      type Who = { student: number; stranger: number };
      type Arrange = (who: Who) => Promise<number>;

      /**
       * The student's 1st request (counts), the case's other request, and the
       * request under evaluation (would be the 3rd). `after` creates the other
       * request after the current one, so it has the higher id.
       */
      async function history(arrange: Arrange, after = false) {
        const student = await fixtures.addStudent();
        const stranger = await fixtures.addStudent();
        const who = { student: student.id, stranger: stranger.id };
        const earlier = await addPresented(student.id, at(1), {
          groupId: groupA,
        });
        await addIssuerDocument(earlier);
        const before = after ? null : await arrange(who);
        const current = await addPresented(student.id, at(3), {
          groupId: groupA,
        });
        await addIssuerDocument(current);
        const other = before ?? (await arrange(who));
        return { student: student.id, earlier, other, current };
      }

      /** A presented request carrying one document with a completed issuer. */
      const presentedWith =
        (
          presentadaEn: Date,
          options: {
            estado?: PresentedState;
            /** Resolved when the case runs: the groups exist after `beforeAll`. */
            period?: "A" | "B";
            stranger?: boolean;
            document?: DocumentOptions;
            extraction?: { kind?: ExtractionKind; emisor?: string | null };
          } = {},
        ): Arrange =>
        async (who) => {
          const id = await addPresented(
            options.stranger ? who.stranger : who.student,
            presentadaEn,
            {
              estado: options.estado,
              groupId: options.period === "B" ? groupB : groupA,
            },
          );
          await addIssuerDocument(id, options.document, options.extraction);
          return id;
        };

      const cases: {
        name: string;
        counted: boolean;
        arrange: Arrange;
        after?: boolean;
      }[] = [
        {
          name: "same student, same period, rechazada",
          counted: true,
          arrange: presentedWith(at(2), { estado: "rechazada" }),
        },
        {
          name: "same student, same period, devuelta",
          counted: true,
          arrange: presentedWith(at(2), { estado: "devuelta" }),
        },
        {
          name: "same student, same period, aprobada",
          counted: true,
          arrange: presentedWith(at(2), { estado: "aprobada" }),
        },
        {
          name: "same student, same period, en_revision_coordinacion",
          counted: true,
          arrange: presentedWith(at(2), { estado: "en_revision_coordinacion" }),
        },
        {
          name: "same student, other period",
          counted: false,
          arrange: presentedWith(at(2), { period: "B" }),
        },
        {
          name: "other student, same period",
          counted: false,
          arrange: presentedWith(at(2), { stranger: true }),
        },
        {
          name: "same student, borrador",
          counted: false,
          arrange: async ({ student }) => {
            const id = await addDraftIn(student, groupA);
            await addIssuerDocument(id);
            return id;
          },
        },
        {
          name: "same student, retired documents only",
          counted: false,
          arrange: presentedWith(at(2), { document: { retired: true } }),
        },
        {
          name: "same student, staff-uploaded special-format document",
          counted: false,
          arrange: presentedWith(at(2), { document: { staff: true } }),
        },
        {
          name: "same student, document not valido",
          counted: false,
          arrange: presentedWith(at(2), { document: { estado: "pendiente" } }),
        },
        {
          name: "same student, extraction fallida",
          counted: false,
          arrange: presentedWith(at(2), { extraction: { kind: "fallida" } }),
        },
        {
          name: "same student, extraction pendiente",
          counted: false,
          arrange: presentedWith(at(2), { extraction: { kind: "pendiente" } }),
        },
        {
          name: "same student, extraction no_aplica",
          counted: false,
          arrange: presentedWith(at(2), { extraction: { kind: "no_aplica" } }),
        },
        {
          name: "same student, completed extraction without issuer",
          counted: false,
          arrange: presentedWith(at(2), { extraction: { emisor: null } }),
        },
        {
          name: "same student, presented later than the current request",
          counted: false,
          after: true,
          arrange: presentedWith(at(4)),
        },
        {
          name: "same instant, lower id than the current request",
          counted: true,
          arrange: presentedWith(at(3)),
        },
        {
          name: "same instant, higher id than the current request",
          counted: false,
          after: true,
          arrange: presentedWith(at(3)),
        },
      ];

      it.each(
        cases.map((c) => [`${c.name}: counted = ${c.counted}`, c] as const),
      )("%s", async (_title, { counted, arrange, after }) => {
        const { student, earlier, other, current } = await history(
          arrange,
          after,
        );

        const rows = await readIssuerHistory({
          solicitudId: current,
          estudianteId: student,
          period: PERIOD,
        });

        const ids = [...new Set(rows.map((row) => row.solicitudId))];
        expect(ids.sort((a, b) => a - b)).toEqual(
          (counted ? [earlier, other] : [earlier]).sort((a, b) => a - b),
        );
        expect(rows.every((row) => row.issuer === ISSUER)).toBe(true);
      });

      it("never returns the request under evaluation", async () => {
        const { student, current } = await history(presentedWith(at(2)));

        const rows = await readIssuerHistory({
          solicitudId: current,
          estudianteId: student,
          period: PERIOD,
        });

        expect(rows.map((row) => row.solicitudId)).not.toContain(current);
      });

      it.each([
        ["a rechazada request counts: the 3rd request is present", true],
        ["a request of another period does not: the 3rd stays absent", false],
      ])("through loadSignals, %s", async (_name, counted) => {
        const { current } = await history(
          presentedWith(at(2), {
            estado: "rechazada",
            period: counted ? "A" : "B",
          }),
        );

        const result = await signalOf(current, scope, "rn14");

        expect(result).toMatchObject({
          outcome: counted ? "present" : "absent",
          evidence: {
            kind: "recurrence",
            count: counted ? 3 : 2,
            threshold: 3,
          },
        });
      });
    });

    describe("RN-26 earlier-only matching (Q5)", () => {
      type Who = { student: number; stranger: number; hash: string };
      type Arrange = (who: Who) => Promise<number>;

      /**
       * An earlier request built by `arrange` and a later request of the same
       * student with a current document of the same fingerprint.
       */
      async function reuse(label: string, arrange: Arrange) {
        const hash = hashFor(label);
        const student = await fixtures.addStudent();
        const stranger = await fixtures.addStudent();
        const earlier = await arrange({
          student: student.id,
          stranger: stranger.id,
          hash,
        });
        const later = await addPresented(student.id, at(2));
        await addDocument(later, { huella: hash });
        return { hash, earlier, later };
      }

      const presented =
        (
          estado: PresentedState,
          document: (hash: string) => DocumentOptions = (huella) => ({
            huella,
          }),
          stranger = false,
        ): Arrange =>
        async (who) => {
          const id = await addPresented(
            stranger ? who.stranger : who.student,
            at(1),
            { estado },
          );
          await addDocument(id, document(who.hash));
          return id;
        };

      const rows: { name: string; present: boolean; arrange: Arrange }[] = [
        {
          name: "presented pendiente, document H",
          present: true,
          arrange: presented("pendiente"),
        },
        {
          name: "presented rechazada, document H",
          present: true,
          arrange: presented("rechazada"),
        },
        {
          name: "presented devuelta, document H",
          present: true,
          arrange: presented("devuelta"),
        },
        {
          name: "presented, document H retired by a correction",
          present: true,
          arrange: presented("devuelta", (huella) => ({
            huella,
            retired: true,
          })),
        },
        {
          name: "draft with document H",
          present: false,
          arrange: async ({ student, hash }) => {
            const id = await addDraftIn(student);
            await addDocument(id, { huella: hash });
            return id;
          },
        },
        {
          name: "presented, document H uploaded by staff (special format)",
          present: false,
          arrange: presented("aprobada", (huella) => ({ huella, staff: true })),
        },
        {
          name: "presented, other student, document H",
          present: true,
          arrange: presented("pendiente", (huella) => ({ huella }), true),
        },
        {
          name: "presented, document from before the change (NULL fingerprint)",
          present: false,
          arrange: presented("pendiente", () => ({ huella: null })),
        },
      ];

      it.each(
        rows.map(
          (row) =>
            [
              `${row.name}: the later request is present = ${row.present}`,
              row,
            ] as const,
        ),
      )("%s", async (_title, { name, present, arrange }) => {
        const { hash, earlier, later } = await reuse(name, arrange);

        const matches = await readEarlierMatches({
          solicitudId: later,
          hashes: [hash],
          referenceScope: scope,
        });
        const result = await signalOf(later, scope, "rn26");

        expect(matches).toEqual(present ? [{ solicitudId: earlier }] : []);
        expect(result).toMatchObject({
          outcome: present ? "present" : "absent",
          evidence: {
            kind: "repeated",
            references: present ? [earlier] : [],
          },
        });
        // A later request reusing its file never changes the earlier one.
        expect(
          await readEarlierMatches({
            solicitudId: earlier,
            hashes: [hash],
            referenceScope: scope,
          }),
        ).toEqual([]);
      });

      it("breaks a tie on the presentation instant by request id", async () => {
        const hash = hashFor("equal-time");
        const student = await fixtures.addStudent();
        const first = await addPresented(student.id, at(1));
        const second = await addPresented(student.id, at(1));
        await addDocument(first, { huella: hash });
        await addDocument(second, { huella: hash });

        expect(await signalOf(second, scope, "rn26")).toMatchObject({
          outcome: "present",
          evidence: { kind: "repeated", references: [first] },
        });
        expect(await signalOf(first, scope, "rn26")).toMatchObject({
          outcome: "absent",
          evidence: { kind: "repeated", references: [] },
        });
      });

      it("never matches a correction re-upload against its own request", async () => {
        const hash = hashFor("correction-same-request");
        const student = await fixtures.addStudent();
        const request = await addPresented(student.id, at(1), {
          estado: "devuelta",
        });
        await addDocument(request, { huella: hash, retired: true });
        await addDocument(request, { huella: hash });

        expect(await signalOf(request, scope, "rn26")).toMatchObject({
          outcome: "absent",
          evidence: { kind: "repeated", references: [] },
        });
      });

      it("flags a correction that reuses a document of another, earlier request", async () => {
        const hash = hashFor("correction-other-request");
        const student = await fixtures.addStudent();
        const earlier = await addPresented(student.id, at(1));
        await addDocument(earlier, { huella: hash });
        const corrected = await addPresented(student.id, at(2), {
          estado: "devuelta",
        });
        await addDocument(corrected, {
          huella: hashFor("correction-old-document"),
          retired: true,
        });
        await addDocument(corrected, { huella: hash });

        expect(await signalOf(corrected, scope, "rn26")).toMatchObject({
          outcome: "present",
          evidence: { kind: "repeated", references: [earlier] },
        });
        expect(await signalOf(earlier, scope, "rn26")).toMatchObject({
          outcome: "absent",
          evidence: { kind: "repeated", references: [] },
        });
      });

      it("orders by the first presentation, never by the resubmission", async () => {
        const hash = hashFor("first-presentation");
        const student = await fixtures.addStudent();
        // E first presented Mon, L Tue, E resubmitted Wed with a document of L.
        const e = await addPresented(student.id, at(0), {
          reenviadaEn: at(48),
        });
        const l = await addPresented(student.id, at(24));
        await addDocument(e, { huella: hash });
        await addDocument(l, { huella: hash });

        expect(await signalOf(e, scope, "rn26")).toMatchObject({
          outcome: "absent",
          evidence: { kind: "repeated", references: [] },
        });
        expect(await signalOf(l, scope, "rn26")).toMatchObject({
          outcome: "present",
          evidence: { kind: "repeated", references: [e] },
        });
      });
    });

    describe("RN-26 reference confined to the caller's scope", () => {
      /** A later request of a student of the main facultad holding `hash`. */
      async function laterRequest(hash: string): Promise<number> {
        const student = await fixtures.addStudent();
        const id = await addPresented(student.id, at(5));
        await addDocument(id, { huella: hash });
        return id;
      }

      async function earlierRequest(
        studentId: number,
        hash: string,
        presentadaEn: Date,
      ): Promise<number> {
        const id = await addPresented(studentId, presentadaEn);
        await addDocument(id, { huella: hash });
        return id;
      }

      const matchesOf = (
        solicitudId: number,
        hash: string,
        referenceScope: RequestScope,
      ) => readEarlierMatches({ solicitudId, hashes: [hash], referenceScope });

      it("nulls, inside the database, the id of a request outside the scope, and keeps the match", async () => {
        const hash = hashFor("scope-out");
        const outside = await fixtures.addStudentInOtherFacultad();
        await earlierRequest(outside.id, hash, at(1));
        const later = await laterRequest(hash);

        expect(await matchesOf(later, hash, scope)).toEqual([
          { solicitudId: null },
        ]);
        expect(await signalOf(later, scope, "rn26")).toMatchObject({
          outcome: "present",
          evidence: { kind: "repeated", references: [] },
        });
      });

      it("references the request of the facultad and hides the others (41 and 55)", async () => {
        const hash = hashFor("scope-mixed");
        const inside = await fixtures.addStudent();
        const outside = await fixtures.addStudentInOtherFacultad();
        const insideId = await earlierRequest(inside.id, hash, at(1));
        const outsideId = await earlierRequest(outside.id, hash, at(2));
        const outsideToo = await earlierRequest(outside.id, hash, at(3));
        const later = await laterRequest(hash);

        const matches = await matchesOf(later, hash, scope);

        // One row for the request of the facultad and one collapsed null: no
        // count of the requests the caller may not see.
        expect(matches).toHaveLength(2);
        expect(matches).toEqual(
          expect.arrayContaining([
            { solicitudId: insideId },
            { solicitudId: null },
          ]),
        );
        const ids = matches.map((match) => match.solicitudId);
        expect(ids).not.toContain(outsideId);
        expect(ids).not.toContain(outsideToo);
        expect(await signalOf(later, scope, "rn26")).toMatchObject({
          outcome: "present",
          evidence: { kind: "repeated", references: [insideId] },
        });
      });

      it("shows the other facultad its own request and hides the first one", async () => {
        const hash = hashFor("scope-other-viewer");
        const inside = await fixtures.addStudent();
        const outside = await fixtures.addStudentInOtherFacultad();
        const insideId = await earlierRequest(inside.id, hash, at(1));
        const outsideId = await earlierRequest(outside.id, hash, at(2));
        const later = await laterRequest(hash);
        const otherScope: RequestScope = {
          kind: "facultad",
          facultadId: outside.facultadId,
        };

        const matches = await matchesOf(later, hash, otherScope);

        expect(matches).toHaveLength(2);
        expect(matches).toEqual(
          expect.arrayContaining([
            { solicitudId: outsideId },
            { solicitudId: null },
          ]),
        );
        expect(matches.map((match) => match.solicitudId)).not.toContain(
          insideId,
        );
      });

      it("gives a caller with no scope the match and no id at all", async () => {
        const hash = hashFor("scope-none");
        const inside = await fixtures.addStudent();
        await earlierRequest(inside.id, hash, at(1));
        const later = await laterRequest(hash);

        expect(await matchesOf(later, hash, { kind: "none" })).toEqual([
          { solicitudId: null },
        ]);
        expect(await signalOf(later, { kind: "none" }, "rn26")).toMatchObject({
          outcome: "present",
          evidence: { kind: "repeated", references: [] },
        });
      });
    });

    // rest-signals-cause-scope (RN-09, RN-10): the declared cause is read from
    // the real `Solicitud.Causa` column, so a non-rest cause never raises the
    // rest signals even when the extraction invented a rest period that ends
    // before the document was issued (brief section 6, criteria 1 and 2).
    describe("RN-09 and RN-10 cause scope (Q1 reads the cause)", () => {
      // Presented the day after the absence ends, inside the RN-07 deadline.
      const ON_TIME = new Date(Date.UTC(2026, 7, 27, 15, 0, 0));

      async function nonRestRequest(causa: Causa, label: string) {
        const student = await fixtures.addStudent();
        const id = await addPresented(student.id, ON_TIME, {
          causa,
          groupId: groupA,
        });
        const documentId = await addDocument(id, {
          huella: hashFor(label),
        });
        // The invented rest ends before the issue date: RN-09 for a medical
        // request.
        await addExtraction(documentId, "completada", ISSUER, {
          issueDate: "2026-08-27",
          restTo: "2026-08-26",
        });
        return id;
      }

      it("makes RN-09 and RN-10 not applicable for fuerza_mayor and leaves no alerts", async () => {
        const id = await nonRestRequest("fuerza_mayor", "cause-scope-fm");

        const read = await loadSignals({
          solicitudId: id,
          referenceScope: scope,
        });

        expect(read.degraded).toBe(false);
        expect(read.data?.results.map((r) => [r.signal, r.outcome])).toEqual([
          ["rn07", "absent"],
          ["rn09", "not_applicable"],
          ["rn10", "not_applicable"],
          ["rn14", "absent"],
          ["rn26", "absent"],
        ]);
        expect(read.data?.verdict).toBe("no_alerts");
        expect(read.data?.notEvaluable).toEqual([]);
      });

      it("still raises RN-09 for the same extraction on a medical request", async () => {
        const id = await nonRestRequest("medica", "cause-scope-medica");

        expect(await signalOf(id, scope, "rn09")).toMatchObject({
          outcome: "present",
        });
      });
    });
  },
);
