import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { reviewQueueQuery } from "@/lib/data/revision-queue";

// Real-Postgres proof that the pending queue is served by the recreated
// `IX_Solicitud_Cola` (escalation, task 12.10, ES-5). The migration drops and
// recreates the index on `coalesce(PlazoInicioEn, ReenviadaEn, PresentadaEn)`;
// this proves the planner still uses it for the statement `listReviewQueue`
// issues, and needs no Sort on top of it.
//
// The statement is the one `listReviewQueue` runs: the builder is the exported
// `reviewQueueQuery` (state filter, facultad scope and ordering included), and
// its generated SQL is what gets planned, with the bound values written in as
// literals so the partial index predicate is provable. Tiny tables otherwise
// choose a sequential scan, so the plan is read with `enable_seqscan = off`.
// Nothing is written: the SET is local to a read-only transaction. Planner
// choices on a nearly empty branch are a signal, not a benchmark: a failure
// here is a reason to look at the plan, not proof of a production problem.
//
// HOW TO RUN (never part of `npm test`; owner-run, phase 14):
//   INTEGRATION_DATABASE_URL=<disposable branch url> \
//   INTEGRATION_ALLOW_WRITES=1 npm run test:integration
// The branch needs migration `0011_escalation` applied.

// Decided by vitest.integration.setup.ts before it replaced DATABASE_URL.
const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  Plans?: PlanNode[];
};

// Any facultad: the planner needs the shape of the scope, not an existing row.
const FACULTAD_SCOPE = { kind: "facultad", facultadId: 1 } as const;

/** The generated `$n` placeholders as literals; only strings and numbers. */
function withLiterals(text: string, params: readonly unknown[]): string {
  return text.replace(/\$(\d+)/g, (_match, position: string) => {
    const value = params[Number(position) - 1];
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
    throw new Error(`Unexpected type for the queue parameter $${position}`);
  });
}

/** Every node of a plan tree, parents before children. */
function nodesOf(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(nodesOf)];
}

describe.skipIf(gate.mode !== "run")(
  "pending queue index (real Postgres)",
  () => {
    async function planOfQueueOrdering(): Promise<PlanNode[]> {
      const query = reviewQueueQuery(FACULTAD_SCOPE).toSQL();
      const statement = withLiterals(query.sql, query.params);

      return db.transaction(async (tx) => {
        await tx.execute(sql`SET TRANSACTION READ ONLY`);
        await tx.execute(sql`SET LOCAL enable_seqscan = off`);
        const rows = await tx.execute(
          sql`EXPLAIN (FORMAT JSON) ${sql.raw(statement)}`,
        );
        const [row] = rows as unknown as Array<{
          "QUERY PLAN": unknown;
        }>;
        const raw = row["QUERY PLAN"];
        const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as [
          { Plan: PlanNode },
        ];
        return nodesOf(parsed[0].Plan);
      });
    }

    it("reads the pending requests through IX_Solicitud_Cola, in index order", async () => {
      const nodes = await planOfQueueOrdering();

      // The scope's subquery reads other tables; only the request table counts.
      const scans = nodes.filter((n) => n["Relation Name"] === "Solicitud");
      expect(scans.map((n) => n["Node Type"])).toEqual([
        expect.stringMatching(/^Index (Only )?Scan$/),
      ]);
      expect(scans[0]["Index Name"]).toBe("IX_Solicitud_Cola");
      // The index already delivers the order: a Sort node would mean the
      // expression or the column order of the index no longer matches.
      expect(nodes.map((n) => n["Node Type"])).not.toContain("Sort");
    });
  },
);
