// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { envValues, heavyLoaded } = vi.hoisted(() => ({
  envValues: {} as Record<string, string | undefined>,
  heavyLoaded: [] as string[],
}));
vi.mock("@/env", () => ({ env: envValues }));

// The review page asks `isExtractionConfigured()`: it must not drag the native
// addons of the preparer into that page. Each heavy module records its load.
vi.mock("sharp", () => {
  heavyLoaded.push("sharp");
  return { default: vi.fn() };
});
vi.mock("unpdf", () => {
  heavyLoaded.push("unpdf");
  return {};
});
vi.mock("@napi-rs/canvas", () => {
  heavyLoaded.push("@napi-rs/canvas");
  return {};
});

import { extractionEnv, isExtractionConfigured } from "./configured";

function setEnv(values: Record<string, string | undefined>) {
  for (const key of Object.keys(envValues)) delete envValues[key];
  Object.assign(envValues, values);
}

describe("isExtractionConfigured (DE-4, DE-12)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["an https address", { EXTRACTION_API_URL: "https://model.example.test" }],
    [
      "a loopback http address",
      { EXTRACTION_API_URL: "http://localhost:8080" },
    ],
    [
      "an address with a key",
      {
        EXTRACTION_API_URL: "https://model.example.test",
        EXTRACTION_API_KEY: "k".repeat(16),
      },
    ],
  ])("is true with %s", (_label, values) => {
    setEnv(values);

    expect(isExtractionConfigured()).toBe(true);
  });

  it.each([
    ["no address", {}],
    ["a key but no address", { EXTRACTION_API_KEY: "k".repeat(16) }],
    [
      "plain http to a remote host",
      { EXTRACTION_API_URL: "http://example.com" },
    ],
  ])("is false with %s", (_label, values) => {
    setEnv(values);

    expect(isExtractionConfigured()).toBe(false);
  });

  it("reads the environment each time it is asked", () => {
    setEnv({});
    expect(isExtractionConfigured()).toBe(false);

    setEnv({ EXTRACTION_API_URL: "https://model.example.test" });
    expect(isExtractionConfigured()).toBe(true);
  });

  it("exposes exactly the two extraction variables, nothing else from env", () => {
    setEnv({
      EXTRACTION_API_URL: "https://model.example.test",
      EXTRACTION_API_KEY: "k".repeat(16),
      DATABASE_URL: "postgres://secret",
    });

    expect(extractionEnv()).toEqual({
      EXTRACTION_API_URL: "https://model.example.test",
      EXTRACTION_API_KEY: "k".repeat(16),
    });
  });

  it("loads neither sharp, unpdf nor the canvas addon", () => {
    setEnv({ EXTRACTION_API_URL: "https://model.example.test" });

    isExtractionConfigured();

    expect(heavyLoaded).toEqual([]);
  });
});
