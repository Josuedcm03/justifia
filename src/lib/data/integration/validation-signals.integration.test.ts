import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { documentoRespaldo } from "@/db/schema";
import { earlierMatchesQuery } from "@/lib/data/signals";
import { createFixtures, PDF_BYTES } from "@/lib/data/integration/fixtures";
import { buildPathname } from "@/lib/intake/pathnames";

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
