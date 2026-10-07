// Connection pool settings (D11). Kept pure and separate from `index.ts` so the
// environment branch is testable without opening a connection.
//
// Production runs on serverless functions against the Neon pooled endpoint
// (`-pooler` host, PgBouncer in transaction mode): each instance keeps a small
// pool, and `prepare: false` is the postgres-js recommendation behind
// PgBouncer transaction mode (named prepared statements do not survive
// connection reuse across transactions).
export function poolOptions(nodeEnv: string) {
  if (nodeEnv === "production") {
    return {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    };
  }
  return { max: 10 };
}
