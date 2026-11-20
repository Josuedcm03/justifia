import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { DocumentMarksSection } from "@/app/(dashboard)/coordination/[id]/document-marks-section";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";
import type {
  DocumentMarksItem,
  DocumentMarksList,
} from "@/lib/data/document-marks-read";

// MD-30: the read-only block of the coordination detail. It is a pure view of
// the narrow read: the type, the firma and the sello of each current document,
// as text, with no control and no registered or extracted value (RF-10 c,
// RF-14 b, RF-14 d, RNF-01, RNF-02).

const en = messages.en.coordination.detail;
const es = messages.es.coordination.detail;

function item(
  id: number,
  marks: Partial<Pick<DocumentMarksItem, "type" | "hasSignature" | "hasSeal">>,
  nombreOriginal = `doc-${id}.pdf`,
): DocumentMarksItem {
  return {
    documentoId: id,
    nombreOriginal,
    type: null,
    hasSignature: null,
    hasSeal: null,
    ...marks,
  };
}

function list(...data: DocumentMarksItem[]): DocumentMarksList {
  return { data, degraded: false };
}

function show(marks: DocumentMarksList, locale: "es" | "en" = "en") {
  return renderIntl(<DocumentMarksSection marks={marks} />, locale);
}

const region = (name = en.sections.marks) =>
  screen.getByRole("region", { name });

function fact(label: string, root: HTMLElement = region()) {
  const term = within(root).getByText(label, { selector: "dt" });
  return term.nextElementSibling as HTMLElement;
}

describe("DocumentMarksSection (MD-30 Type and marks shown read-only)", () => {
  it("shows the type, the firma and the sello of a document as text", () => {
    show(
      list(
        item(
          1,
          { type: "constancia_medica", hasSignature: false, hasSeal: true },
          "constancia.pdf",
        ),
      ),
    );

    expect(
      within(region()).getByRole("heading", {
        level: 3,
        name: "constancia.pdf",
      }),
    ).toBeInTheDocument();
    expect(fact(en.marks.type)).toHaveTextContent("Medical certificate");
    expect(fact(en.marks.signature)).toHaveTextContent("No");
    expect(fact(en.marks.seal)).toHaveTextContent("Yes");
  });

  it("reads Sin registrar for a type and two marks that are not registered (Unregistered data reads as such)", () => {
    show(list(item(1, {})), "es");

    const root = region(es.sections.marks);
    expect(fact(es.marks.type, root)).toHaveTextContent("Sin registrar");
    expect(fact(es.marks.signature, root)).toHaveTextContent("Sin registrar");
    expect(fact(es.marks.seal, root)).toHaveTextContent("Sin registrar");
  });

  it("renders the Spanish wording of the type and the marks the secretary sees", () => {
    show(
      list(
        item(1, {
          type: "constancia_institucional",
          hasSignature: true,
          hasSeal: false,
        }),
      ),
      "es",
    );

    const root = region(es.sections.marks);
    expect(fact(es.marks.type, root)).toHaveTextContent(
      "Constancia institucional",
    );
    expect(fact(es.marks.signature, root)).toHaveTextContent("Sí");
    expect(fact(es.marks.seal, root)).toHaveTextContent("No");
  });

  it.each([
    ["constancia_medica", "Constancia médica"],
    ["constancia_institucional", "Constancia institucional"],
    ["otro", "Otro"],
  ] as const)("words the type %s as %s", (type, text) => {
    show(list(item(1, { type })), "es");

    expect(fact(es.marks.type, region(es.sections.marks))).toHaveTextContent(
      text,
    );
  });

  it("keeps the three states of a mark apart across the documents", () => {
    show(
      list(
        item(1, { hasSignature: true, hasSeal: null }),
        item(2, { hasSignature: false, hasSeal: true }),
        item(3, { hasSignature: null, hasSeal: false }),
      ),
    );

    const entries = within(region()).getAllByRole("listitem");
    expect(entries).toHaveLength(3);
    const read = (entry: HTMLElement, label: string) =>
      (
        within(entry).getByText(label, { selector: "dt" })
          .nextElementSibling as HTMLElement
      ).textContent;
    expect(entries.map((e) => read(e, en.marks.signature))).toEqual([
      "Yes",
      "No",
      "Not registered",
    ]);
    expect(entries.map((e) => read(e, en.marks.seal))).toEqual([
      "Not registered",
      "Yes",
      "No",
    ]);
  });

  it("offers no control: no button, link, input, select or form", () => {
    show(
      list(
        item(1, { type: "otro", hasSignature: true, hasSeal: true }),
        item(2, {}),
      ),
    );

    const root = region();
    expect(within(root).queryAllByRole("button")).toHaveLength(0);
    expect(within(root).queryAllByRole("link")).toHaveLength(0);
    expect(within(root).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(root).queryAllByRole("radio")).toHaveLength(0);
    expect(within(root).queryAllByRole("combobox")).toHaveLength(0);
    expect(root.querySelector("form, input, select, textarea, button, a")).toBe(
      null,
    );
  });

  it("shows no name, issuer, date or rest even if the item carried them (Registered values stay hidden)", () => {
    const leaky = {
      ...item(1, {
        type: "constancia_medica",
        hasSignature: true,
        hasSeal: true,
      }),
      studentName: "Ana Lopez",
      issuer: "Clinica Central",
      issueDate: "2026-10-19",
      restFrom: "2026-10-19",
      restTo: "2026-10-23",
      restDays: 5,
      manual: { issuer: "Hospital Nuevo" },
    } as DocumentMarksItem;

    show(list(leaky));

    const text = region().textContent ?? "";
    for (const value of [
      "Ana Lopez",
      "Clinica Central",
      "Hospital Nuevo",
      "2026",
      "Oct",
      "5 days",
    ]) {
      expect(text).not.toContain(value);
    }
    expect(text).not.toMatch(/issuer|rest|issue date|student name/i);
  });

  it("explains in a sentence that the data is registered by the secretary and cannot be changed here", () => {
    show(list(item(1, {})));

    expect(region()).toHaveTextContent(en.marks.note);
    expect(en.marks.note).toMatch(/secretary/i);
  });

  it("renders nothing when the request has no current document", () => {
    const { container } = show(list());

    expect(container).toBeEmptyDOMElement();
  });

  it("replaces the entries with one degraded notice when the read failed", () => {
    show({ data: [], degraded: true });

    const root = region();
    expect(within(root).getByRole("status")).toHaveTextContent(
      en.marksDegraded,
    );
    expect(within(root).queryAllByRole("listitem")).toHaveLength(0);
    expect(root).not.toHaveTextContent(en.marks.note);
  });

  it("gives the degraded notice in neutral Spanish", () => {
    show({ data: [], degraded: true }, "es");

    expect(
      within(region(es.sections.marks)).getByRole("status"),
    ).toHaveTextContent(es.marksDegraded);
  });

  it("has no accessibility violation", async () => {
    const { container } = show(
      list(
        item(1, {
          type: "constancia_medica",
          hasSignature: true,
          hasSeal: false,
        }),
        item(2, {}),
      ),
    );

    // jsdom has no layout, so contrast cannot be computed here; the design
    // system measures the tokens.
    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});
