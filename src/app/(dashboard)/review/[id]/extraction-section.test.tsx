import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { ExtractionSection } from "@/app/(dashboard)/review/[id]/extraction-section";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";
import type { ExtractionList, ExtractionListItem } from "@/lib/data/extraction";
import type { ExtractionRowView } from "@/lib/extraction/display";

// request-review: "Extracted data section on the staff detail", "Extraction
// states on the staff detail" and "fail-soft" (RF-11, RN-02, RNF-01). The
// section is a pure view of the read model plus the request state and the
// "configured" flag, so every scenario is a render with a scripted list.

const en = messages.en.review;
const es = messages.es.review;

const COMPLETE: ExtractionRowView = {
  state: "completada",
  studentName: "Ana Lopez",
  issuer: "Clinica Central",
  issueDate: "2026-07-18",
  restFrom: "2026-07-20",
  restTo: "2026-07-24",
  restDays: 5,
};

function item(
  id: number,
  row: ExtractionRowView | null,
  nombreOriginal = `doc-${id}.pdf`,
): ExtractionListItem {
  return { documentoId: id, nombreOriginal, row };
}

function list(...items: ExtractionListItem[]): ExtractionList {
  return { data: items, degraded: false };
}

function show(
  extractions: ExtractionList,
  options: {
    requestState?: "pendiente" | "aprobada" | "devuelta";
    configured?: boolean;
    locale?: "es" | "en";
  } = {},
) {
  return renderIntl(
    <ExtractionSection
      extractions={extractions}
      requestState={options.requestState ?? "pendiente"}
      configured={options.configured ?? true}
    />,
    options.locale ?? "en",
  );
}

const section = () =>
  screen.getByRole("region", { name: en.detail.sections.extraction });

function fact(label: string, root: HTMLElement = section()) {
  const term = within(root).getByText(label, { selector: "dt" });
  return term.nextElementSibling as HTMLElement;
}

