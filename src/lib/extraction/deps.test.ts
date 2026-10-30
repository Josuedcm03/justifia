// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  intakeDeps: vi.fn(),
  createPreparer: vi.fn(),
  createExtractor: vi.fn(),
  createQueue: vi.fn(),
  envValues: {} as Record<string, string | undefined>,
}));

vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: mocks.intakeDeps }));
vi.mock("./adapters/after-queue", () => ({
  createAfterQueue: mocks.createQueue,
}));
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
  const queue = { tag: "queue" };

  beforeEach(() => {
    vi.resetAllMocks();
    for (const key of Object.keys(mocks.envValues)) {
      delete mocks.envValues[key];
    }
    mocks.intakeDeps.mockReturnValue({ store, schedule: {}, mail: {} });
    mocks.createPreparer.mockReturnValue(preparer);
    mocks.createExtractor.mockReturnValue(extractor);
    mocks.createQueue.mockReturnValue(queue);
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

  it("wires the after() queue beside the three ports (S5b)", () => {
    const deps = getExtractionDeps();

    expect(deps.queue).toBe(queue);
    expect(Object.keys(deps).sort()).toEqual([
      "extractor",
      "preparer",
      "queue",
      "store",
    ]);
  });

  it("the queue runs the same store, preparer and extractor, without a queue of its own", () => {
    getExtractionDeps();

    expect(mocks.createQueue).toHaveBeenCalledTimes(1);
    const handed = mocks.createQueue.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(handed.store).toBe(store);
    expect(handed.preparer).toBe(preparer);
    expect(handed.extractor).toBe(extractor);
    expect("queue" in handed).toBe(false);
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
