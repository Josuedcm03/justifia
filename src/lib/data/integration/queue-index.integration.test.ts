import { asc, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { effectiveClockStart } from "@/db/clock-start";
import { solicitud } from "@/db/schema";

// Real-Postgres proof that the pending queue is served by the recreated
// `IX_Solicitud_Cola` (escalation, task 12.10, ES-5). The migration drops and
// recreates the index on `coalesce(PlazoInicioEn, ReenviadaEn, PresentadaEn)`;
// this proves the planner still uses it for the ordering `listReviewQueue`
// issues, and needs no Sort on top of it.
//
// The ORDER BY is built from the same `effectiveClockStart` function as the
// schema's index, so the planner sees the identical expression (the query
// itself is the one of `revision-queue.ts`, minus the facultad filter, which is
// orthogonal to the order). Tiny tables otherwise choose a sequential scan, so
// the plan is read with `enable_seqscan = off`. Nothing is written: the SET is
// local to a read-only transaction.
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
  "Index Name"?: string;
  Plans?: PlanNode[];
};

/** Every node of a plan tree, parents before children. */
function nodesOf(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(nodesOf)];
}

describe.skipIf(gate.mode !== "run")(
  "pending queue index (real Postgres)",
  () => {
    async function planOfQueueOrdering(): Promise<PlanNode[]> {
      const query = db
        .select({
          id: solicitud.id,
          presentadaEn: solicitud.presentadaEn,
          reenviadaEn: solicitud.reenviadaEn,
          plazoInicioEn: solicitud.plazoInicioEn,
        })
        .from(solicitud)
        .where(sql`${solicitud.estado} = 'pendiente'`)
        .orderBy(asc(effectiveClockStart(solicitud)), asc(solicitud.id))
        .toSQL();

      // The state is a literal, so the partial index predicate is provable
      // without depending on how the driver binds parameters.
      if (query.params.length > 0) {
        throw new Error("The queue ordering query must not bind parameters");
      }

      return db.transaction(async (tx) => {
        await tx.execute(sql`SET TRANSACTION READ ONLY`);
        await tx.execute(sql`SET LOCAL enable_seqscan = off`);
        const rows = await tx.execute(
          sql`EXPLAIN (FORMAT JSON) ${sql.raw(query.sql)}`,
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

      const scans = nodes.filter((n) => n["Node Type"].includes("Scan"));
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
