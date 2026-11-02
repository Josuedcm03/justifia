import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import { SignalsSection } from "@/app/(dashboard)/review/[id]/signals-section";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";
import type { SignalView, Verdict } from "@/lib/signals/types";

vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);

// request-review: "Signals section and suggested verdict on the staff detail",
// "Signals are fail-soft" and "Signals UI i18n" (RF-05, RN-15, RNF-12). The
// section is a pure view of the report, so every scenario is a render with a
// scripted view.

const en = messages.en.review;
const es = messages.es.review;

const REPORT: SignalView = {
  verdict: "review_carefully",
  results: [
    {
      signal: "rn07",
      outcome: "present",
      evidence: {
        kind: "timing",
        presented: "2026-10-14",
        deadline: "2026-10-13",
      },
    },
    {
      signal: "rn09",
      outcome: "absent",
      evidence: { kind: "incoherent", documents: [] },
    },
    { signal: "rn10", outcome: "not_evaluable", reason: "extraction_pending" },
    {
      signal: "rn14",
      outcome: "absent",
      evidence: {
        kind: "recurrence",
        issuer: "clinica central",
        count: 2,
        threshold: 3,
      },
    },
  ],
  notEvaluable: [{ signal: "rn10", reason: "extraction_pending" }],
};

function show(
  data: SignalView | null,
  options: { degraded?: boolean; locale?: "es" | "en" } = {},
) {
  return renderIntl(
    <SignalsSection signals={{ data, degraded: options.degraded ?? false }} />,
    options.locale ?? "en",
  );
}

const section = (name = en.signals.title) =>
  screen.getByRole("region", { name });

function fact(label: string, root: HTMLElement = section()) {
  const term = within(root).getByText(label, { selector: "dt" });
  return term.nextElementSibling as HTMLElement;
}

describe("SignalsSection content (Section content)", () => {
  it("shows the verdict in words in a status paragraph, with the display-only sentence", () => {
    show(REPORT);

    const status = within(section()).getByRole("status");
    expect(status).toHaveTextContent("Suggestion: Review carefully");
    expect(section()).toHaveTextContent(en.signals.note);
    expect(en.signals.note).toMatch(/does not change the state of the request/);
  });

  it.each<[Verdict, string]>([
    ["review_carefully", "Review carefully"],
    ["no_alerts", "No alerts"],
    ["inconclusive", "Inconclusive"],
  ])("words the %s verdict as %s", (verdict, text) => {
    show({ ...REPORT, verdict });

    expect(within(section()).getByRole("status")).toHaveTextContent(text);
  });

  it("words the three Spanish verdicts as the owner specified", () => {
    for (const [verdict, text] of [
      ["review_carefully", "Revisar con cuidado"],
      ["no_alerts", "Sin alertas"],
      ["inconclusive", "No concluyente"],
    ] as const) {
      const { unmount } = show({ ...REPORT, verdict }, { locale: "es" });

      expect(
        within(
          screen.getByRole("region", { name: es.signals.title }),
        ).getByRole("status"),
      ).toHaveTextContent(`Sugerencia: ${text}`);
      unmount();
    }
  });

  it("shows one entry per signal with its name and outcome in words (Text, not color)", () => {
    show(REPORT);

    expect(fact(en.signals.names.rn07)).toHaveTextContent(
      en.signals.outcomes.present,
    );
    expect(fact(en.signals.names.rn09)).toHaveTextContent(
      en.signals.outcomes.absent,
    );
    expect(fact(en.signals.names.rn10)).toHaveTextContent(
      en.signals.outcomes.not_evaluable,
    );
    expect(fact(en.signals.names.rn14)).toHaveTextContent(
      en.signals.outcomes.absent,
    );
    expect(section().querySelectorAll("dt")).toHaveLength(4);
  });

  it("lists the not evaluable signals apart, each with its reason as text", () => {
    show({
      ...REPORT,
      results: [
        ...REPORT.results.slice(0, 3),
        { signal: "rn14", outcome: "not_evaluable", reason: "no_period" },
      ],
      notEvaluable: [
        { signal: "rn10", reason: "extraction_pending" },
        { signal: "rn14", reason: "no_period" },
      ],
    });

    const apart = screen.getByRole("list", {
      name: en.signals.notEvaluable.title,
    });
    const items = within(apart).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(en.signals.names.rn10);
    expect(items[0]).toHaveTextContent(en.signals.reasons.extraction_pending);
    expect(items[1]).toHaveTextContent(en.signals.names.rn14);
    expect(items[1]).toHaveTextContent(en.signals.reasons.no_period);
  });

  it("has no list apart when every signal was evaluated", () => {
    show({
      verdict: "no_alerts",
      results: REPORT.results.map((r) =>
        r.outcome === "not_evaluable"
          ? { signal: r.signal, outcome: "absent" as const }
          : r,
      ),
      notEvaluable: [],
    });

    expect(
      screen.queryByRole("list", { name: en.signals.notEvaluable.title }),
    ).toBeNull();
    expect(section()).not.toHaveTextContent(en.signals.notEvaluable.title);
  });
});

