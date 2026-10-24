import { describe, expect, it } from "vitest";

import {
  toExtractionDisplay,
  type ExtractionDisplayContext,
  type ExtractionRowView,
} from "./display";

const EMPTY_DATA: Omit<ExtractionRowView, "state"> = {
  studentName: null,
  issuer: null,
  issueDate: null,
  restFrom: null,
  restTo: null,
  restDays: null,
};

function row(
  state: ExtractionRowView["state"],
  data: Partial<Omit<ExtractionRowView, "state">> = {},
): ExtractionRowView {
  return { state, ...EMPTY_DATA, ...data };
}

const PENDING_CONFIGURED: ExtractionDisplayContext = {
  requestState: "pendiente",
  configured: true,
};

describe("completada rows show the recognized data", () => {
  it("returns every field with its value and a rest range with days (scenario: Full data shown)", () => {
    const display = toExtractionDisplay(
      row("completada", {
        studentName: "Ana Lucía Pérez",
        issuer: "Clínica Sur",
        issueDate: "2026-07-25",
        restFrom: "2026-07-20",
        restTo: "2026-07-24",
        restDays: 5,
      }),
      PENDING_CONFIGURED,
    );

    expect(display).toEqual({
      kind: "data",
      studentName: { recognized: true, value: "Ana Lucía Pérez" },
      issuer: { recognized: true, value: "Clínica Sur" },
      issueDate: { recognized: true, value: "2026-07-25" },
      rest: { recognized: true, days: 5, from: "2026-07-20", to: "2026-07-24" },
    });
  });

  it("marks a field without value as not recognized (scenario: Unrecognized field)", () => {
    const display = toExtractionDisplay(
      row("completada", { issuer: "Clínica Sur" }),
      PENDING_CONFIGURED,
    );

    expect(display).toEqual({
      kind: "data",
      studentName: { recognized: false },
      issuer: { recognized: true, value: "Clínica Sur" },
      issueDate: { recognized: false },
      rest: { recognized: false },
    });
  });

  it("returns days alone, with no dates, when the document gave none (scenario: Days only)", () => {
    const display = toExtractionDisplay(
      row("completada", { restDays: 3 }),
      PENDING_CONFIGURED,
    );

    expect(display).toMatchObject({
      kind: "data",
      rest: { recognized: true, days: 3, from: null, to: null },
    });
  });

  it("is data even when every field is empty (scenario: Empty answer completes)", () => {
    expect(toExtractionDisplay(row("completada"), PENDING_CONFIGURED)).toEqual({
      kind: "data",
      studentName: { recognized: false },
      issuer: { recognized: false },
      issueDate: { recognized: false },
      rest: { recognized: false },
    });
  });

  it.each([
    ["aprobada", true],
    ["devuelta", true],
    ["pendiente", false],
    ["aprobada", false],
  ] as const)(
    "is still shown for a %s request when configured=%s",
    (requestState, configured) => {
      const display = toExtractionDisplay(
        row("completada", { issuer: "Clínica Sur" }),
        { requestState, configured },
      );

      expect(display.kind).toBe("data");
    },
  );
});

describe("states without data", () => {
  it.each([
    ["pendiente row", row("pendiente")],
    ["procesando row", row("procesando")],
    ["no row yet", null],
  ])("a %s on a pending request reads extracting", (_label, value) => {
    expect(toExtractionDisplay(value, PENDING_CONFIGURED)).toEqual({
      kind: "extracting",
    });
  });

  it("a fallida row reads unavailable (scenario: Permanently failed)", () => {
    expect(toExtractionDisplay(row("fallida"), PENDING_CONFIGURED)).toEqual({
      kind: "unavailable",
    });
  });

  it.each([
    ["pendiente row", row("pendiente")],
    ["procesando row", row("procesando")],
    ["no row yet", null],
  ])(
    "a %s reads the configuration state when extraction is not configured (scenario: Not configured)",
    (_label, value) => {
      expect(
        toExtractionDisplay(value, {
          requestState: "pendiente",
          configured: false,
        }),
      ).toEqual({ kind: "notConfigured" });
    },
  );
});

describe("a request that is no longer pending never shows extracting (scenario: Decided request never extracting)", () => {
  it.each([
    "aprobada",
    "devuelta",
    "rechazada",
    "en_revision_coordinacion",
  ] as const)(
    "%s request: pendiente, procesando and missing rows are unavailable",
    (requestState) => {
      for (const value of [row("pendiente"), row("procesando"), null]) {
        expect(
          toExtractionDisplay(value, { requestState, configured: true }),
        ).toEqual({ kind: "unavailable" });
      }
    },
  );

  it("beats the configuration state: a decided request is unavailable, not unconfigured", () => {
    expect(
      toExtractionDisplay(row("pendiente"), {
        requestState: "aprobada",
        configured: false,
      }),
    ).toEqual({ kind: "unavailable" });
  });
});

describe("precedence: completada > request not pending > fallida > not configured > extracting", () => {
  it("a fallida row stays unavailable while extraction is not configured", () => {
    expect(
      toExtractionDisplay(row("fallida"), {
        requestState: "pendiente",
        configured: false,
      }),
    ).toEqual({ kind: "unavailable" });
  });

  it("a fallida row on a decided request is unavailable", () => {
    expect(
      toExtractionDisplay(row("fallida"), {
        requestState: "aprobada",
        configured: true,
      }),
    ).toEqual({ kind: "unavailable" });
  });

  it("not configured only wins over extracting", () => {
    const waiting = row("pendiente");

    expect(
      toExtractionDisplay(waiting, {
        requestState: "pendiente",
        configured: true,
      }).kind,
    ).toBe("extracting");
    expect(
      toExtractionDisplay(waiting, {
        requestState: "pendiente",
        configured: false,
      }).kind,
    ).toBe("notConfigured");
  });
});

describe("the display model leaks nothing raw", () => {
  it("carries no error code even when the input row has one", () => {
    const failed = { ...row("fallida"), errorCode: "model_error" };
    const display = toExtractionDisplay(failed, PENDING_CONFIGURED);

    expect(display).toEqual({ kind: "unavailable" });
    expect(JSON.stringify(display)).not.toContain("model_error");
  });
});
