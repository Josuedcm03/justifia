import { describe, expect, it } from "vitest";

import { resolveIntegrationGate } from "@/lib/data/integration/guard";

const BRANCH = "postgres://u:p@ep-test-branch.us-east-2.aws.neon.tech/neondb";

describe("resolveIntegrationGate", () => {
  it("skips when no integration URL is set", () => {
    expect(resolveIntegrationGate({})).toEqual({ mode: "skip" });
    expect(resolveIntegrationGate({ INTEGRATION_DATABASE_URL: "" })).toEqual({
      mode: "skip",
    });
  });

  it("refuses a URL without the explicit write opt-in", () => {
    const gate = resolveIntegrationGate({ INTEGRATION_DATABASE_URL: BRANCH });
    expect(gate.mode).toBe("refuse");
  });

  it("refuses an opt-in other than the exact value 1", () => {
    const gate = resolveIntegrationGate({
      INTEGRATION_DATABASE_URL: BRANCH,
      INTEGRATION_ALLOW_WRITES: "true",
    });
    expect(gate.mode).toBe("refuse");
  });

  it("refuses a URL that is not a valid URL", () => {
    const gate = resolveIntegrationGate({
      INTEGRATION_DATABASE_URL: "not a url",
      INTEGRATION_ALLOW_WRITES: "1",
    });
    expect(gate.mode).toBe("refuse");
  });

  it("refuses the application's own database URL", () => {
    for (const key of ["DATABASE_URL", "INTEGRATION_FORBIDDEN_URL"]) {
      const gate = resolveIntegrationGate({
        INTEGRATION_DATABASE_URL: BRANCH,
        INTEGRATION_ALLOW_WRITES: "1",
        [key]: BRANCH,
      });
      expect(gate.mode, key).toBe("refuse");
    }
  });

  it.each([
    "postgres://u:p@ep-prod-123.us-east-2.aws.neon.tech/neondb",
    "postgres://u:p@ep-test-branch.us-east-2.aws.neon.tech/production",
    "postgres://u:p@PRODUCTION.example.com/neondb",
  ])("refuses a URL that looks like production: %s", (url) => {
    const gate = resolveIntegrationGate({
      INTEGRATION_DATABASE_URL: url,
      INTEGRATION_ALLOW_WRITES: "1",
    });
    expect(gate.mode).toBe("refuse");
  });

  it("runs against a distinct URL with the opt-in", () => {
    expect(
      resolveIntegrationGate({
        INTEGRATION_DATABASE_URL: BRANCH,
        INTEGRATION_ALLOW_WRITES: "1",
        DATABASE_URL: "postgres://u:p@ep-other.neon.tech/neondb",
      }),
    ).toEqual({ mode: "run", url: BRANCH });
  });

  it("never leaks credentials in a refusal reason", () => {
    const gate = resolveIntegrationGate({ INTEGRATION_DATABASE_URL: BRANCH });
    expect(JSON.stringify(gate)).not.toContain("u:p");
  });
});
