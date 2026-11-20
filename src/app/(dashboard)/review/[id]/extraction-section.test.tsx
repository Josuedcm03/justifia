import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ExtractionSection } from "@/app/(dashboard)/review/[id]/extraction-section";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";
import type { ExtractionList, ExtractionListItem } from "@/lib/data/extraction";
import type { DocumentMarks, ManualFields } from "@/lib/document-data/types";
import type { ExtractionRowView } from "@/lib/extraction/display";

// The form calls the Server Action; the section tests only render it.
vi.mock("@/app/(dashboard)/review/[id]/document-data-actions", () => ({
  saveDocumentDataAction: vi.fn(),
}));

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

const NO_MARKS: DocumentMarks = {
  type: null,
  hasSignature: null,
  hasSeal: null,
};

function item(
  id: number,
  row: ExtractionRowView | null,
  nombreOriginal = `doc-${id}.pdf`,
  extra: {
    ocr?: ExtractionRowView | null;
    manual?: ManualFields | null;
    marks?: DocumentMarks;
  } = {},
): ExtractionListItem {
  return {
    documentoId: id,
    nombreOriginal,
    row,
    ocr: extra.ocr === undefined ? row : extra.ocr,
    manual: extra.manual ?? null,
    marks: extra.marks ?? NO_MARKS,
  };
}

function list(...items: ExtractionListItem[]): ExtractionList {
  return { data: items, degraded: false };
}