describe("SignalsSection evidence for the secretary", () => {
  it("shows the presentation and deadline dates with the shared date format", () => {
    show(REPORT);

    expect(fact(en.signals.names.rn07)).toHaveTextContent(
      "Presented Oct 14, 2026; the deadline is Oct 13, 2026.",
    );
  });

  it("shows the count and the threshold of the recurrence", () => {
    show(REPORT);

    expect(fact(en.signals.names.rn14)).toHaveTextContent(
      "Requests with the issuer “clinica central” in the period: 2 (threshold: 3).",
    );
  });

  it("shows the incoherent documents' dates and the uncovered periods", () => {
    show({
      verdict: "review_carefully",
      results: [
        {
          signal: "rn09",
          outcome: "present",
          evidence: {
            kind: "incoherent",
            documents: [
              { documentId: 3, issueDate: "2026-07-12", restTo: "2026-07-10" },
            ],
          },
        },
        {
          signal: "rn10",
          outcome: "present",
          evidence: {
            kind: "uncovered",
            absenceFrom: "2026-10-05",
            absenceTo: "2026-10-09",
            covered: [
              { from: "2026-10-05", to: "2026-10-06" },
              { from: "2026-10-08", to: "2026-10-09" },
            ],
          },
        },
      ],
      notEvaluable: [],
    });

    expect(fact(en.signals.names.rn09)).toHaveTextContent(
      "Issued Jul 12, 2026; the rest ends Jul 10, 2026.",
    );
    expect(fact(en.signals.names.rn10)).toHaveTextContent(
      "Absence: Oct 5, 2026 to Oct 9, 2026. Dated rest periods: Oct 5, 2026 to Oct 6, 2026, Oct 8, 2026 to Oct 9, 2026.",
    );
  });

  it("says so when no rest period has dates", () => {
    show({
      verdict: "review_carefully",
      results: [
        {
          signal: "rn10",
          outcome: "present",
          evidence: {
            kind: "uncovered",
            absenceFrom: "2026-10-05",
            absenceTo: "2026-10-09",
            covered: [],
          },
        },
      ],
      notEvaluable: [],
    });

    expect(fact(en.signals.names.rn10)).toHaveTextContent(
      "Absence: Oct 5, 2026 to Oct 9, 2026. No dated rest period.",
    );
  });

  it("renders a view without evidence as outcomes and labels only", () => {
    show({
      verdict: "review_carefully",
      results: [
        { signal: "rn07", outcome: "present" },
        { signal: "rn14", outcome: "absent" },
      ],
      notEvaluable: [],
    });

    expect(fact(en.signals.names.rn07).textContent).toBe(
      en.signals.outcomes.present,
    );
    expect(section()).not.toHaveTextContent(/Presented|threshold/);
  });

  it("speaks Spanish", () => {
    show(REPORT, { locale: "es" });

    const root = screen.getByRole("region", { name: es.signals.title });
    expect(fact(es.signals.names.rn07, root)).toHaveTextContent(
      "Presentada el 14 oct 2026; el plazo vence el 13 oct 2026.",
    );
    expect(root).toHaveTextContent(es.signals.reasons.extraction_pending);
  });
});

describe("SignalsSection fail-soft (Read failure)", () => {
  it("shows only the degraded notice, with no verdict and no entries", () => {
    show(null, { degraded: true });

    expect(
      within(section()).getByText(en.signals.degraded),
    ).toBeInTheDocument();
    expect(section()).not.toHaveTextContent(/Suggestion|Review carefully/);
    expect(section().querySelectorAll("dt")).toHaveLength(0);
    expect(within(section()).queryAllByRole("list")).toHaveLength(0);
  });

  it("never mixes a report with the degraded notice", () => {
    show(REPORT, { degraded: true });

    expect(
      within(section()).getByText(en.signals.degraded),
    ).toBeInTheDocument();
    expect(section()).not.toHaveTextContent(en.signals.names.rn07);
  });

  it("treats a missing report as degraded", () => {
    show(null);

    expect(
      within(section()).getByText(en.signals.degraded),
    ).toBeInTheDocument();
  });
});

