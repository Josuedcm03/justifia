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

describe("env mail settings (teacher-remission TR-9)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes RESEND_API_KEY and MAIL_FROM when set", async () => {
    const env = await loadEnv({
      RESEND_API_KEY: "re_placeholder",
      MAIL_FROM: "Justifia UAM <justificaciones@uam.edu.ni>",
    });
    expect(env.RESEND_API_KEY).toBe("re_placeholder");
    expect(env.MAIL_FROM).toBe("Justifia UAM <justificaciones@uam.edu.ni>");
  });

  it("treats both as optional so builds and tests need no mail provider", async () => {
    const env = await loadEnv({
      RESEND_API_KEY: undefined,
      MAIL_FROM: undefined,
    });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.MAIL_FROM).toBeUndefined();
  });
});

describe("env APP_BASE_URL (escalation ES-10)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes the absolute base URL of the app when set", async () => {
    const env = await loadEnv({ APP_BASE_URL: "https://justifia.example.edu" });
    expect(env.APP_BASE_URL).toBe("https://justifia.example.edu");
  });

  it("is optional, and an empty value means not configured", async () => {
    const env = await loadEnv({ APP_BASE_URL: undefined });
    expect(env.APP_BASE_URL).toBeUndefined();
  });

  it("rejects a value that is not an absolute URL", async () => {
    await expect(
      loadEnv({ APP_BASE_URL: "justifia.example.edu" }),
    ).rejects.toThrow();
  });

  it.each([
    "http://localhost:3000",
    "https://justifia.example.edu/",
    "https://justifia.example.edu/app",
  ])("accepts the http(s) origin %s", async (value) => {
    const env = await loadEnv({ APP_BASE_URL: value });
    expect(env.APP_BASE_URL).toBe(value);
  });

  it.each([
    "ftp://justifia.example.edu",
    "file:///srv/justifia",
    "javascript:alert(1)",
    "mailto:coordinacion@uam.edu.ni",
  ])(
    "rejects the scheme of %s: the link must be http or https",
    async (value) => {
      await expect(loadEnv({ APP_BASE_URL: value })).rejects.toThrow();
    },
  );

  it.each([
    "https://justifia.example.edu?next=/x",
    "https://justifia.example.edu/?",
    "https://justifia.example.edu/#top",
    "https://justifia.example.edu/app#",
  ])("rejects %s: no query and no fragment", async (value) => {
    await expect(loadEnv({ APP_BASE_URL: value })).rejects.toThrow();
  });
});

describe("env extraction settings (document-extraction DE-12)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes EXTRACTION_API_URL and EXTRACTION_API_KEY when set", async () => {
    const env = await loadEnv({
      EXTRACTION_API_URL: "https://model.example.test",
      EXTRACTION_API_KEY: "k".repeat(16),
    });
    expect(env.EXTRACTION_API_URL).toBe("https://model.example.test");
    expect(env.EXTRACTION_API_KEY).toBe("k".repeat(16));
  });

  it("treats both as optional: unset or empty never throws at import", async () => {
    const unset = await loadEnv({
      EXTRACTION_API_URL: undefined,
      EXTRACTION_API_KEY: undefined,
    });
    expect(unset.EXTRACTION_API_URL).toBeUndefined();
    expect(unset.EXTRACTION_API_KEY).toBeUndefined();

    const empty = await loadEnv({
      EXTRACTION_API_URL: "",
      EXTRACTION_API_KEY: "",
    });
    expect(empty.EXTRACTION_API_URL).toBeUndefined();
    expect(empty.EXTRACTION_API_KEY).toBeUndefined();
  });

  it("accepts a URL with no key (a local container needs none)", async () => {
    const env = await loadEnv({
      EXTRACTION_API_URL: "http://127.0.0.1:8080",
      EXTRACTION_API_KEY: undefined,
    });
    expect(env.EXTRACTION_API_URL).toBe("http://127.0.0.1:8080");
    expect(env.EXTRACTION_API_KEY).toBeUndefined();
  });

  it("rejects a key too short to be a secret", async () => {
    await expect(loadEnv({ EXTRACTION_API_KEY: "short" })).rejects.toThrow();
  });

  it("accepts a key of exactly 16 characters", async () => {
    const env = await loadEnv({ EXTRACTION_API_KEY: "k".repeat(16) });
    expect(env.EXTRACTION_API_KEY).toBe("k".repeat(16));
  });
});
