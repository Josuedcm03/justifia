// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PARAMETERS } from "@/lib/parameters/registry";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  saveDraftDetails: vi.fn(),
  getNormativeParameters: vi.fn(),
}));

vi.mock("@/lib/data/solicitudes", () => ({
  getLiveDraft: vi.fn(),
  saveDraftDetails: h.saveDraftDetails,
  saveDraftSubjects: vi.fn(),
}));
vi.mock("@/lib/data/documentos", () => ({
  finalizeDocument: vi.fn(),
  removeDocument: vi.fn(),
}));
vi.mock("@/lib/data/enrollment", () => ({ listEligibleGroups: vi.fn() }));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: vi.fn() }));
// The loader is the only source of the filing window (NP-4, A11).
vi.mock("@/lib/parameters/loader", () => ({
  getNormativeParameters: h.getNormativeParameters,
}));

import { saveDetails } from "./step-actions";

const USER = 7;
// 2026-10-07 09:00 in Managua (UTC-6); 20 days earlier is 2026-09-17.
const NOW = new Date("2026-10-07T15:00:00.000Z");
const DRAFT = { kind: "draft" } as const;
const CORRECTION = { kind: "correction", solicitudId: 31 } as const;
const TOO_OLD = {
  ok: false,
  errors: [{ field: "fechaFin", key: "intake.errors.end_too_old" }],
};

/** The loader result when the filing window is in force at `days`. */
const windowRead = (days: number) => ({
  values: { ...DEFAULT_PARAMETERS, filingWindowDays: days },
  fallback: [],
  degraded: false,
});

const twentyDaysOld = {
  causa: "medica",
  fechaInicio: "2026-09-15",
  fechaFin: "2026-09-17",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.saveDraftDetails.mockReset().mockResolvedValue(true);
  h.getNormativeParameters.mockReset().mockResolvedValue(windowRead(30));
});

describe("saveDetails reads the filing window from the loader (RN-23, JI-CAUSE)", () => {
  it("refuses an end date 20 days old when the window is 10, and saves nothing", async () => {
    h.getNormativeParameters.mockResolvedValue(windowRead(10));

    expect(await saveDetails(USER, DRAFT, twentyDaysOld)).toEqual(TOO_OLD);

    expect(h.saveDraftDetails).not.toHaveBeenCalled();
  });

  it("accepts the same end date when the window is 30", async () => {
    expect(await saveDetails(USER, DRAFT, twentyDaysOld)).toEqual({ ok: true });

    expect(h.saveDraftDetails).toHaveBeenCalledTimes(1);
  });

  it("applies a change to the next save: accepted under 30, refused under 10", async () => {
    expect(await saveDetails(USER, DRAFT, twentyDaysOld)).toEqual({ ok: true });

    h.getNormativeParameters.mockResolvedValue(windowRead(10));

    expect(await saveDetails(USER, DRAFT, twentyDaysOld)).toEqual(TOO_OLD);
  });

  it("reads the loader once per save", async () => {
    await saveDetails(USER, DRAFT, twentyDaysOld);

    expect(h.getNormativeParameters).toHaveBeenCalledTimes(1);
  });

  it("never applies the window to a correction (NP-13)", async () => {
    h.getNormativeParameters.mockResolvedValue(windowRead(10));

    expect(await saveDetails(USER, CORRECTION, twentyDaysOld)).toEqual({
      ok: true,
    });

    expect(h.saveDraftDetails).toHaveBeenCalledTimes(1);
  });
});
