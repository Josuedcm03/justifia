// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  intakeDeps: vi.fn(),
  createPreparer: vi.fn(),
  createExtractor: vi.fn(),
  envValues: {} as Record<string, string | undefined>,
}));

vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: mocks.intakeDeps }));
vi.mock("./adapters/sharp-unpdf-preparer", () => ({
  createSharpUnpdfPreparer: mocks.createPreparer,
}));
vi.mock("./adapters/nuextract-http-extractor", () => ({
  createNuExtractHttpExtractor: mocks.createExtractor,
}));
vi.mock("@/env", () => ({ env: mocks.envValues }));

import { getExtractionDeps } from "./deps";

describe("getExtractionDeps (composition root, DE-1)", () => {
  const store = { tag: "blob-store" };
  const preparer = { tag: "preparer" };
  const extractor = { tag: "extractor" };

  beforeEach(() => {
    vi.resetAllMocks();
    for (const key of Object.keys(mocks.envValues)) {
      delete mocks.envValues[key];
    }
    mocks.intakeDeps.mockReturnValue({ store, schedule: {}, mail: {} });
    mocks.createPreparer.mockReturnValue(preparer);
    mocks.createExtractor.mockReturnValue(extractor);
  });

  it("wires the intake document store, the preparer and the extractor", () => {
    const deps = getExtractionDeps();

    expect(deps.store).toBe(store);
    expect(deps.preparer).toBe(preparer);
    expect(deps.extractor).toBe(extractor);
  });

  it("reuses the intake store instead of building a second one", () => {
    getExtractionDeps();

    expect(mocks.intakeDeps).toHaveBeenCalledTimes(1);
  });

  it("does not wire a queue yet (it joins in S5b, once after-queue exists)", () => {
    expect(Object.keys(getExtractionDeps()).sort()).toEqual([
      "extractor",
      "preparer",
      "store",
    ]);
  });

  it("hands the extractor the extraction variables, read when it asks", () => {
    getExtractionDeps();
    const options = mocks.createExtractor.mock.calls[0][0] as {
      env: () => Record<string, string | undefined>;
    };

    expect(options.env()).toEqual({
      EXTRACTION_API_URL: undefined,
      EXTRACTION_API_KEY: undefined,
    });
    mocks.envValues.EXTRACTION_API_URL = "https://model.example.test";
    expect(options.env()).toEqual({
      EXTRACTION_API_URL: "https://model.example.test",
      EXTRACTION_API_KEY: undefined,
    });
  });

  it("builds with the model server unset: configuration is judged at use", () => {
    expect(() => getExtractionDeps()).not.toThrow();
    expect(mocks.createExtractor).toHaveBeenCalledTimes(1);
  });

  it("propagates a store that cannot be built instead of degrading", () => {
    mocks.intakeDeps.mockImplementation(() => {
      throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
    });

    expect(() => getExtractionDeps()).toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
