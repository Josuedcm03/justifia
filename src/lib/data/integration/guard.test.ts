import { describe, expect, it } from "vitest";

import {
  isProductionEndpoint,
  resolveIntegrationGate,
} from "@/lib/data/integration/guard";

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

  describe("the production Neon endpoint", () => {
    const OPTED_IN = { INTEGRATION_ALLOW_WRITES: "1" } as const;

    it.each([
      "postgres://u:p@ep-orange-math-a1b2c3.us-east-2.aws.neon.tech/neondb",
      "postgresql://u:p@ep-orange-math-a1b2c3-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
      "postgres://u:p@EP-ORANGE-MATH-a1b2c3.us-east-2.aws.neon.tech/neondb",
      "postgres://u:p@ep-orange-math.example.com:5432/scratch",
    ])("refuses the endpoint id in the host: %s", (url) => {
      const gate = resolveIntegrationGate({
        ...OPTED_IN,
        INTEGRATION_DATABASE_URL: url,
        DATABASE_URL: "postgres://u:p@ep-other.neon.tech/neondb",
      });

      expect(gate.mode).toBe("refuse");
    });

    it("refuses it even when every other check passes", () => {
      // Not the application URL, no "prod" in the host or the database name.
      const gate = resolveIntegrationGate({
        ...OPTED_IN,
        INTEGRATION_DATABASE_URL:
          "postgres://u:p@ep-orange-math-x1.us-east-2.aws.neon.tech/scratch",
        DATABASE_URL: BRANCH,
        INTEGRATION_FORBIDDEN_URL: BRANCH,
      });

      expect(gate.mode).toBe("refuse");
      expect(JSON.stringify(gate)).not.toContain("u:p");
      expect(JSON.stringify(gate)).not.toContain("ep-orange-math-x1");
    });

    it("does not refuse a branch that only mentions it outside the host", () => {
      const gate = resolveIntegrationGate({
        ...OPTED_IN,
        INTEGRATION_DATABASE_URL:
          "postgres://ep-orange-math:ep-orange-math@ep-test-branch.us-east-2.aws.neon.tech/neondb",
      });

      expect(gate.mode).toBe("run");
    });

    it.each([
      [
        "a pooled production host",
        "postgres://u:p@ep-orange-math-p.neon.tech/x",
        true,
      ],
      ["a disposable branch", BRANCH, false],
      ["an unparsable value that names it", "ep-orange-math not a url", true],
      ["an unparsable value that does not", "not a url", false],
      ["an unset value", undefined, false],
    ])("isProductionEndpoint: %s", (_name, url, expected) => {
      expect(isProductionEndpoint(url)).toBe(expected);
    });
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
