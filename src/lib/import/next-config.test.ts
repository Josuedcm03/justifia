// @vitest-environment node
import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";
import { SERVER_ACTION_BODY_LIMIT } from "./limits";

// The config is loaded by Next outside the `@/` alias, so it imports the caps
// by relative path; this pins that the wiring stays on the decided constant.
describe("next.config.ts (CEI: File guards, design D4/F3)", () => {
  it("raises the Server Actions body limit to exactly the decided number of bytes", () => {
    const bodySizeLimit = nextConfig.experimental?.serverActions?.bodySizeLimit;

    expect(typeof bodySizeLimit).toBe("number");
    expect(bodySizeLimit).toBe(SERVER_ACTION_BODY_LIMIT);
    expect(bodySizeLimit).toBe(5_308_416);
  });

  it("keeps the next-intl plugin applied next to the new setting", () => {
    expect(nextConfig.turbopack?.resolveAlias).toHaveProperty(
      "next-intl/config",
    );
  });
});