describe("ExtractionSection data (RF-11 a, RF-11 b)", () => {
  it("shows the four fields with the rest range and its days (Full data shown)", () => {
    show(list(item(1, COMPLETE, "constancia.pdf")));

    expect(
      screen.getByRole("heading", { level: 3, name: "constancia.pdf" }),
    ).toBeInTheDocument();
    expect(fact(en.extraction.fields.studentName)).toHaveTextContent(
      "Ana Lopez",
    );
    expect(fact(en.extraction.fields.issuer)).toHaveTextContent(
      "Clinica Central",
    );
    expect(fact(en.extraction.fields.issueDate)).toHaveTextContent(
      "Jul 18, 2026",
    );
    expect(fact(en.extraction.fields.restPeriod)).toHaveTextContent(
      "Jul 20, 2026 to Jul 24, 2026 (5 days)",
    );
  });

  it("labels the name as read from the document and says it is not compared", () => {
    show(list(item(1, COMPLETE)));

    expect(
      within(section()).getByText(en.extraction.fields.studentName, {
        selector: "dt",
      }),
    ).toBeInTheDocument();
    expect(section()).toHaveTextContent(en.extraction.note);
    expect(en.extraction.note).toMatch(/not compared/);
  });

  it("marks a field without value as muted 'not recognized' with no value (Unrecognized field)", () => {
    show(
      list(
        item(1, {
          ...COMPLETE,
          studentName: null,
          restFrom: null,
          restTo: null,
          restDays: null,
        }),
      ),
    );

    const rest = fact(en.extraction.fields.restPeriod);
    expect(rest).toHaveTextContent(en.extraction.notRecognized);
    expect(within(rest).getByText(en.extraction.notRecognized)).toHaveClass(
      "text-muted-foreground",
    );
    expect(rest).not.toHaveTextContent(/day|\d{4}/);
    expect(fact(en.extraction.fields.studentName)).toHaveTextContent(
      en.extraction.notRecognized,
    );
    expect(fact(en.extraction.fields.issuer)).toHaveTextContent(
      "Clinica Central",
    );
  });

  it("shows only the days when the document gave no dates (Days only)", () => {
    show(
      list(item(1, { ...COMPLETE, restFrom: null, restTo: null, restDays: 3 })),
    );

    const rest = fact(en.extraction.fields.restPeriod);
    expect(rest).toHaveTextContent("3 days");
    expect(rest).not.toHaveTextContent(/2026| to /);
  });

  it("shows a one-day rest as one date with its day count", () => {
    show(
      list(
        item(1, {
          ...COMPLETE,
          restFrom: "2026-07-20",
          restTo: "2026-07-20",
          restDays: 1,
        }),
      ),
    );

    const rest = fact(en.extraction.fields.restPeriod);
    expect(rest).toHaveTextContent("Jul 20, 2026 (1 day)");
    expect(rest).not.toHaveTextContent(" to ");
  });

  it("shows calendar dates without a time-zone shift", () => {
    // 2026-01-01 would read Dec 31 in Managua if it were parsed as an instant.
    show(
      list(
        item(1, {
          ...COMPLETE,
          issueDate: "2026-01-01",
          restFrom: "2026-01-01",
          restTo: "2026-01-02",
          restDays: 2,
        }),
      ),
    );

    expect(fact(en.extraction.fields.issueDate)).toHaveTextContent(
      "Jan 1, 2026",
    );
    expect(fact(en.extraction.fields.restPeriod)).toHaveTextContent(
      "Jan 1, 2026 to Jan 2, 2026 (2 days)",
    );
  });

  it("speaks Spanish", () => {
    show(list(item(1, COMPLETE)), { locale: "es" });

    const root = screen.getByRole("region", {
      name: es.detail.sections.extraction,
    });
    expect(fact(es.extraction.fields.issuer, root)).toHaveTextContent(
      "Clinica Central",
    );
    expect(fact(es.extraction.fields.restPeriod, root)).toHaveTextContent(
      "20 jul 2026 al 24 jul 2026 (5 días)",
    );
  });

  it("lists one entry per document, in order", () => {
    show(
      list(
        item(1, COMPLETE, "a.pdf"),
        item(2, { ...COMPLETE, issuer: "Otra Clinica" }, "b.jpg"),
      ),
    );

    const names = within(section())
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(names).toEqual(["a.pdf", "b.jpg"]);
    expect(screen.getAllByText("Otra Clinica")).toHaveLength(1);
  });
});

