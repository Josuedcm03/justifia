import { describe, expect, it } from "vitest";

import type { ExtractionRowView } from "@/lib/extraction/display";

import { datumOrigin, toEffectiveRow } from "./effective";
import type { ManualFields } from "./types";

const EMPTY_ROW: Omit<ExtractionRowView, "state"> = {
  studentName: null,
  issuer: null,
  issueDate: null,
  restFrom: null,
  restTo: null,
  restDays: null,
};

function ocr(
  state: ExtractionRowView["state"],
  data: Partial<Omit<ExtractionRowView, "state">> = {},
): ExtractionRowView {
  return { state, ...EMPTY_ROW, ...data };
}

function manual(values: Partial<ManualFields> = {}): ManualFields {
  return {
    studentName: null,
    issuer: null,
    issueDate: null,
    restFrom: null,
    restTo: null,
    ...values,
  };
}

const COMPLETED = ocr("completada", {
  studentName: "Ana Perez",
  issuer: "Clinica Central",
  issueDate: "2026-11-02",
  restFrom: "2026-11-01",
  restTo: "2026-11-10",
  restDays: 10,
});

describe("toEffectiveRow: field-by-field precedence (MD-21, RN-24)", () => {
  const table: [string, string | null, string | null, string | null][] = [
    ["extracted only", "A", null, "A"],
    ["manual over extracted", "A", "B", "B"],
    ["manual only", null, "B", "B"],
    ["neither", null, null, null],
  ];

  it.each(table)("issuer, %s", (_label, extracted, entered, expected) => {
    const row = toEffectiveRow(
      ocr("completada", { issuer: extracted }),
      manual({ issuer: entered }),
    );

    expect(row?.issuer ?? null).toBe(expected);
  });

  it("resolves the four data independently", () => {
    const row = toEffectiveRow(
      COMPLETED,
      manual({ issuer: "Hospital Nuevo", issueDate: "2026-11-09" }),
    );

    expect(row).toEqual({
      ...COMPLETED,
      issuer: "Hospital Nuevo",
      issueDate: "2026-11-09",
    });
  });

  it("returns the extraction row unchanged when there is no manual row", () => {
    expect(toEffectiveRow(COMPLETED, null)).toBe(COMPLETED);
    const failed = ocr("fallida");
    expect(toEffectiveRow(failed, null)).toBe(failed);
    expect(toEffectiveRow(null, null)).toBeNull();
  });

  it("does not promote on the type or marks alone: no value among the four data is no manual row", () => {
    const failed = ocr("fallida");

    expect(toEffectiveRow(failed, manual())).toBe(failed);
    expect(toEffectiveRow(null, manual())).toBeNull();
  });
});

describe("toEffectiveRow: promotion to completada (MD-21, RF-14 c, D9, A4)", () => {
  const states: [string, ExtractionRowView | null][] = [
    ["fallida", ocr("fallida")],
    ["pendiente", ocr("pendiente")],
    ["procesando", ocr("procesando")],
    ["absent", null],
  ];

  it.each(states)(
    "a manual issue date over a %s row gives completada with the other three data empty",
    (_label, row) => {
      expect(toEffectiveRow(row, manual({ issueDate: "2026-11-09" }))).toEqual({
        state: "completada",
        studentName: null,
        issuer: null,
        issueDate: "2026-11-09",
        restFrom: null,
        restTo: null,
        restDays: null,
      });
    },
  );

  it("does not borrow values from an extraction that did not complete", () => {
    const stale = ocr("pendiente", { issuer: "Should not leak" });

    expect(
      toEffectiveRow(stale, manual({ issueDate: "2026-11-09" }))?.issuer,
    ).toBeNull();
  });

  it("keeps the extracted values of a completada row next to a manual one", () => {
    const row = toEffectiveRow(COMPLETED, manual({ studentName: "Ana P." }));

    expect(row).toEqual({ ...COMPLETED, studentName: "Ana P." });
  });
});

describe("toEffectiveRow: the rest period is one unit (MD-21)", () => {
  const MANUAL_REST = manual({
    restFrom: "2026-11-09",
    restTo: "2026-11-09",
  });

  it("a manual rest over an extracted rest gives the manual dates with 1 day", () => {
    const row = toEffectiveRow(COMPLETED, MANUAL_REST);

    expect(row).toMatchObject({
      state: "completada",
      restFrom: "2026-11-09",
      restTo: "2026-11-09",
      restDays: 1,
    });
    expect(row?.issuer).toBe("Clinica Central");
  });

  it("mixes nothing over an extracted rest that has only a day count", () => {
    const daysOnly = ocr("completada", { restDays: 7 });

    expect(toEffectiveRow(daysOnly, MANUAL_REST)).toMatchObject({
      restFrom: "2026-11-09",
      restTo: "2026-11-09",
      restDays: 1,
    });
  });

  it("derives the days of a longer manual rest in code", () => {
    const row = toEffectiveRow(
      null,
      manual({ restFrom: "2028-02-28", restTo: "2028-03-01" }),
    );

    expect(row?.restDays).toBe(3);
  });

  it("keeps the three extracted rest values when no manual rest exists", () => {
    const row = toEffectiveRow(COMPLETED, manual({ issuer: "Otro" }));

    expect(row).toMatchObject({
      restFrom: "2026-11-01",
      restTo: "2026-11-10",
      restDays: 10,
    });
  });

  it("keeps an extracted days-only rest when no manual rest exists", () => {
    const daysOnly = ocr("completada", { restDays: 7 });

    expect(toEffectiveRow(daysOnly, manual({ issuer: "Otro" }))).toMatchObject({
      restFrom: null,
      restTo: null,
      restDays: 7,
    });
  });
});

describe("datumOrigin (MD-21)", () => {
  it("is manual only for a non-null manual column", () => {
    const entered = manual({
      issuer: "B",
      restFrom: "2026-11-09",
      restTo: "2026-11-09",
    });

    expect(datumOrigin(entered, "issuer")).toBe("manual");
    expect(datumOrigin(entered, "rest")).toBe("manual");
    expect(datumOrigin(entered, "studentName")).toBe("extracted");
    expect(datumOrigin(entered, "issueDate")).toBe("extracted");
  });

  it("is extracted for every datum when there is no manual row", () => {
    for (const datum of [
      "studentName",
      "issuer",
      "issueDate",
      "rest",
    ] as const) {
      expect(datumOrigin(null, datum)).toBe("extracted");
    }
  });
});
