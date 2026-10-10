import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
};

async function loadEnv(extra: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE, ...extra })) {
    if (value === undefined) vi.stubEnv(key, "");
    else vi.stubEnv(key, value);
  }
  return (await import("@/env")).env;
}

describe("env (justification-intake D1, D10)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes BLOB_READ_WRITE_TOKEN and CRON_SECRET when set", async () => {
    const env = await loadEnv({
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_placeholder",
      CRON_SECRET: "c".repeat(16),
    });
    expect(env.BLOB_READ_WRITE_TOKEN).toBe("vercel_blob_rw_placeholder");
    expect(env.CRON_SECRET).toBe("c".repeat(16));
  });

  it("treats both as optional so builds and tests need no store", async () => {
    const env = await loadEnv({
      BLOB_READ_WRITE_TOKEN: undefined,
      CRON_SECRET: undefined,
    });
    expect(env.BLOB_READ_WRITE_TOKEN).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("rejects a CRON_SECRET too short to be a secret", async () => {
    await expect(loadEnv({ CRON_SECRET: "short" })).rejects.toThrow();
  });
});
