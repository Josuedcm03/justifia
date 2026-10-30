// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtractionDeps } from "../run";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  after: vi.fn(),
  processRequestExtractions: vi.fn(),
}));

vi.mock("next/server", () => ({ after: h.after }));
vi.mock("../run", () => ({
  processRequestExtractions: h.processRequestExtractions,
}));

import { createAfterQueue } from "./after-queue";

const DEPS = { tag: "deps" } as unknown as ExtractionDeps;
const STARTED_AT = new Date("2026-10-07T15:00:00.000Z");

/** The callbacks handed to `after`, in order. */
function scheduled(): (() => Promise<void>)[] {
  return h.after.mock.calls.map(([callback]) => callback);
}

let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  h.after.mockReset();
  h.processRequestExtractions.mockReset();
  h.processRequestExtractions.mockResolvedValue({ processed: 1, errored: 0 });
  error = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("createAfterQueue: scheduling (DE-5, N1)", () => {
  it("registers exactly one callback per hand-off and runs nothing yet", () => {
    const queue = createAfterQueue(DEPS);

    queue.enqueue(31, STARTED_AT);

    expect(h.after).toHaveBeenCalledTimes(1);
    expect(h.processRequestExtractions).not.toHaveBeenCalled();
  });

  it("registers one callback for each request handed over", () => {
    const queue = createAfterQueue(DEPS);

    queue.enqueue(31, STARTED_AT);
    queue.enqueue(32, STARTED_AT);

    expect(h.after).toHaveBeenCalledTimes(2);
  });

  it("the callback processes that request with the action's clock start", async () => {
    createAfterQueue(DEPS).enqueue(31, STARTED_AT);

    await scheduled()[0]();

    expect(h.processRequestExtractions).toHaveBeenCalledTimes(1);
    expect(h.processRequestExtractions).toHaveBeenCalledWith(31, DEPS, {
      startedAt: STARTED_AT,
    });
  });

  it("each callback keeps the request and the clock start it was handed", async () => {
    const queue = createAfterQueue(DEPS);
    const later = new Date("2026-10-08T09:30:00.000Z");
    queue.enqueue(31, STARTED_AT);
    queue.enqueue(44, later);

    await scheduled()[1]();
    await scheduled()[0]();

    expect(h.processRequestExtractions.mock.calls).toEqual([
      [44, DEPS, { startedAt: later }],
      [31, DEPS, { startedAt: STARTED_AT }],
    ]);
  });
});

describe("createAfterQueue: hand-off failure is swallowed (DE-5)", () => {
  it("logs a failing schedule by error name and does not rethrow", () => {
    h.after.mockImplementation(() => {
      throw new TypeError("secret detail: postgres://u:p@host/db");
    });

    expect(() => createAfterQueue(DEPS).enqueue(31, STARTED_AT)).not.toThrow();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("extraction_not_scheduled", {
      solicitudId: 31,
      code: "TypeError",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret");
  });

  it("names a thrown non-error as unknown", () => {
    h.after.mockImplementation(() => {
      throw "boom";
    });

    createAfterQueue(DEPS).enqueue(31, STARTED_AT);

    expect(error).toHaveBeenCalledWith("extraction_not_scheduled", {
      solicitudId: 31,
      code: "unknown",
    });
  });

  it("logs a failing callback by error name and does not rethrow", async () => {
    h.processRequestExtractions.mockRejectedValue(
      new RangeError("secret detail: constancia de Ana Perez"),
    );
    createAfterQueue(DEPS).enqueue(31, STARTED_AT);

    await expect(scheduled()[0]()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("extraction_run_failed", {
      solicitudId: 31,
      code: "RangeError",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(error.mock.calls)).not.toContain("Ana");
  });

  it("logs nothing when the callback succeeds", async () => {
    createAfterQueue(DEPS).enqueue(31, STARTED_AT);

    await scheduled()[0]();

    expect(error).not.toHaveBeenCalled();
  });

  it("a schedule that works logs nothing", () => {
    createAfterQueue(DEPS).enqueue(31, STARTED_AT);

    expect(error).not.toHaveBeenCalled();
  });
});