describe("SignalsSection layout and accessibility", () => {
  it("offers no button and no link", () => {
    show(REPORT);

    expect(within(section()).queryAllByRole("button")).toHaveLength(0);
    expect(within(section()).queryAllByRole("link")).toHaveLength(0);
    expect(within(section()).queryAllByRole("textbox")).toHaveLength(0);
  });

  it("uses the shared card and no fixed width, so it cannot overflow at 360 px", () => {
    show(REPORT);

    expect(section()).toHaveClass("bg-card", "rounded-xl", "p-6");
    const classes = [...section().querySelectorAll("[class]")].flatMap((el) =>
      el.className.toString().split(/\s+/),
    );
    expect(classes.filter((c) => /^(min-|max-)?w-(\[|[1-9])/.test(c))).toEqual(
      [],
    );
  });

  it.each<[string, SignalView | null, boolean]>([
    ["report", REPORT, false],
    [
      "no alerts",
      { verdict: "no_alerts", results: [], notEvaluable: [] },
      false,
    ],
    ["degraded", null, true],
  ])("reports no accessibility violation (%s)", async (_l, data, degraded) => {
    const { container } = show(data, { degraded });

    // jsdom has no layout, so contrast cannot be computed here; the design
    // system measures the tokens and the owner walk covers 360 px.
    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});

describe("SignalsSection RN-26 (Reference to an earlier request)", () => {
  const rn26 = (
    references: number[],
    outcome: "present" | "absent" = "present",
  ): SignalView => ({
    verdict: outcome === "present" ? "review_carefully" : "no_alerts",
    results: [
      {
        signal: "rn26",
        outcome,
        evidence: { kind: "repeated", references },
      },
    ],
    notEvaluable: [],
  });

  it("names the signal and states the match in words", () => {
    show(rn26([41]));

    expect(fact(en.signals.names.rn26)).toHaveTextContent(
      en.signals.outcomes.present,
    );
    expect(fact(en.signals.names.rn26)).toHaveTextContent(
      en.signals.evidence.repeated,
    );
  });

  it("renders each referenced request as a link to its detail, with no prefetch", () => {
    show(rn26([41, 55]));

    const links = within(fact(en.signals.names.rn26)).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "Request 41",
      "Request 55",
    ]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/review/41",
      "/review/55",
    ]);
    expect(links.map((a) => a.getAttribute("data-prefetch"))).toEqual([
      "false",
      "false",
    ]);
  });

  it("shows present with no number and no link when the match is out of scope (Match outside the scope shows no reference)", () => {
    show(rn26([]));

    const entry = fact(en.signals.names.rn26);
    expect(entry).toHaveTextContent(en.signals.outcomes.present);
    expect(entry).toHaveTextContent(en.signals.evidence.repeated);
    expect(within(entry).queryAllByRole("link")).toHaveLength(0);
    expect(entry).not.toHaveTextContent(en.signals.evidence.repeatedSee);
    expect(entry.textContent).not.toMatch(/\d/);
  });

  it("shows no match line and no link when the signal is absent", () => {
    show(rn26([], "absent"));

    const entry = fact(en.signals.names.rn26);
    expect(entry.textContent).toBe(en.signals.outcomes.absent);
  });

  it("lists the missing fingerprint apart, with its reason as text", () => {
    show({
      verdict: "inconclusive",
      results: [
        { signal: "rn26", outcome: "not_evaluable", reason: "no_fingerprint" },
      ],
      notEvaluable: [{ signal: "rn26", reason: "no_fingerprint" }],
    });

    const items = within(
      screen.getByRole("list", { name: en.signals.notEvaluable.title }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(en.signals.names.rn26);
    expect(items[0]).toHaveTextContent(en.signals.reasons.no_fingerprint);
  });

  it("shows no student or document name", () => {
    show(rn26([41]));

    expect(section().textContent).not.toMatch(
      /nombre|cif|correo|\.pdf|\.png|\.jpg/i,
    );
  });

  it("speaks Spanish", () => {
    show(rn26([41]), { locale: "es" });

    const root = screen.getByRole("region", { name: es.signals.title });
    const entry = fact(es.signals.names.rn26, root);
    expect(entry).toHaveTextContent(es.signals.evidence.repeated);
    expect(within(entry).getByRole("link")).toHaveTextContent("Solicitud 41");
  });

  it("reports no accessibility violation with links", async () => {
    const { container } = show(rn26([41, 55]));

    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});
