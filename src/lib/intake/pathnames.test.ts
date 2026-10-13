import { describe, expect, it } from "vitest";

import {
  INTAKE_ROOT_PREFIX,
  buildPathname,
  draftPrefix,
  isUnderDraftPrefix,
  solicitudIdOf,
} from "./pathnames";

const UUID = "3f2b8c1e-5d4a-4b7e-9a10-0c6e2f1d7a55";

describe("draftPrefix / buildPathname (design: Limits)", () => {
  it("builds intake/{solicitudId}/ under the root prefix", () => {
    expect(draftPrefix(42)).toBe("intake/42/");
    expect(draftPrefix(42).startsWith(INTAKE_ROOT_PREFIX)).toBe(true);
  });

  it("builds intake/{id}/{uuid}.{ext} and never embeds the original name", () => {
    expect(buildPathname(42, UUID, "pdf")).toBe(`intake/42/${UUID}.pdf`);
    expect(buildPathname(7, UUID, "jpeg")).toBe(`intake/7/${UUID}.jpeg`);
  });
});

describe("isUnderDraftPrefix (ownership check, D3)", () => {
  it("accepts a file directly under the caller's own draft", () => {
    expect(isUnderDraftPrefix(`intake/42/${UUID}.pdf`, 42)).toBe(true);
  });

  it("rejects another draft's prefix, including numeric prefix collisions", () => {
    expect(isUnderDraftPrefix(`intake/43/${UUID}.pdf`, 42)).toBe(false);
    expect(isUnderDraftPrefix(`intake/420/${UUID}.pdf`, 42)).toBe(false);
    expect(isUnderDraftPrefix(`intake/4/${UUID}.pdf`, 42)).toBe(false);
  });

  it("rejects traversal, nesting, and empty file names", () => {
    expect(isUnderDraftPrefix("intake/42/../43/x.pdf", 42)).toBe(false);
    expect(isUnderDraftPrefix("intake/42/sub/x.pdf", 42)).toBe(false);
    expect(isUnderDraftPrefix("intake/42/", 42)).toBe(false);
    expect(isUnderDraftPrefix("intake/42/..", 42)).toBe(false);
  });

  it("rejects paths outside the intake root", () => {
    expect(isUnderDraftPrefix(`other/42/${UUID}.pdf`, 42)).toBe(false);
    expect(isUnderDraftPrefix(`/intake/42/${UUID}.pdf`, 42)).toBe(false);
  });
});

describe("solicitudIdOf (the request a pathname claims)", () => {
  it("reads the id of a pathname under the intake root", () => {
    expect(solicitudIdOf(`intake/42/${UUID}.pdf`)).toBe(42);
    expect(solicitudIdOf(`intake/7/${UUID}.png`)).toBe(7);
  });

  it.each([
    ["outside the intake root", `other/42/${UUID}.pdf`],
    ["a non numeric id", `intake/abc/${UUID}.pdf`],
    ["a zero id", `intake/0/${UUID}.pdf`],
    ["a leading zero", `intake/042/${UUID}.pdf`],
    ["no file name", "intake/42/"],
    ["nesting", `intake/42/sub/${UUID}.pdf`],
    [
      "an id beyond the safe integers",
      `intake/99999999999999999999/${UUID}.pdf`,
    ],
  ])("answers null for %s", (_label, pathname) => {
    expect(solicitudIdOf(pathname)).toBeNull();
  });
});
