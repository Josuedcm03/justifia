// @vitest-environment node
import { readFileSync } from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDocumentStore } from "@/lib/intake/fakes";

import {
  createDbDouble,
  type LoggedStatement,
  type Step,
} from "./test-support/db-double";

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

import { runIntakeSweep } from "./intake-sweep";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const DRAFT_CUTOFF = "2026-09-07T15:00:00.000Z";
const PENDING_CUTOFF = "2026-10-07T14:00:00.000Z";
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const path = (draft: number, n: number) =>
  `intake/${draft}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c0${n}.pdf`;

const DRAFTS = 0;
const PENDING = 1;
const NONE: Step[] = [
  { kind: "select", rows: [] }, // expired drafts
  { kind: "select", rows: [] }, // pending documents
];

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function query(statement: LoggedStatement) {
  return new PgDialect().sqlToQuery(
    statement.where as Parameters<PgDialect["sqlToQuery"]>[0],
  );
}

/** Statements the draft sweep issues for one draft with these blobs. */
const purge = (blobs: string[], deleted = true): Step[] => [
  { kind: "select", rows: blobs.map((pathname) => ({ pathname })) },
  { kind: "delete", rows: deleted ? [{ id: 1 }] : [] },
];

beforeEach(() => {
  insertAuditMock.mockReset();
});

