import type { ReactElement } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionFor } from "@/app/(dashboard)/review/test-support";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock, formDouble } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  // The page only passes `next` to the form. A double keeps the tree light
  // (the real form pulls in the login action and the data layer).
  formDouble: () => null,
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
// The REAL dal runs on a mocked session source (same pattern as the reports
// page test).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/app/(auth)/login/login-form", () => ({ LoginForm: formDouble }));

type SearchParams = { next?: string | string[] };

let Page: (props: {
  searchParams: Promise<SearchParams>;
}) => Promise<ReactElement<{ next: string }>>;

async function visit(params: SearchParams = {}) {
  return Page({ searchParams: Promise.resolve(params) }) as Promise<
    ReactElement<{ next: string }>
  >;
}

beforeAll(async () => {
  Page = (await import("@/app/(auth)/login/page"))
    .default as unknown as typeof Page;
}, 60_000);

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(null);
});

describe("LoginPage signed-in identity (AEA-1, RNF-01 c)", () => {
  it.each(rolesUsuario)("sends %s to /", async (rol) => {
    getSessionMock.mockResolvedValue(sessionFor(rol));

    await expect(visit()).rejects.toThrow("REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it.each(rolesUsuario)("sends a flagged %s to / too", async (rol) => {
    getSessionMock.mockResolvedValue(sessionFor(rol, true));

    await expect(visit()).rejects.toThrow("REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});

describe("LoginPage anonymous visitor (AEA-1, AEA-3)", () => {
  it("renders the form with no redirect", async () => {
    const el = await visit();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(el.type).toBe(formDouble);
    expect(el.props.next).toBe("/");
  });

  it.each<[string, SearchParams, string]>([
    ["a root path", { next: "/" }, "/"],
    ["a path with a query", { next: "/requests?x=1" }, "/requests?x=1"],
    ["a protocol-relative URL", { next: "//evil.com" }, "/"],
    ["an absolute URL", { next: "https://evil.com" }, "/"],
    ["a missing value", {}, "/"],
    ["a repeated value", { next: ["/a", "/b"] }, "/"],
  ])(
    "passes the target for %s to the form",
    async (_name, params, expected) => {
      const el = await visit(params);

      expect(redirectMock).not.toHaveBeenCalled();
      expect(el.props.next).toBe(expected);
    },
  );

  it("rejects a next target that starts with a backslash (AEA-3)", async () => {
    const el = await visit({ next: "/\\evil.com" });

    expect(el.props.next).toBe("/");
  });
});
