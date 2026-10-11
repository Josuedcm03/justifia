// Gate of the opt-in real-Postgres suites (justification-intake F.6). Pure, so
// the safety rules are unit-tested in the default run. The suites write rows,
// so they must never run by accident or against the live database.

export type IntegrationGate =
  | { mode: "skip" }
  | { mode: "run"; url: string }
  | { mode: "refuse"; reason: string };

type Env = Readonly<Record<string, string | undefined>>;

const PRODUCTION_LOOKING = /prod/i;

/**
 * - `skip`: `INTEGRATION_DATABASE_URL` is unset; the suites are not collected.
 * - `refuse`: it is set but unsafe; the suites fail loudly instead of skipping.
 * - `run`: a disposable database was named and writes were allowed explicitly.
 *
 * `INTEGRATION_FORBIDDEN_URL` is the application URL the setup file saw before
 * it replaced `DATABASE_URL` with the integration one.
 */
export function resolveIntegrationGate(env: Env): IntegrationGate {
  const url = env.INTEGRATION_DATABASE_URL;
  if (!url) return { mode: "skip" };

  if (env.INTEGRATION_ALLOW_WRITES !== "1") {
    return {
      mode: "refuse",
      reason:
        "INTEGRATION_ALLOW_WRITES=1 is required: the suite writes and deletes rows, so it must point at a disposable Neon branch.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      mode: "refuse",
      reason: "INTEGRATION_DATABASE_URL is not a valid URL.",
    };
  }

  for (const own of [env.DATABASE_URL, env.INTEGRATION_FORBIDDEN_URL]) {
    if (own && own === url) {
      return {
        mode: "refuse",
        reason:
          "INTEGRATION_DATABASE_URL equals the application's DATABASE_URL. Use a disposable Neon branch.",
      };
    }
  }

  const database = parsed.pathname.replace(/^\//, "");
  if (
    PRODUCTION_LOOKING.test(parsed.hostname) ||
    PRODUCTION_LOOKING.test(database)
  ) {
    return {
      mode: "refuse",
      reason:
        "The integration host or database name looks like production. Use a disposable Neon branch.",
    };
  }

  return { mode: "run", url };
}