describe("runIntakeSweep: expired drafts (D8)", () => {
  it("selects only borrador drafts idle for 30 days, never other states", async () => {
    const double = use([...NONE]);

    await runIntakeSweep(NOW, createFakeDocumentStore());

    const q = query(double.log[DRAFTS]);
    expect(q.sql).toContain('"Solicitud"."Estado"');
    expect(q.sql).toContain('"Solicitud"."ActualizadoEn"');
    expect(q.params).toContain("borrador");
    expect(q.params).toContain(DRAFT_CUTOFF);
    expect(double.exhausted).toBe(true);
  });

  it("deletes the rows of each draft and then its stored files", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(1, 1), [1]);
    store.seed(path(2, 1), [1]);
    const double = use([
      { kind: "select", rows: [{ id: 1 }, { id: 2 }] },
      ...purge([path(1, 1)]),
      ...purge([path(2, 1)]),
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toEqual({
      draftsDeleted: 2,
      pendingDocumentsDeleted: 0,
      orphanBlobsDeleted: 0,
      extractionsRun: 0,
      extractionsAbandoned: 0,
      failures: 0,
    });
    expect(store.has(path(1, 1))).toBe(false);
    expect(store.has(path(2, 1))).toBe(false);
    const deletes = double.log.filter((s) => s.kind === "delete");
    expect(deletes).toHaveLength(2);
    expect(query(deletes[0]).params).toContain("borrador");
  });

  it("one failing blob deletion does not stop the sweep (spec: One failure)", async () => {
    const store = createFakeDocumentStore();
    for (const draft of [1, 2, 3]) store.seed(path(draft, 1), [1]);
    const realDelete = store.delete.bind(store);
    store.delete = async (pathnames) => {
      if (pathnames.includes(path(2, 1))) throw new Error("blob down");
      return realDelete(pathnames);
    };
    use([
      { kind: "select", rows: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      ...purge([path(1, 1)]),
      ...purge([path(2, 1)]),
      ...purge([path(3, 1)]),
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toMatchObject({ draftsDeleted: 3, failures: 1 });
    expect(store.has(path(1, 1))).toBe(false);
    expect(store.has(path(2, 1))).toBe(true);
    expect(store.has(path(3, 1))).toBe(false);
  });

  it("one failing row deletion is counted and the next draft is still swept", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(3, 1), [1]);
    use([
      { kind: "select", rows: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      ...purge([]),
      { kind: "select", rows: [] },
      { kind: "delete", error: new Error("lock timeout") },
      ...purge([path(3, 1)]),
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toMatchObject({ draftsDeleted: 2, failures: 1 });
    expect(store.has(path(3, 1))).toBe(false);
  });

  it("skips a draft another request already removed (idempotent)", async () => {
    const counts = await (async () => {
      use([
        { kind: "select", rows: [{ id: 1 }] },
        ...purge([path(1, 1)], false),
        ...NONE.slice(1),
      ]);
      return runIntakeSweep(NOW, createFakeDocumentStore());
    })();

    expect(counts).toMatchObject({ draftsDeleted: 0, failures: 0 });
  });

  it("asks for another batch while the previous one was full", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    const double = use([
      { kind: "select", rows: ids },
      ...ids.flatMap(() => purge([])),
      { kind: "select", rows: [{ id: 101 }] },
      ...purge([]),
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(NOW, createFakeDocumentStore());

    expect(counts.draftsDeleted).toBe(101);
    expect(double.exhausted).toBe(true);
  });

  it("stops after a full batch in which nothing could be deleted", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    const double = use([
      { kind: "select", rows: ids },
      ...ids.flatMap(() => [
        { kind: "select" as const, rows: [] },
        { kind: "delete" as const, error: new Error("locked") },
      ]),
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(NOW, createFakeDocumentStore());

    // A second draft batch would eat the pending-documents step's statement,
    // which then fails as unscripted and shows up as a 101st failure.
    expect(counts).toMatchObject({ draftsDeleted: 0, failures: 100 });
    expect(double.exhausted).toBe(true);
  });
});

describe("runIntakeSweep: failed finalizations (pendiente grace)", () => {
  it("removes pendiente documents of drafts older than one hour", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(1, 1), [1]);
    const double = use([
      { kind: "select", rows: [] },
      {
        kind: "select",
        rows: [{ id: 11, pathname: path(1, 1) }],
      },
      { kind: "delete" },
    ]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toMatchObject({ pendingDocumentsDeleted: 1, failures: 0 });
    expect(store.has(path(1, 1))).toBe(false);
    const q = query(double.log[PENDING]);
    expect(q.params).toContain("pendiente");
    expect(q.params).toContain("borrador");
    expect(q.params).toContain(PENDING_CUTOFF);
  });

  it("counts a failed removal and still sweeps orphans", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(9, 1), [1], hoursAgo(30));
    use([
      { kind: "select", rows: [] },
      { kind: "select", rows: [{ id: 11, pathname: path(1, 1) }] },
      { kind: "delete", error: new Error("lock timeout") },
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toMatchObject({
      pendingDocumentsDeleted: 0,
      orphanBlobsDeleted: 1,
      failures: 1,
    });
  });
});

describe("runIntakeSweep: orphan blobs (D8, D14)", () => {
  it("deletes unreferenced files over 24 hours, keeping fresh and referenced ones", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(1, 1), [1], hoursAgo(25)); // old orphan
    store.seed(path(1, 2), [1], hoursAgo(2)); // fresh orphan
    store.seed(path(1, 3), [1], hoursAgo(48)); // old but referenced
    const double = use([
      ...NONE,
      { kind: "select", rows: [{ pathname: path(1, 3) }] },
    ]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts.orphanBlobsDeleted).toBe(1);
    expect(store.has(path(1, 1))).toBe(false);
    expect(store.has(path(1, 2))).toBe(true);
    expect(store.has(path(1, 3))).toBe(true);
    // Only the old files are looked up; the fresh one never reaches the query.
    const lookup = double.log[2];
    expect(lookup.kind).toBe("select");
    expect(JSON.stringify(query(lookup).params)).toContain(path(1, 3));
    expect(JSON.stringify(query(lookup).params)).not.toContain(path(1, 2));
  });

  it("asks the database nothing when every file is fresh", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(1, 2), [1], hoursAgo(2));
    const double = use([...NONE]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts.orphanBlobsDeleted).toBe(0);
    expect(double.exhausted).toBe(true);
    expect(store.has(path(1, 2))).toBe(true);
  });

  it("lists only the draft prefix and follows the cursor across pages", async () => {
    const store = createFakeDocumentStore();
    const pages = [
      {
        blobs: [{ pathname: path(1, 1), uploadedAt: hoursAgo(30) }],
        cursor: "next",
      },
      { blobs: [{ pathname: path(2, 1), uploadedAt: hoursAgo(30) }] },
    ];
    const list = vi.fn(async (_prefix: string, cursor?: string) =>
      cursor === undefined ? pages[0] : pages[1],
    );
    store.list = list;
    const deleted: string[][] = [];
    store.delete = async (pathnames) => {
      deleted.push([...pathnames]);
    };
    use([...NONE, { kind: "select", rows: [] }, { kind: "select", rows: [] }]);

    const counts = await runIntakeSweep(NOW, store);

    expect(list.mock.calls).toEqual([
      ["intake/", undefined],
      ["intake/", "next"],
    ]);
    expect(deleted).toEqual([[path(1, 1)], [path(2, 1)]]);
    expect(counts.orphanBlobsDeleted).toBe(2);
  });

  it("counts a failed deletion and keeps going", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(1, 1), [1], hoursAgo(30));
    store.delete = async () => {
      throw new Error("blob down");
    };
    use([...NONE, { kind: "select", rows: [] }]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toMatchObject({ orphanBlobsDeleted: 0, failures: 1 });
  });

  it("counts a failing listing as one failure", async () => {
    const store = createFakeDocumentStore();
    store.list = async () => {
      throw new Error("list down");
    };
    use([...NONE]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toMatchObject({ orphanBlobsDeleted: 0, failures: 1 });
  });
});

describe("runIntakeSweep: no audit rows (D14)", () => {
  it("writes none while deleting drafts, documents and blobs", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(1, 1), [1], hoursAgo(30));
    store.seed(path(2, 1), [1], hoursAgo(30));
    use([
      { kind: "select", rows: [{ id: 1 }] },
      ...purge([path(1, 1)]),
      { kind: "select", rows: [{ id: 11, pathname: path(3, 1) }] },
      { kind: "delete" },
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toMatchObject({
      draftsDeleted: 1,
      pendingDocumentsDeleted: 1,
      orphanBlobsDeleted: 1,
    });
    expect(insertAuditMock).not.toHaveBeenCalled();
  });
});

describe("runIntakeSweep: returned requests and retired documents (SR-14, RF-08 b)", () => {
  const RETIRED = path(31, 1);
  const FORTY_DAYS = 40 * 24;

  it("never selects a returned request: the draft sweep is borrador only", async () => {
    const double = use([...NONE]);

    await runIntakeSweep(NOW, createFakeDocumentStore());

    const q = query(double.log[DRAFTS]);
    expect(q.params).toContain("borrador");
    expect(q.params).not.toContain("devuelta");
    expect(q.params).not.toContain("pendiente");
  });

  it("the guarded draft delete cannot remove a returned request either", async () => {
    const double = use([
      { kind: "select", rows: [{ id: 31 }] },
      ...purge([]),
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await runIntakeSweep(NOW, createFakeDocumentStore());

    const remove = double.log.find((s) => s.kind === "delete")!;
    expect(query(remove).params).toContain("borrador");
    expect(query(remove).params).not.toContain("devuelta");
  });

  it("only sweeps pendiente files of borrador requests, never a retired (valido) document", async () => {
    const double = use([...NONE]);

    await runIntakeSweep(NOW, createFakeDocumentStore());

    const q = query(double.log[PENDING]);
    expect(q.params).toContain("pendiente");
    expect(q.params).toContain("borrador");
    expect(q.params).not.toContain("valido");
    expect(q.params).not.toContain("devuelta");
  });

  it("keeps the record and the file of a document retired 40 days ago", async () => {
    const store = createFakeDocumentStore();
    store.seed(RETIRED, [1], hoursAgo(FORTY_DAYS));
    const double = use([
      ...NONE,
      { kind: "select", rows: [{ pathname: RETIRED }] },
    ]);

    const counts = await runIntakeSweep(NOW, store);

    expect(counts).toEqual({
      draftsDeleted: 0,
      pendingDocumentsDeleted: 0,
      orphanBlobsDeleted: 0,
      extractionsRun: 0,
      extractionsAbandoned: 0,
      failures: 0,
    });
    expect(store.has(RETIRED)).toBe(true);
    expect(double.log.filter((s) => s.kind === "delete")).toHaveLength(0);
    // The file was old enough to be an orphan; only its record protects it.
    expect(JSON.stringify(query(double.log[2]).params)).toContain(RETIRED);
  });
});

describe("runIntakeSweep: extraction step (DE-11, RF-11)", () => {
  const REPORT = { run: 4, abandoned: 2, failures: 0 };
  /** DE-7: the invocation started at NOW and ends 275 s later. */
  const DEADLINE = new Date(NOW.getTime() + 275_000);

  function step(
    sweep: (now: Date, deadline: Date) => Promise<typeof REPORT> = async () =>
      REPORT,
  ) {
    return { sweep: vi.fn(sweep) };
  }

  it("runs once with the sweep clock and the invocation deadline", async () => {
    use([...NONE]);
    const extraction = step();

    await runIntakeSweep(NOW, createFakeDocumentStore(), extraction);

    expect(extraction.sweep).toHaveBeenCalledTimes(1);
    expect(extraction.sweep).toHaveBeenCalledWith(NOW, DEADLINE);
  });

  it("runs after the three cleanup steps, never before", async () => {
    const order: string[] = [];
    const store = createFakeDocumentStore();
    const list = store.list.bind(store);
    store.list = async (...args) => {
      order.push("orphans");
      return list(...args);
    };
    const double = use([...NONE]);
    const extraction = step(async () => {
      order.push(`extraction after ${double.log.length} statements`);
      return REPORT;
    });

    await runIntakeSweep(NOW, store, extraction);

    expect(order).toEqual(["orphans", "extraction after 2 statements"]);
  });

  it("reports the documents run and the leases abandoned, and adds the step's failures", async () => {
    use([...NONE]);

    const counts = await runIntakeSweep(
      NOW,
      createFakeDocumentStore(),
      step(async () => ({ run: 4, abandoned: 2, failures: 3 })),
    );

    expect(counts).toEqual({
      draftsDeleted: 0,
      pendingDocumentsDeleted: 0,
      orphanBlobsDeleted: 0,
      extractionsRun: 4,
      extractionsAbandoned: 2,
      failures: 3,
    });
  });

  it("keeps the cleanup failures and the step's failures together", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(1, 1), [1]);
    store.delete = async () => {
      throw new Error("blob down");
    };
    use([
      { kind: "select", rows: [{ id: 1 }] },
      ...purge([path(1, 1)]),
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(
      NOW,
      store,
      step(async () => ({ run: 1, abandoned: 0, failures: 2 })),
    );

    expect(counts).toMatchObject({
      draftsDeleted: 1,
      extractionsRun: 1,
      failures: 3,
    });
  });

  it("a throwing step still leaves the cleanup done and counts one failure (spec: Extraction failure does not stop cleanup)", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(1, 1), [1]);
    use([
      { kind: "select", rows: [{ id: 1 }] },
      ...purge([path(1, 1)]),
      { kind: "select", rows: [] },
    ]);

    const counts = await runIntakeSweep(
      NOW,
      store,
      step(async () => {
        throw new Error("model server down: postgres://u:p@host/db");
      }),
    );

    expect(counts).toEqual({
      draftsDeleted: 1,
      pendingDocumentsDeleted: 0,
      orphanBlobsDeleted: 0,
      extractionsRun: 0,
      extractionsAbandoned: 0,
      failures: 1,
    });
    expect(store.has(path(1, 1))).toBe(false);
  });

  it("without an extraction step nothing is run and both counts are zero", async () => {
    use([...NONE]);

    const counts = await runIntakeSweep(NOW, createFakeDocumentStore());

    expect(counts).toMatchObject({
      extractionsRun: 0,
      extractionsAbandoned: 0,
    });
  });

  it("deletes and modifies nothing on behalf of the step, and writes no audit row", async () => {
    const double = use([...NONE]);

    await runIntakeSweep(NOW, createFakeDocumentStore(), step());

    // Only the two cleanup selects ran: no delete, update or insert.
    expect(double.log.map((s) => s.kind)).toEqual(["select", "select"]);
    expect(double.exhausted).toBe(true);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("leaves a pendiente request older than 30 days and its documents alone", async () => {
    const store = createFakeDocumentStore();
    store.seed(path(40, 1), [1], hoursAgo(40 * 24));
    const double = use([
      ...NONE,
      { kind: "select", rows: [{ pathname: path(40, 1) }] },
    ]);

    const counts = await runIntakeSweep(NOW, store, step());

    expect(double.log.filter((s) => s.kind === "delete")).toHaveLength(0);
    expect(store.has(path(40, 1))).toBe(true);
    expect(counts).toMatchObject({
      draftsDeleted: 0,
      pendingDocumentsDeleted: 0,
      orphanBlobsDeleted: 0,
    });
  });
});

describe("intake-sweep.ts: no adapter (DE-11)", () => {
  it("imports from the extraction slice only its pure limits", () => {
    const source = readFileSync(
      nodePath.join(
        nodePath.dirname(fileURLToPath(import.meta.url)),
        "intake-sweep.ts",
      ),
      "utf8",
    );

    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
    expect(specifiers.length).toBeGreaterThan(5);
    expect(specifiers.filter((s) => /extraction/.test(s)).sort()).toEqual([
      "@/lib/extraction/limits",
    ]);
  });
});
