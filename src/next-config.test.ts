// @vitest-environment node
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

// DE-12: the PDF renderer loads a native addon at runtime, so Next must leave
// it out of the server bundle. `sharp` is on Next's own list of auto-external
// packages, so listing it here would be noise that hides a real omission.
describe("next.config.ts (document-extraction, DE-12)", () => {
  it("keeps the native canvas addon out of the server bundle", () => {
    expect(nextConfig.serverExternalPackages).toContain("@napi-rs/canvas");
  });

  it("does not list sharp, which Next already externalizes", () => {
    expect(nextConfig.serverExternalPackages).not.toContain("sharp");
  });

  it("lists exactly the packages this change needs", () => {
    expect(nextConfig.serverExternalPackages).toEqual(["@napi-rs/canvas"]);
  });
});
