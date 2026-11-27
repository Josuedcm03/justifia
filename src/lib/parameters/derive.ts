import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";
import type { Causa } from "@/lib/intake/causes";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";
import type { SignalParams } from "@/lib/signals/params";

import type { NormativeParameters } from "./registry";

// Pure adapters from the loaded parameters to what each rule already expects
// (design, Loader). The rules stay synchronous and take their values as
// explicit arguments; the page, the action or the route loads once and hands
// each rule its slice through one of these. No "server-only" and no I/O, so the
// client pages and the tests share them.

/** RN-08: business days to remit a request and the alert before the deadline. */
export type DeadlineRules = {
  remissionBusinessDays: number;
  alertBusinessDays: number;
};

/** RN-07: business days after which a presentation is late. */
export type TimingParams = {
  lateFilingBusinessDays: number;
};

/** RN-23 and RN-01: the filing window and the causes a draft may use. */
export type FilingRules = {
  windowDays: number;
  selectableCauses: readonly Causa[];
};

/** The two limits a client component shows and pre-checks. */
export type IntakeLimits = {
  filingWindowDays: number;
  maxDocumentMib: number;
};

const BYTES_PER_MIB = 1_048_576;

/** The calendar as the RN-08 clock reads it: dates by year, coverage by year. */
export function calendarOf(p: NormativeParameters): NonWorkingDaysProvider {
  const byYear: Record<number, string[]> = {};
  for (const { fecha } of p.nonWorkingDays) {
    (byYear[Number(fecha.slice(0, 4))] ??= []).push(fecha);
  }
  return constantCalendar(byYear);
}

export function deadlineRulesOf(p: NormativeParameters): DeadlineRules {
  return {
    remissionBusinessDays: p.remissionBusinessDays,
    alertBusinessDays: p.alertBusinessDays,
  };
}

export function timingParamsOf(p: NormativeParameters): TimingParams {
  return { lateFilingBusinessDays: p.lateFilingBusinessDays };
}

/** The `SignalParams` shape the evaluators already take (design A10). */
export function signalParamsOf(p: NormativeParameters): SignalParams {
  return {
    issuerRecurrenceThreshold: p.issuerRecurrenceThreshold,
    documentTypeCauses: p.documentTypeCauses,
  };
}

/** The active causes in their stored order; an inactive one is omitted. */
export function activeCausesOf(p: NormativeParameters): readonly Causa[] {
  return p.causes.filter((c) => c.activa).map((c) => c.codigo);
}

export function filingRulesOf(p: NormativeParameters): FilingRules {
  return {
    windowDays: p.filingWindowDays,
    selectableCauses: activeCausesOf(p),
  };
}

/** The largest supporting document, in bytes (RN-04). */
export function maxDocumentBytesOf(p: NormativeParameters): number {
  return p.maxDocumentMib * BYTES_PER_MIB;
}

export function intakeLimitsOf(p: NormativeParameters): IntakeLimits {
  return {
    filingWindowDays: p.filingWindowDays,
    maxDocumentMib: p.maxDocumentMib,
  };
}
