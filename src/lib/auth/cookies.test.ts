// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const jar = vi.hoisted(() => ({
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => jar }));

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { SESSION_COOKIE } from "@/lib/auth/session";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

beforeEach(() => {
  jar.set.mockClear();
  jar.delete.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// FE-32 (UX-22): the cookie lasts as long as the token it carries.
describe("setSessionCookie (FE-32)", () => {
  it("sets a 30-day maxAge for a kept session", async () => {
    await setSessionCookie("token", true);

    expect(jar.set).toHaveBeenCalledTimes(1);
    expect(jar.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "token",
      expect.objectContaining({ maxAge: 30 * DAY }),
    );
  });

  it("sets an 8-hour maxAge by default and when the flag is false", async () => {
    await setSessionCookie("token");
    await setSessionCookie("token", false);

    expect(jar.set).toHaveBeenCalledTimes(2);
    for (const call of jar.set.mock.calls) {
      expect(call[2]).toEqual(expect.objectContaining({ maxAge: 8 * HOUR }));
    }
  });

  it.each([true, false])(
    "keeps the other flags for keep=%s: httpOnly, sameSite lax, path /",
    async (keep) => {
      await setSessionCookie("token", keep);

      expect(jar.set.mock.calls[0][2]).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: keep ? 30 * DAY : 8 * HOUR,
      });
    },
  );

  it("is secure in production, for both durations", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await setSessionCookie("token", true);
    await setSessionCookie("token", false);

    for (const call of jar.set.mock.calls) {
      expect(call[2]).toEqual(expect.objectContaining({ secure: true }));
    }
  });
});

describe("clearSessionCookie (FE-32)", () => {
  it("deletes the session cookie", async () => {
    await clearSessionCookie();

    expect(jar.delete).toHaveBeenCalledTimes(1);
    expect(jar.delete).toHaveBeenCalledWith(SESSION_COOKIE);
    expect(jar.set).not.toHaveBeenCalled();
  });
});
