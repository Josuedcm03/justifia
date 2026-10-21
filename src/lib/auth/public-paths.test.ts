import { describe, expect, it } from "vitest";

import { isPublicPage } from "./public-paths";

// RC-11, RN-25: the one route served without a session. Only the exact path
// is public, so every other route keeps requiring a session.

describe("isPublicPage", () => {
  it("serves the privacy notice", () => {
    expect(isPublicPage("/privacy")).toBe(true);
  });

  it.each([
    "/privacy/x",
    "/privacy/",
    "/privacy-policy",
    "/Privacy",
    "/requests",
    "/login",
    "/register",
    "/",
    "/denied",
    "/api/privacy",
  ])("keeps %s behind the session rules", (pathname) => {
    expect(isPublicPage(pathname)).toBe(false);
  });
});