describe("ExtractionSection states (RF-11)", () => {
  it.each([
    ["a processing row", { ...COMPLETE, state: "procesando" as const }],
    ["a pending row", { ...COMPLETE, state: "pendiente" as const }],
    ["a missing row", null],
  ])("reads 'extracting' for %s, with no action and no values", (_l, row) => {
    show(list(item(1, row)));

    expect(section()).toHaveTextContent(en.extraction.states.extracting);
    expect(section()).not.toHaveTextContent(en.extraction.states.unavailable);
    expect(within(section()).queryAllByRole("button")).toHaveLength(0);
    expect(within(section()).queryAllByRole("link")).toHaveLength(0);
    expect(section()).not.toHaveTextContent("Ana Lopez");
  });

  it("reads 'unavailable, review the document' for a failed row, with no control", () => {
    show(list(item(1, { ...COMPLETE, state: "fallida" })));

    expect(section()).toHaveTextContent(en.extraction.states.unavailable);
    expect(section()).not.toHaveTextContent(en.extraction.states.extracting);
    expect(within(section()).queryAllByRole("button")).toHaveLength(0);
    expect(within(section()).queryAllByRole("link")).toHaveLength(0);
    expect(within(section()).queryAllByRole("textbox")).toHaveLength(0);
  });

  it.each(["aprobada", "devuelta"] as const)(
    "never reads 'extracting' in a %s request (Decided request never extracting)",
    (requestState) => {
      show(
        list(
          item(1, { ...COMPLETE, state: "pendiente" }),
          item(2, { ...COMPLETE, state: "procesando" }),
          item(3, null),
        ),
        { requestState },
      );

      expect(section()).not.toHaveTextContent(en.extraction.states.extracting);
      expect(
        within(section()).getAllByText(en.extraction.states.unavailable),
      ).toHaveLength(3);
    },
  );

  it("shows the configuration message once for several waiting documents, without the variable name", () => {
    show(
      list(
        item(1, null),
        item(2, { ...COMPLETE, state: "pendiente" }),
        item(3, { ...COMPLETE, state: "procesando" }),
      ),
      { configured: false },
    );

    expect(
      within(section()).getAllByText(en.extraction.states.notConfigured),
    ).toHaveLength(1);
    expect(section()).not.toHaveTextContent(en.extraction.states.extracting);
    expect(section().textContent).not.toMatch(/EXTRACTION_API|url/i);
  });

  it("words the configuration message in Spanish", () => {
    show(list(item(1, null), item(2, null)), {
      configured: false,
      locale: "es",
    });

    const root = screen.getByRole("region", {
      name: es.detail.sections.extraction,
    });
    expect(
      within(root).getAllByText(
        "Hace falta configurar el servicio de extracción. Contacte al administrador del sistema.",
      ),
    ).toHaveLength(1);
  });

  it("still shows completed data when extraction is no longer configured", () => {
    show(list(item(1, COMPLETE), item(2, null)), { configured: false });

    expect(fact(en.extraction.fields.issuer)).toHaveTextContent(
      "Clinica Central",
    );
    expect(
      within(section()).getAllByText(en.extraction.states.notConfigured),
    ).toHaveLength(1);
  });

  it("keeps an unavailable entry unavailable when not configured", () => {
    show(list(item(1, { ...COMPLETE, state: "fallida" })), {
      configured: false,
    });

    expect(section()).toHaveTextContent(en.extraction.states.unavailable);
    expect(section()).not.toHaveTextContent(en.extraction.states.notConfigured);
  });

  it("replaces every entry with the degraded notice, with no partial values", () => {
    show({ data: [item(1, COMPLETE)], degraded: true });

    expect(
      within(section()).getByText(en.extraction.degraded),
    ).toBeInTheDocument();
    expect(section()).not.toHaveTextContent("Ana Lopez");
    expect(within(section()).queryAllByRole("heading", { level: 3 })).toEqual(
      [],
    );
    expect(section()).not.toHaveTextContent(en.extraction.states.extracting);
  });

  it("renders nothing when there are no documents and the read did not fail", () => {
    const { container } = show(list());

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ExtractionSection layout and accessibility", () => {
  it("uses the shared card, the muted ink and the dl layout, with no fixed width", () => {
    show(list(item(1, COMPLETE), item(2, null)));

    expect(section()).toHaveClass("bg-card", "rounded-xl", "p-6");
    expect(section().querySelectorAll("dl").length).toBe(1);
    const classes = [...section().querySelectorAll("[class]")].flatMap((el) =>
      el.className.toString().split(/\s+/),
    );
    expect(classes.filter((c) => /^(min-|max-)?w-(\[|[1-9])/.test(c))).toEqual(
      [],
    );
    // A long name must be able to wrap at 360 px.
    expect(
      screen.getByRole("heading", { level: 3, name: "doc-1.pdf" }),
    ).toHaveClass("break-all");
  });

  it.each<[string, ExtractionList]>([
    ["data", list(item(1, COMPLETE), item(2, null))],
    ["failed", list(item(1, { ...COMPLETE, state: "fallida" }))],
    ["degraded", { data: [], degraded: true }],
  ])("reports no accessibility violation (%s)", async (_l, value) => {
    const { container } = show(value);

    // jsdom has no layout, so contrast cannot be computed here; the design
    // system measures the muted ink and the owner walk covers 360 px.
    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});
