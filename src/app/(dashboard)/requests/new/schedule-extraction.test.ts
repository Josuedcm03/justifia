// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Runtime harness of the producers' hand-off (DE-5): the shared helper, the
// real composition root and the real `after()` queue run together; only the
// edges are replaced (Next's `after`, the use case, the store, the native
// adapters and the environment).

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  after: vi.fn(),
  processRequestExtractions: vi.fn(),
  getIntakeDeps: vi.fn(),
  createPreparer: vi.fn(),
  createExtractor: vi.fn(),
}));

vi.mock("next/server", () => ({ after: h.after }));
vi.mock("@/lib/extraction/run", () => ({
  processRequestExtractions: h.processRequestExtractions,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: h.getIntakeDeps }));
vi.mock("@/lib/extraction/adapters/sharp-unpdf-preparer", () => ({
  createSharpUnpdfPreparer: h.createPreparer,
}));
vi.mock("@/lib/extraction/adapters/nuextract-http-extractor", () => ({
  createNuExtractHttpExtractor: h.createExtractor,
}));
vi.mock("@/env", () => ({ env: {} }));

import { scheduleExtraction } from "./step-actions";

const STARTED_AT = new Date("2026-10-07T15:00:00.000Z");
const store = { tag: "store" };
const preparer = { tag: "preparer" };
const extractor = { tag: "extractor" };

let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const mock of Object.values(h)) mock.mockReset();
  h.getIntakeDeps.mockReturnValue({ store });
  h.createPreparer.mockReturnValue(preparer);
  h.createExtractor.mockReturnValue(extractor);
  h.processRequestExtractions.mockResolvedValue({ processed: 1, errored: 0 });
  error = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("scheduleExtraction (shared by both producers)", () => {
  it("registers one after() callback and runs nothing before the response", async () => {
    await scheduleExtraction(31, STARTED_AT);

    expect(h.after).toHaveBeenCalledTimes(1);
    expect(h.processRequestExtractions).not.toHaveBeenCalled();
  });

  it("the callback processes that request on the wired ports with the action's clock", async () => {
    await scheduleExtraction(31, STARTED_AT);

    await h.after.mock.calls[0][0]();

    expect(h.processRequestExtractions).toHaveBeenCalledTimes(1);
    const [id, deps, options] = h.processRequestExtractions.mock.calls[0];
    expect(id).toBe(31);
    expect(options).toEqual({ startedAt: STARTED_AT });
    expect(deps.store).toBe(store);
    expect(deps.preparer).toBe(preparer);
    expect(deps.extractor).toBe(extractor);
  });

  it("a request handed over later is a separate callback with its own clock", async () => {
    const later = new Date("2026-10-08T09:30:00.000Z");
    await scheduleExtraction(31, STARTED_AT);
    await scheduleExtraction(44, later);

    await h.after.mock.calls[1][0]();

    expect(h.after).toHaveBeenCalledTimes(2);
    expect(h.processRequestExtractions.mock.calls[0][0]).toBe(44);
    expect(h.processRequestExtractions.mock.calls[0][2]).toEqual({
      startedAt: later,
    });
  });

  it("outside a request scope after() throws: logged by name, never rethrown", async () => {
    h.after.mockImplementation(() => {
      throw new Error("after was called outside a request scope");
    });

    await expect(scheduleExtraction(31, STARTED_AT)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith("extraction_not_scheduled", {
      solicitudId: 31,
      code: "Error",
    });
  });

  it("a store that cannot be built is swallowed too", async () => {
    h.getIntakeDeps.mockImplementation(() => {
      throw new TypeError("BLOB_READ_WRITE_TOKEN is not configured.");
    });

    await expect(scheduleExtraction(31, STARTED_AT)).resolves.toBeUndefined();

    expect(h.after).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("extraction_not_scheduled", {
      solicitudId: 31,
      code: "TypeError",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("BLOB");
  });

  it("a failing run inside the callback is logged by name and never escapes", async () => {
    h.processRequestExtractions.mockRejectedValue(new RangeError("db down"));
    await scheduleExtraction(31, STARTED_AT);

    await expect(h.after.mock.calls[0][0]()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith("extraction_run_failed", {
      solicitudId: 31,
      code: "RangeError",
    });
  });
});
