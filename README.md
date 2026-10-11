# justifia

## Integration tests (real Postgres, opt-in)

`npm test` never touches a database. The concurrency suite under
`src/lib/data/integration/` runs the real data-layer functions against a real
Postgres so the database decides each race (one live draft, one successful
submit, at most 5 documents). It writes and deletes rows, so point it at a
**disposable Neon branch** with the migrations applied, never at production.
Prefer the branch's direct (non-`-pooler`) connection string.

```bash
INTEGRATION_DATABASE_URL="<disposable branch url>" INTEGRATION_ALLOW_WRITES=1 npm run test:integration
```

Without `INTEGRATION_DATABASE_URL` the suite is skipped. With it but without
`INTEGRATION_ALLOW_WRITES=1`, with a URL equal to `DATABASE_URL`, or with a
host or database name containing `prod`, the run fails on purpose. Blob I/O uses
an in-memory fake. Audit rows are append-only, so students that submitted stay
on the branch after a run.
