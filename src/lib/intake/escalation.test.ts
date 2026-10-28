import { describe, expect, it } from "vitest";

import {
  ESCALATION_KINDS,
  ESCALATION_NOTE_MAX,
  EXCESS_REPORT_STATE,
  reasonAfterUnconfiguredRelease,
  validateAnswerText,
  validateEscalationDraft,
  validateReportDraft,
} from "./escalation";

// 2026-10-14 15:00 UTC is Wednesday 09:00 in Managua.
const NOW = new Date("2026-10-14T15:00:00Z");
const TODAY = "2026-10-14";
const YESTERDAY = "2026-10-13";
const TOMORROW = "2026-10-15";

describe("reasonAfterUnconfiguredRelease", () => {
  it("keeps the reason of a real earlier failure", () => {
    expect(
      reasonAfterUnconfiguredRelease({
        estado: "pendiente",
        motivo: "error_envio",
      }),
    ).toBe("error_envio");
  });

  it("has none for a notice that was never attempted", () => {
    expect(
      reasonAfterUnconfiguredRelease({ estado: "pendiente", motivo: null }),
    ).toBeNull();
  });

  it("drops a blocked reason, which the recipients that now exist outdate", () => {
    expect(
      reasonAfterUnconfiguredRelease({
        estado: "bloqueada",
        motivo: "sin_destinatarios",
      }),
    ).toBeNull();
  });
});

describe("escalation constants (RN-20, ES-4)", () => {
  it("knows exactly the two kinds", () => {
    expect([...ESCALATION_KINDS]).toEqual([
      "sospecha_documento",
      "exceso_inasistencias",
    ]);
  });

  it("reports excess absences only on an approved request", () => {
    expect(EXCESS_REPORT_STATE).toBe("aprobada");
  });
});

describe("validateEscalationDraft (RN-20)", () => {
  const ok = (nota: unknown) =>
    validateEscalationDraft({ motivo: "sospecha_documento", nota });

  it.each([
    ["empty", "", "nota_required"],
    ["whitespace only", " \n\t ", "nota_required"],
    ["not a string", undefined, "nota_required"],
    ["1001 characters", "a".repeat(1001), "nota_too_long"],
  ])("refuses a note that is %s", (_label, nota, code) => {
    expect(ok(nota)).toEqual({ ok: false, errors: [{ field: "nota", code }] });
  });

  it("accepts 1000 characters and trims the note", () => {
    expect(ok("a".repeat(ESCALATION_NOTE_MAX))).toEqual({
      ok: true,
      motivo: "sospecha_documento",
      nota: "a".repeat(1000),
    });
    expect(ok("  Firma dudosa  ")).toEqual({
      ok: true,
      motivo: "sospecha_documento",
      nota: "Firma dudosa",
    });
  });

  it("counts the trimmed length against the bound", () => {
    expect(ok(` ${"a".repeat(1000)} `).ok).toBe(true);
  });

  it.each([["exceso_inasistencias"], ["otro"], [""], [null], [undefined]])(
    "refuses the reason %j: the server fixes it",
    (motivo) => {
      expect(validateEscalationDraft({ motivo, nota: "Firma dudosa" })).toEqual(
        { ok: false, errors: [{ field: "motivo", code: "motivo_invalid" }] },
      );
    },
  );

  it("reports the reason and the note together", () => {
    expect(validateEscalationDraft({ motivo: "x", nota: "" })).toEqual({
      ok: false,
      errors: [
        { field: "motivo", code: "motivo_invalid" },
        { field: "nota", code: "nota_required" },
      ],
    });
  });
});

describe("validateAnswerText (ES-8)", () => {
  it.each([
    ["empty", "", "texto_required"],
    ["whitespace only", "   ", "texto_required"],
    ["not a string", null, "texto_required"],
    ["1001 characters", "a".repeat(1001), "texto_too_long"],
  ])("refuses an answer that is %s", (_label, texto, code) => {
    expect(validateAnswerText(texto)).toEqual({
      ok: false,
      errors: [{ field: "texto", code }],
    });
  });

  it("accepts 1000 characters and trims the text", () => {
    expect(validateAnswerText("a".repeat(1000))).toEqual({
      ok: true,
      texto: "a".repeat(1000),
    });
    expect(validateAnswerText("  Documento valido.  ")).toEqual({
      ok: true,
      texto: "Documento valido.",
    });
  });
});

describe("validateReportDraft (RF-15)", () => {
  const report = (comunicadoEl: unknown, nota?: unknown, now = NOW) =>
    validateReportDraft({ comunicadoEl, nota }, now);

  it.each([
    ["today", TODAY],
    ["yesterday", YESTERDAY],
    ["a date before the approval", "2026-01-05"],
  ])("accepts %s", (_label, date) => {
    expect(report(date)).toEqual({
      ok: true,
      comunicadoEl: date,
      nota: null,
    });
  });

  it.each([
    ["tomorrow", TOMORROW, "date_future"],
    ["missing", undefined, "date_invalid"],
    ["empty", "", "date_invalid"],
    ["not a calendar date", "2026-02-30", "date_invalid"],
    ["not an ISO date", "14/10/2026", "date_invalid"],
  ])("refuses a date that is %s", (_label, date, code) => {
    expect(report(date)).toEqual({
      ok: false,
      errors: [{ field: "comunicadoEl", code }],
    });
  });

  it("takes today in Managua, not UTC", () => {
    // 2026-10-13 21:00 Managua is already the 14th in UTC.
    const evening = new Date("2026-10-14T03:00:00Z");
    expect(report("2026-10-13", undefined, evening).ok).toBe(true);
    expect(report("2026-10-14", undefined, evening)).toEqual({
      ok: false,
      errors: [{ field: "comunicadoEl", code: "date_future" }],
    });
  });

  it.each([[undefined], [null], [""]])("treats the note %j as absent", (n) => {
    expect(report(TODAY, n)).toEqual({
      ok: true,
      comunicadoEl: TODAY,
      nota: null,
    });
  });

  it("trims a given note and accepts up to 1000 characters", () => {
    expect(report(TODAY, "  Llamo el docente  ")).toMatchObject({
      nota: "Llamo el docente",
    });
    expect(report(TODAY, "a".repeat(1000))).toMatchObject({
      nota: "a".repeat(1000),
    });
  });

  it.each([
    ["blank", "   ", "nota_blank"],
    ["1001 characters", "a".repeat(1001), "nota_too_long"],
    ["not a string", 7, "nota_blank"],
  ])("refuses a note that is %s", (_label, nota, code) => {
    expect(report(TODAY, nota)).toEqual({
      ok: false,
      errors: [{ field: "nota", code }],
    });
  });

  it("reports the date and the note together", () => {
    expect(report(TOMORROW, "   ")).toEqual({
      ok: false,
      errors: [
        { field: "comunicadoEl", code: "date_future" },
        { field: "nota", code: "nota_blank" },
      ],
    });
  });
});
