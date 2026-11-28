// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PARAMETERS } from "@/lib/parameters/registry";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  saveDraftDetails: vi.fn(),
  finalizeDocument: vi.fn(),
  getIntakeDeps: vi.fn(),
  getNormativeParameters: vi.fn(),
}));

vi.mock("@/lib/data/solicitudes", () => ({
  getLiveDraft: vi.fn(),
  saveDraftDetails: h.saveDraftDetails,
  saveDraftSubjects: vi.fn(),
}));
vi.mock("@/lib/data/documentos", () => ({
  finalizeDocument: h.finalizeDocument,
  removeDocument: vi.fn(),
}));
vi.mock("@/lib/data/enrollment", () => ({ listEligibleGroups: vi.fn() }));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: h.getIntakeDeps }));
// The loader is the only source of the filing window (NP-4, A11).
vi.mock("@/lib/parameters/loader", () => ({
  getNormativeParameters: h.getNormativeParameters,
}));

import { finalize, saveDetails } from "./step-actions";

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

/** The loader result when `inactive` causes are deactivated (NP-11). */
const causesRead = (...inactive: string[]) => ({
  values: {
    ...DEFAULT_PARAMETERS,
    causes: DEFAULT_PARAMETERS.causes.map((c) => ({
      ...c,
      activa: !inactive.includes(c.codigo),
    })),
  },
  fallback: [],
  degraded: false,
});

/** The loader result when the maximum size is in force at `mib`. */
const sizeRead = (mib: number) => ({
  values: { ...DEFAULT_PARAMETERS, maxDocumentMib: mib },
  fallback: [],
  degraded: false,
});

const STORE = { name: "store" };
const FILE = { pathname: "intake/4/x.png", nombreOriginal: "foto.png" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.finalizeDocument
    .mockReset()
    .mockResolvedValue({ ok: true, documentId: 12 });
  h.getIntakeDeps.mockReset().mockReturnValue({ store: STORE });
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

describe("saveDetails reads the active causes from the loader (NP-11, JI-CAUSE)", () => {
  const CAUSE_ERROR = {
    ok: false,
    errors: [{ field: "causa", key: "intake.errors.causa_inactive" }],
  };

  it("refuses a deactivated cause on the cause field and saves nothing", async () => {
    h.getNormativeParameters.mockResolvedValue(causesRead("medica"));

    expect(await saveDetails(USER, DRAFT, twentyDaysOld)).toEqual(CAUSE_ERROR);

    expect(h.saveDraftDetails).not.toHaveBeenCalled();
  });

  it("accepts the same cause once it is active again", async () => {
    h.getNormativeParameters.mockResolvedValue(causesRead("medica"));
    await saveDetails(USER, DRAFT, twentyDaysOld);

    h.getNormativeParameters.mockResolvedValue(causesRead());

    expect(await saveDetails(USER, DRAFT, twentyDaysOld)).toEqual({ ok: true });
  });

  it("accepts any of the five in a correction (A14)", async () => {
    h.getNormativeParameters.mockResolvedValue(causesRead("medica"));

    expect(await saveDetails(USER, CORRECTION, twentyDaysOld)).toEqual({
      ok: true,
    });

    expect(h.saveDraftDetails).toHaveBeenCalledTimes(1);
  });
});

describe("finalize hands the data layer the maximum size in force (SD-FINALIZE, NP-13)", () => {
  it.each([
    [1, 1_048_576],
    [5, 5_242_880],
    [10, 10_485_760],
  ] as const)(
    "a maximum of %i MiB reaches finalizeDocument as %i bytes",
    async (mib, bytes) => {
      h.getNormativeParameters.mockResolvedValue(sizeRead(mib));

      expect(await finalize(USER, DRAFT, FILE)).toEqual({
        ok: true,
        documentId: 12,
      });

      expect(h.finalizeDocument).toHaveBeenCalledWith(
        { userId: USER, ...FILE, target: DRAFT, maxBytes: bytes },
        STORE,
      );
    },
  );

  it("reads the limit again for the next finalize, and for a correction too", async () => {
    h.getNormativeParameters.mockResolvedValue(sizeRead(10));
    await finalize(USER, DRAFT, FILE);
    h.getNormativeParameters.mockResolvedValue(sizeRead(5));
    await finalize(USER, CORRECTION, FILE);

    expect(h.finalizeDocument.mock.calls.map(([arg]) => arg.maxBytes)).toEqual([
      10_485_760, 5_242_880,
    ]);
  });

  it("reads nothing and finalizes nothing for a malformed payload", async () => {
    expect(await finalize(USER, DRAFT, { pathname: "" })).toEqual({
      ok: false,
      errors: [{ field: "form", key: "intake.errors.invalid_input" }],
    });

    expect(h.getNormativeParameters).not.toHaveBeenCalled();
    expect(h.finalizeDocument).not.toHaveBeenCalled();
  });
});
