// Scripted double of the drizzle `db` / `tx` handles for data-layer unit tests.
// The real SQL is never executed (the project forbids DB writes from tests);
// each statement consumes the next scripted step in order, so a test pins the
// exact sequence of statements a data function issues and what it does with
// the rows each returns. Row-lock and constraint semantics are covered by the
// generated-SQL tests, not here.

export type StatementKind = "select" | "insert" | "update" | "delete";

/** `error` makes the statement reject, to script a failing item. */
export type Step = { kind: StatementKind; rows?: unknown; error?: unknown };

export type LoggedStatement = {
  kind: StatementKind;
  table?: unknown;
  values?: unknown;
  set?: unknown;
  where?: unknown;
  inTransaction: boolean;
};

function builder(
  rows: unknown,
  record: (patch: Partial<LoggedStatement>) => void,
  error?: unknown,
) {
  const proxy: unknown = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") {
        return (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) =>
          (error === undefined
            ? Promise.resolve(rows)
            : Promise.reject(error)
          ).then(resolve, reject);
      }
      if (prop === "from") {
        return (table: unknown) => {
          record({ table });
          return proxy;
        };
      }
      if (prop === "values") {
        return (values: unknown) => {
          record({ values });
          return proxy;
        };
      }
      if (prop === "where") {
        return (where: unknown) => {
          record({ where });
          return proxy;
        };
      }
      if (prop === "set") {
        return (set: unknown) => {
          record({ set });
          return proxy;
        };
      }
      return () => proxy;
    },
  });
  return proxy;
}

export function createDbDouble(script: readonly Step[]) {
  const log: LoggedStatement[] = [];
  let cursor = 0;
  let transactions = 0;
  let inTransaction = false;

  function statement(kind: StatementKind, table?: unknown) {
    const step = script[cursor++];
    if (!step) throw new Error(`Unscripted ${kind} statement #${cursor}`);
    if (step.kind !== kind) {
      throw new Error(
        `Statement #${cursor}: expected ${step.kind}, got ${kind}`,
      );
    }
    const entry: LoggedStatement = { kind, table, inTransaction };
    log.push(entry);
    return builder(
      step.rows ?? [],
      (patch) => Object.assign(entry, patch),
      step.error,
    );
  }

  const handle = {
    select: () => statement("select"),
    insert: (table: unknown) => statement("insert", table),
    update: (table: unknown) => statement("update", table),
    delete: (table: unknown) => statement("delete", table),
  };

  const db = {
    ...handle,
    async transaction<T>(callback: (tx: typeof handle) => Promise<T>) {
      transactions += 1;
      inTransaction = true;
      try {
        return await callback(handle);
      } finally {
        inTransaction = false;
      }
    },
  };

  return {
    db,
    tx: handle,
    log,
    get transactions() {
      return transactions;
    },
    /** True once every scripted step has been consumed. */
    get exhausted() {
      return cursor === script.length;
    },
  };
}
