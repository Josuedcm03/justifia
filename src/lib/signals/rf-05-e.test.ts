import { describe, expect, it } from "vitest";

import type { DocumentMarks, TipoDocumento } from "@/lib/document-data/types";
import type { ExtractionRowView } from "@/lib/extraction/display";
import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";
import { CAUSAS, type Causa } from "@/lib/intake/causes";

import { evaluateSignals } from "./evaluate";
import { DEFAULT_SIGNAL_PARAMS } from "./params";
import type { SignalInput, SignalReport } from "./types";

// Thesis acceptance of RF-05 (e), "tipo discordante": «Un documento cuyo tipo
// registrado no corresponde a la causa declarada muestra la señal “formato no
// corresponde a la causa”.» Thesis 4.9 asks for it as a unit test: "Unitaria …
// tipo discordante … Vitest". Every case goes through evaluateSignals with the
// default parameters, so the shipped type-to-cause table decides the outcome.
// The scenarios are the A5 ones (SC-05 is the thesis case).

const calendar = constantCalendar({ 2026: ["2026-12-26"] });

// A request on time, with a first issuer and a rest that covers the absence, so
// no signal other than the ones of the marks can be raised.
const COMPLETE: ExtractionRowView = {
  state: "completada",
  studentName: "Ana Lopez",
  issuer: "Clinica Central",
  issueDate: "2026-10-02",
  restFrom: "2026-10-05",
  restTo: "2026-10-09",
  restDays: 5,
};

const SIGNED_AND_SEALED = { hasSignature: true, hasSeal: true } as const;

function evaluateRequest(
  causa: Causa,
  documents: { type: TipoDocumento | null; marks?: Partial<DocumentMarks> }[],
): SignalReport {
  const input: SignalInput = {
    solicitudId: 40,
    presentedAt: new Date("2026-10-13T15:00:00Z"),
    absenceFrom: "2026-10-05",
    absenceTo: "2026-10-09",
    causa,
    documents: documents.map(({ type, marks }, index) => ({
      documentId: index + 1,
      extraction: COMPLETE,
      marks: { type, ...SIGNED_AND_SEALED, ...marks },
    })),
    periods: ["2026-S2"],
    issuerHistory: [],
    repeated: {
      documents: documents.map((_, index) => ({
        documentId: index + 1,
        fingerprinted: true,
      })),
      matches: [],
    },
  };
  return evaluateSignals(input, DEFAULT_SIGNAL_PARAMS, calendar, {
    lateFilingBusinessDays: 2,
  });
}

const rn13 = (report: SignalReport) =>
  report.results.find((result) => result.signal === "rn13");

const withoutRn13 = (report: SignalReport) =>
  report.results.filter((result) => result.signal !== "rn13");

describe("RF-05 (e) tipo discordante", () => {
  it("SC-05: an actividad_representativa request with a constancia_medica raises «formato no corresponde a la causa»", () => {
    const report = evaluateRequest("actividad_representativa", [
      { type: "constancia_medica" },
    ]);

    expect(rn13(report)).toEqual({
      signal: "rn13",
      outcome: "present",
      evidence: { kind: "documents", documentIds: [1] },
    });
    expect(report.verdict).toBe("review_carefully");
  });

  it("SC-05: the other seven signals are as without the document type", () => {
    const discordant = evaluateRequest("actividad_representativa", [
      { type: "constancia_medica" },
    ]);
    const corresponding = evaluateRequest("actividad_representativa", [
      { type: "constancia_institucional" },
    ]);
    const untyped = evaluateRequest("actividad_representativa", [
      { type: null },
    ]);

    expect(withoutRn13(discordant)).toHaveLength(7);
    expect(withoutRn13(discordant)).toEqual(withoutRn13(corresponding));
    expect(withoutRn13(discordant)).toEqual(withoutRn13(untyped));
  });

  it.each([
    ["SC-01 standard medical approval", "medica", "constancia_medica"],
    ["SC-09 medical certificate", "medica", "constancia_medica"],
    [
      "SC-10 sports letter of the UAM",
      "actividad_representativa",
      "constancia_institucional",
    ],
    ["SC-06 employer letter", "fuerza_mayor", "constancia_institucional"],
    [
      "SC-13 foundation letter",
      "intercambio_academico",
      "constancia_institucional",
    ],
    [
      "SC-11 b special format of the FIA, signed and sealed",
      "fuerza_mayor",
      "constancia_institucional",
    ],
  ] as const)("%s: no signal from the type", (_scenario, causa, type) => {
    const report = evaluateRequest(causa, [{ type }]);

    expect(rn13(report)).toMatchObject({ outcome: "absent" });
    expect(report.results.map((result) => result.outcome)).not.toContain(
      "present",
    );
  });

  it("SC-01: a medica request with all its marks has no signal at all", () => {
    const report = evaluateRequest("medica", [{ type: "constancia_medica" }]);

    expect(report.results.map((result) => result.outcome)).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
    expect(report.verdict).toBe("no_alerts");
  });

  it.each(CAUSAS)("«otro» raises the signal for %s", (causa) => {
    const report = evaluateRequest(causa, [{ type: "otro" }]);

    expect(rn13(report)).toMatchObject({ outcome: "present" });
    expect(report.verdict).toBe("review_carefully");
  });

  it("an untyped document is not evaluable with «not_registered» and keeps the verdict open", () => {
    const report = evaluateRequest("medica", [{ type: null }]);

    expect(rn13(report)).toEqual({
      signal: "rn13",
      outcome: "not_evaluable",
      reason: "not_registered",
    });
    expect(report.verdict).toBe("inconclusive");
    expect(report.notEvaluable).toEqual([
      { signal: "rn13", reason: "not_registered" },
    ]);
  });

  it("SC-11 a: the FIA form marked without firma and sello raises rn11 and rn12, with no exemption", () => {
    const report = evaluateRequest("fuerza_mayor", [
      {
        type: "constancia_institucional",
        marks: { hasSignature: false, hasSeal: false },
      },
    ]);

    const outcomes = Object.fromEntries(
      report.results.map((result) => [result.signal, result.outcome]),
    );
    expect(outcomes.rn11).toBe("present");
    expect(outcomes.rn12).toBe("present");
    expect(outcomes.rn13).toBe("absent");
  });
});
