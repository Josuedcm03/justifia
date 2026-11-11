import { cn } from "cn";
import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  Fact,
  Section,
  useDates,
} from "@/app/(dashboard)/review/[id]/request-sections";
import { DegradedAlert } from "@/components/degraded-alert";
import type {
  SignalEvidence,
  SignalView,
  SignalViewResult,
  Verdict,
} from "@/lib/signals/types";

// The "Validation signals" section of the staff detail (RF-05, RN-15). A server
// component with no polling and no action: it only renders the report it is
// given, which is computed on every read and never stored. The verdict and
// every outcome are conveyed as text; the tones only reinforce them. The
// coordination view passes the same shape without evidence, so a result with no
// evidence simply shows its outcome.

const VERDICT_TONES: Record<Verdict, string> = {
  review_carefully:
    "border-warning/30 border-l-warning bg-warning/10 text-warning-ink",
  no_alerts:
    "border-success/30 border-l-success bg-success/10 text-success-ink",
  inconclusive: "border-border border-l-border bg-muted text-foreground",
};

/** The evidence lines of one result, in the shared date format. */
function useEvidenceLines() {
  const t = useTranslations("review.signals.evidence");
  const dates = useDates();

  return (evidence: SignalEvidence): string[] => {
    switch (evidence.kind) {
      case "timing":
        return [
          t("timing", {
            presented: dates.day(evidence.presented),
            deadline: dates.day(evidence.deadline),
          }),
        ];
      case "incoherent":
        return evidence.documents.map((document) =>
          t("incoherent", {
            issued: dates.day(document.issueDate),
            end: dates.day(document.restTo),
          }),
        );
      case "uncovered": {
        const absence = dates.period(evidence.absenceFrom, evidence.absenceTo);
        return [
          evidence.covered.length === 0
            ? t("uncoveredNone", { absence })
            : t("uncovered", {
                absence,
                covered: evidence.covered
                  .map((period) => dates.period(period.from, period.to))
                  .join(", "),
              }),
        ];
      }
      case "recurrence":
        return [
          t("recurrence", {
            issuer: evidence.issuer,
            count: evidence.count,
            threshold: evidence.threshold,
          }),
        ];
      case "repeated":
        // Rendered by `RepeatedEvidence`: the references are links.
        return [];
    }
  };
}

/**
 * RN-26: states the match in words and links each earlier request the caller
 * may open (RNF-01). With no reference it says only that a document repeats:
 * nothing tells whether the other request is out of scope or whose it is.
 */
function RepeatedEvidence({ references }: { references: number[] }) {
  const t = useTranslations("review.signals.evidence");

  return (
    <>
      <span className="text-muted-foreground block">{t("repeated")}</span>
      {references.length > 0 && (
        <span className="text-muted-foreground block">
          {t("repeatedSee")}{" "}
          {references.map((id, index) => (
            <span key={id}>
              {index > 0 && ", "}
              <Link
                href={`/review/${id}`}
                prefetch={false}
                className="text-primary underline underline-offset-2"
              >
                {t("requestLink", { id })}
              </Link>
            </span>
          ))}
        </span>
      )}
    </>
  );
}

function SignalFact({ result }: { result: SignalViewResult }) {
  const t = useTranslations("review.signals");
  const lines = useEvidenceLines();
  // Evidence belongs to `present` and `absent` alone: a not evaluable or not
  // applicable entry carries none, whatever reaches this component.
  const evidence =
    (result.outcome === "present" || result.outcome === "absent") &&
    result.evidence
      ? lines(result.evidence)
      : [];

  return (
    <Fact label={t(`names.${result.signal}`)}>
      <span className="font-medium">{t(`outcomes.${result.outcome}`)}</span>
      {result.outcome === "not_applicable" && (
        <span className="text-muted-foreground block">
          {t("notApplicableNote")}
        </span>
      )}
      {evidence.map((line, index) => (
        <span key={`${index}-${line}`} className="text-muted-foreground block">
          {line}
        </span>
      ))}
      {result.outcome === "present" && result.evidence?.kind === "repeated" && (
        <RepeatedEvidence references={result.evidence.references} />
      )}
    </Fact>
  );
}

function NotEvaluableList({
  entries,
}: {
  entries: SignalView["notEvaluable"];
}) {
  const t = useTranslations("review.signals");
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 id="signals-not-evaluable-title" className="text-title">
        {t("notEvaluable.title")}
      </h3>
      <p className="text-muted-foreground max-w-prose text-sm">
        {t("notEvaluable.description")}
      </p>
      <ul
        aria-labelledby="signals-not-evaluable-title"
        className="flex flex-col gap-2"
      >
        {entries.map((entry) => (
          <li key={entry.signal} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t(`names.${entry.signal}`)}</span>
            <span className="text-muted-foreground">
              {t(`reasons.${entry.reason}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SignalsSection({
  signals,
  audience = "secretary",
}: {
  signals: { data: SignalView | null; degraded: boolean };
  /** The coordinator answers an escalation; only the secretary decides. */
  audience?: "secretary" | "coordination";
}) {
  const t = useTranslations("review.signals");
  const { data } = signals;

  return (
    <Section id="signals" title={t("title")}>
      {signals.degraded || data === null ? (
        <DegradedAlert message={t("degraded")} />
      ) : (
        <>
          <p
            role="status"
            className={cn(
              "rounded-lg border border-l-4 px-3 py-2 text-sm font-medium",
              VERDICT_TONES[data.verdict],
            )}
          >
            {t("verdict.line", { verdict: t(`verdict.${data.verdict}`) })}
          </p>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t(audience === "coordination" ? "coordinationNote" : "note")}
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            {data.results.map((result) => (
              <SignalFact key={result.signal} result={result} />
            ))}
          </dl>
          <NotEvaluableList entries={data.notEvaluable} />
        </>
      )}
    </Section>
  );
}