function show(
  extractions: ExtractionList,
  options: {
    requestState?: "pendiente" | "aprobada" | "devuelta";
    configured?: boolean;
    editable?: boolean;
    locale?: "es" | "en";
  } = {},
) {
  return renderIntl(
    <ExtractionSection
      solicitudId={12}
      extractions={extractions}
      requestState={options.requestState ?? "pendiente"}
      configured={options.configured ?? true}
      editable={options.editable ?? false}
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
    // One list of facts per entry: the data and the marks, or the marks alone.
    expect(section().querySelectorAll("dl").length).toBe(2);
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

// manual-document-data: MD-26 (the manual mark, the type and the marks), MD-27
// (the states and the form in every one of them), MD-23 (one form per current
// document). The read model already merges the manual values over the
// extraction, so the item carries the effective row, the extraction row, the
// manual values and the marks.

const MANUAL_ALL: ManualFields = {
  studentName: "Ana Lopez",
  issuer: "Clinica Santa Fe",
  issueDate: "2026-11-02",
  restFrom: "2026-11-03",
  restTo: "2026-11-05",
};

const NO_MANUAL: ManualFields = {
  studentName: null,
  issuer: null,
  issueDate: null,
  restFrom: null,
  restTo: null,
};

const EFFECTIVE_ALL: ExtractionRowView = {
  state: "completada",
  studentName: "Ana Lopez",
  issuer: "Clinica Santa Fe",
  issueDate: "2026-11-02",
  restFrom: "2026-11-03",
  restTo: "2026-11-05",
  restDays: 3,
};

const NOTHING_READ: ExtractionRowView = {
  state: "completada",
  studentName: null,
  issuer: null,
  issueDate: null,
  restFrom: null,
  restTo: null,
  restDays: null,
};

const badge = en.extraction.manualBadge;
const openLabel = en.extraction.form.open;

describe("ExtractionSection manual data (RF-14 a, MD-26)", () => {
  it("marks each of the four data entered manually, next to its value (hoja step a)", () => {
    show(
      list(item(1, EFFECTIVE_ALL, "a.pdf", { ocr: null, manual: MANUAL_ALL })),
    );

    for (const label of [
      en.extraction.fields.studentName,
      en.extraction.fields.issuer,
      en.extraction.fields.issueDate,
      en.extraction.fields.restPeriod,
    ]) {
      expect(within(fact(label)).getByText(badge), label).toBeInTheDocument();
    }
    expect(within(section()).getAllByText(badge)).toHaveLength(4);
    expect(fact(en.extraction.fields.issuer)).toHaveTextContent(
      "Clinica Santa Fe",
    );
  });

  it("marks only the datum that is manual, and leaves the extracted ones unmarked (Manual value prevails)", () => {
    show(
      list(
        item(1, { ...COMPLETE, issuer: "Clinica Santa Fe" }, "a.pdf", {
          ocr: COMPLETE,
          manual: { ...NO_MANUAL, issuer: "Clinica Santa Fe" },
        }),
      ),
    );

    expect(
      within(fact(en.extraction.fields.issuer)).getByText(badge),
    ).toBeInTheDocument();
    expect(fact(en.extraction.fields.issueDate)).not.toHaveTextContent(badge);
    expect(fact(en.extraction.fields.studentName)).not.toHaveTextContent(badge);
    expect(fact(en.extraction.fields.restPeriod)).not.toHaveTextContent(badge);
    expect(within(section()).getAllByText(badge)).toHaveLength(1);
    // The extracted issuer is only a reference inside the form, never a fact.
    expect(section()).not.toHaveTextContent("Clinica Central");
  });

  it("marks the rest period once, as one datum, when both dates are manual", () => {
    show(
      list(
        item(
          1,
          {
            ...COMPLETE,
            restFrom: "2026-11-03",
            restTo: "2026-11-05",
            restDays: 3,
          },
          "a.pdf",
          {
            ocr: COMPLETE,
            manual: {
              ...NO_MANUAL,
              restFrom: "2026-11-03",
              restTo: "2026-11-05",
            },
          },
        ),
      ),
    );

    expect(
      within(fact(en.extraction.fields.restPeriod)).getByText(badge),
    ).toBeInTheDocument();
    expect(fact(en.extraction.fields.restPeriod)).toHaveTextContent(
      "Nov 3, 2026 to Nov 5, 2026 (3 days)",
    );
    expect(within(section()).getAllByText(badge)).toHaveLength(1);
  });

  it("shows no manual mark for an extracted entry (Full data shown)", () => {
    show(list(item(1, COMPLETE)));

    expect(section()).not.toHaveTextContent(badge);
  });

  it("shows the registered values of a failed extraction with the mark, and the rest as not recognized (Registered values on a failed extraction)", () => {
    show(
      list(
        item(1, { ...NOTHING_READ, issueDate: "2026-11-02" }, "a.pdf", {
          ocr: { ...NOTHING_READ, state: "fallida" },
          manual: { ...NO_MANUAL, issueDate: "2026-11-02" },
        }),
      ),
    );

    expect(fact(en.extraction.fields.issueDate)).toHaveTextContent(
      "Nov 2, 2026",
    );
    expect(
      within(fact(en.extraction.fields.issueDate)).getByText(badge),
    ).toBeInTheDocument();
    for (const label of [
      en.extraction.fields.studentName,
      en.extraction.fields.issuer,
      en.extraction.fields.restPeriod,
    ]) {
      expect(fact(label)).toHaveTextContent(en.extraction.notRecognized);
    }
    expect(section()).not.toHaveTextContent(en.extraction.states.unavailable);
    expect(within(section()).getAllByText(badge)).toHaveLength(1);
  });

  it("says «Ingresado manualmente» in Spanish", () => {
    show(
      list(item(1, EFFECTIVE_ALL, "a.pdf", { ocr: null, manual: MANUAL_ALL })),
      { locale: "es" },
    );

    expect(
      within(
        screen.getByRole("region", { name: es.detail.sections.extraction }),
      ).getAllByText("Ingresado manualmente"),
    ).toHaveLength(4);
  });
});

describe("ExtractionSection type and marks (RF-14 b, d, MD-26)", () => {
  const notRegistered = en.extraction.markValues.unregistered;

  it("shows the type, the firma and the sello as 'Not registered' when they are null", () => {
    show(list(item(1, COMPLETE)));

    for (const label of [
      en.extraction.marks.type,
      en.extraction.marks.signature,
      en.extraction.marks.seal,
    ]) {
      expect(fact(label), label).toHaveTextContent(notRegistered);
    }
  });

  it("shows the registered type and marks, each with its state (hoja steps b, d)", () => {
    show(
      list(
        item(1, COMPLETE, "a.pdf", {
          marks: {
            type: "constancia_medica",
            hasSignature: true,
            hasSeal: null,
          },
        }),
      ),
    );

    expect(fact(en.extraction.marks.type)).toHaveTextContent(
      "Medical certificate",
    );
    expect(fact(en.extraction.marks.signature)).toHaveTextContent("Yes");
    expect(fact(en.extraction.marks.seal)).toHaveTextContent(notRegistered);
  });

  it("tells 'No' from 'Not registered'", () => {
    show(
      list(
        item(1, COMPLETE, "a.pdf", {
          marks: { type: "otro", hasSignature: false, hasSeal: false },
        }),
      ),
    );

    expect(fact(en.extraction.marks.signature).textContent).toBe("No");
    expect(fact(en.extraction.marks.seal).textContent).toBe("No");
    expect(fact(en.extraction.marks.type)).toHaveTextContent("Other");
  });

  it("speaks Spanish", () => {
    show(
      list(
        item(1, COMPLETE, "a.pdf", {
          marks: {
            type: "constancia_institucional",
            hasSignature: true,
            hasSeal: null,
          },
        }),
      ),
      { locale: "es" },
    );
    const root = screen.getByRole("region", {
      name: es.detail.sections.extraction,
    });

    expect(fact("Tipo de documento", root)).toHaveTextContent(
      "Constancia institucional",
    );
    expect(fact("Firma", root)).toHaveTextContent("Sí");
    expect(fact("Sello", root)).toHaveTextContent("Sin registrar");
  });

  it.each<[string, ExtractionRowView | null, "pendiente" | "aprobada"]>([
    ["an extracting document", null, "pendiente"],
    ["an unavailable document", { ...COMPLETE, state: "fallida" }, "pendiente"],
    ["a document of a decided request", COMPLETE, "aprobada"],
  ])("shows the marks for %s", (_label, row, requestState) => {
    show(
      list(
        item(1, row, "a.pdf", {
          marks: { type: "otro", hasSignature: true, hasSeal: false },
        }),
      ),
      { requestState },
    );

    expect(fact(en.extraction.marks.type)).toHaveTextContent("Other");
    expect(fact(en.extraction.marks.signature)).toHaveTextContent("Yes");
    expect(fact(en.extraction.marks.seal).textContent).toBe("No");
  });
});

describe("ExtractionSection manual data form (RF-14 c, MD-23, MD-27)", () => {
  it.each<[string, ExtractionRowView | null, boolean]>([
    ["completed data", COMPLETE, true],
    ["a processing row", { ...COMPLETE, state: "procesando" }, true],
    ["a missing row", null, true],
    ["a failed row", { ...COMPLETE, state: "fallida" }, true],
    ["extraction not configured", null, false],
  ])(
    "offers the form for %s while the request can be edited",
    (_label, row, configured) => {
      show(list(item(1, row)), { editable: true, configured });

      expect(
        within(section()).getByRole("button", { name: openLabel }),
      ).toBeInTheDocument();
    },
  );

  it("lists a document waiting for the setting with its form, the notice once and no state text (RF-14 c)", () => {
    show(list(item(1, null, "a.pdf"), item(2, null, "b.jpg")), {
      editable: true,
      configured: false,
    });

    expect(
      within(section()).getAllByText(en.extraction.states.notConfigured),
    ).toHaveLength(1);
    expect(
      within(section())
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["a.pdf", "b.jpg"]);
    expect(
      within(section()).getAllByRole("button", { name: openLabel }),
    ).toHaveLength(2);
    expect(section()).not.toHaveTextContent(en.extraction.states.extracting);
    expect(section()).not.toHaveTextContent(en.extraction.states.unavailable);
    expect(section().textContent).not.toMatch(/EXTRACTION_API|url/i);
  });

  it("does not list a document waiting for the setting when the request cannot be edited", () => {
    show(list(item(1, null, "a.pdf")), { editable: false, configured: false });

    expect(
      within(section()).getAllByText(en.extraction.states.notConfigured),
    ).toHaveLength(1);
    expect(within(section()).queryAllByRole("heading", { level: 3 })).toEqual(
      [],
    );
    expect(within(section()).queryAllByRole("button")).toEqual([]);
  });

  it("offers one form per current document, and each one names its document", async () => {
    show(
      list(
        item(1, COMPLETE, "a.pdf"),
        item(2, null, "b.jpg"),
        item(3, { ...COMPLETE, state: "fallida" }, "c.png"),
      ),
      { editable: true },
    );
    const user = userEvent.setup();

    const buttons = within(section()).getAllByRole("button", {
      name: openLabel,
    });
    expect(buttons).toHaveLength(3);
    await user.click(buttons[1]);

    const form = await within(section()).findByRole("form", {
      name: en.extraction.form.formLabel.replace("{name}", "b.jpg"),
    });
    expect(
      (form.querySelector('input[name="solicitudId"]') as HTMLInputElement)
        .value,
    ).toBe("12");
    expect(
      (form.querySelector('input[name="documentoId"]') as HTMLInputElement)
        .value,
    ).toBe("2");
    expect(within(section()).getAllByRole("form")).toHaveLength(1);
  });

  it("prefills the manual values and shows the extracted ones as a reference", async () => {
    show(
      list(
        item(1, { ...COMPLETE, issuer: "Clinica Santa Fe" }, "a.pdf", {
          ocr: COMPLETE,
          manual: { ...NO_MANUAL, issuer: "Clinica Santa Fe" },
          marks: {
            type: "constancia_medica",
            hasSignature: true,
            hasSeal: false,
          },
        }),
      ),
      { editable: true },
    );
    const user = userEvent.setup();
    await user.click(
      within(section()).getByRole("button", { name: openLabel }),
    );

    const form = await within(section()).findByRole("form");
    expect(
      within(form).getByRole("textbox", { name: en.extraction.fields.issuer }),
    ).toHaveValue("Clinica Santa Fe");
    expect(
      within(form).getByRole("textbox", {
        name: en.extraction.form.fields.studentName,
      }),
    ).toHaveValue("");
    expect(form).toHaveTextContent("Extracted value: Ana Lopez");
    expect(form).toHaveTextContent("Extracted value: Clinica Central");
    expect(
      within(form).getByRole("combobox", { name: en.extraction.marks.type }),
    ).toHaveTextContent("Medical certificate");
  });

  it("offers no form when the request cannot be edited, and shows the values read-only", () => {
    show(
      list(item(1, EFFECTIVE_ALL, "a.pdf", { ocr: null, manual: MANUAL_ALL })),
      { requestState: "aprobada", editable: false },
    );

    expect(within(section()).queryAllByRole("button")).toEqual([]);
    expect(within(section()).queryAllByRole("textbox")).toEqual([]);
    expect(within(section()).queryAllByRole("form")).toEqual([]);
    expect(fact(en.extraction.fields.issuer)).toHaveTextContent(
      "Clinica Santa Fe",
    );
    expect(within(section()).getAllByText(badge)).toHaveLength(4);
  });

  it("offers no form with the degraded notice, even when the request can be edited (Degraded read shows no form)", () => {
    show({ data: [item(1, COMPLETE)], degraded: true }, { editable: true });

    expect(
      within(section()).getByText(en.extraction.degraded),
    ).toBeInTheDocument();
    expect(within(section()).queryAllByRole("button")).toEqual([]);
  });

  it("keeps the title the section already had (decision 0.1 b)", () => {
    // The spec calls the section «Datos extraídos»; the shipped Spanish title
    // is «Datos leídos del documento». Decision 0.1 b keeps what is shipped.
    show(list(item(1, COMPLETE)), { locale: "es" });

    expect(
      screen.getByRole("region", { name: "Datos leídos del documento" }),
    ).toBeInTheDocument();
    expect(en.detail.sections.extraction).toBe("Extracted data");
  });
});

describe("ExtractionSection form remount (the form key)", () => {
  function Harness() {
    const [manual, setManual] = useState<ManualFields>({
      ...MANUAL_ALL,
      issuer: "Clinica A",
    });
    const [marks, setMarks] = useState<DocumentMarks>(NO_MARKS);
    return (
      <>
        <button onClick={() => setManual({ ...manual })}>same values</button>
        <button onClick={() => setManual({ ...manual, issuer: "Clinica B" })}>
          other issuer
        </button>
        <button onClick={() => setMarks({ ...marks, hasSeal: true })}>
          other mark
        </button>
        <ExtractionSection
          solicitudId={12}
          extractions={list(
            item(1, { ...EFFECTIVE_ALL, issuer: manual.issuer }, "a.pdf", {
              ocr: null,
              manual,
              marks,
            }),
          )}
          requestState="pendiente"
          configured
          editable
        />
      </>
    );
  }

  async function opened() {
    renderIntl(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: openLabel }));
    await screen.findByRole("form");
    return user;
  }

  it("stays open when the stored values are the same", async () => {
    const user = await opened();

    await user.click(screen.getByRole("button", { name: "same values" }));

    expect(screen.getByRole("form")).toBeInTheDocument();
  });

  it.each(["other issuer", "other mark"])(
    "remounts closed when the stored values change (%s)",
    async (change) => {
      const user = await opened();

      await user.click(screen.getByRole("button", { name: change }));

      expect(screen.queryByRole("form")).toBeNull();
      expect(screen.getByRole("button", { name: openLabel })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    },
  );
});
