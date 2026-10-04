import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import { ImportErrors } from "@/app/(dashboard)/catalog/import/import-errors";
import {
  MAX_ACCOUNT_EVENTS_PER_APPLY,
  MAX_NEW_ACCOUNTS_PER_APPLY,
} from "@/lib/import/limits";
import type { RowError } from "@/lib/import/types";

const en = enMessages.catalog.import;
const es = esMessages.catalog.import;

const ONE: RowError[] = [
  { sheet: "Grupos", row: 4, reason: "periodo.invalid", value: "2026-S3" },
];
const THREE: RowError[] = [
  ...ONE,
  { sheet: "Asignaturas", row: 7, reason: "horasTotales.invalid", value: "0" },
  { sheet: "Docentes", row: 9, reason: "correo.duplicate" },
];

function renderErrors(errors: RowError[], locale: "en" | "es" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : esMessages}
      // A missing key must fail the test instead of rendering its path.
      onError={(error) => {
        throw error;
      }}
    >
      <ImportErrors errors={errors} />
    </NextIntlClientProvider>,
  );
}

const cellsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      Array.from(row.querySelectorAll("th, td")).map(
        (cell) => cell.textContent,
      ),
    );

describe("ImportErrors (CEI: Preview with errors blocks confirmation)", () => {
  it.each([
    ["en", ONE, "1 error found in the workbook"],
    ["en", THREE, "3 errors found in the workbook"],
    ["es", ONE, "Se encontró 1 error en el libro"],
    ["es", THREE, "Se encontraron 3 errores en el libro"],
  ] as const)(
    "counts the errors in its h2, in %s (%#)",
    (locale, errors, title) => {
      renderErrors([...errors], locale);

      const block = screen.getByRole("region", { name: title });
      expect(block.tagName).toBe("SECTION");
      expect(
        within(block).getByRole("heading", { level: 2, name: title }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    ["en", en],
    ["es", es],
  ] as const)("says what to do next, in %s", (locale, copy) => {
    renderErrors(THREE, locale);

    const help = screen.getByText(copy.errorsPanel.help);
    const heading = screen.getByRole("heading", { level: 2 });
    // Read together with the heading when focus lands on it.
    expect(heading.getAttribute("aria-describedby")).toBe(help.id);
    // The centred summary: heading and instruction share one centred block.
    expect(help.parentElement).toBe(heading.parentElement);
    expect(help.parentElement).toHaveClass("text-center", "items-center");
  });

  it("lets the caller move focus to a heading that shows a focus ring", () => {
    renderErrors(THREE);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading.className).toContain("focus-visible:ring-2");
    expect(heading.className).toContain("scroll-mt-20");
  });

  it("lists every error with sheet, row, translated reason and value", () => {
    renderErrors(THREE);

    const block = screen.getByRole("region");
    const table = within(block).getByRole("table", {
      name: en.errorsPanel.caption,
    });
    expect(cellsOf(table)).toEqual([
      [
        en.errorsPanel.columns.sheet,
        en.errorsPanel.columns.row,
        en.errorsPanel.columns.reason,
        en.errorsPanel.columns.value,
      ],
      ["Grupos", "4", en.reasons.periodo.invalid, "2026-S3"],
      ["Asignaturas", "7", en.reasons.horasTotales.invalid, "0"],
      ["Docentes", "9", en.reasons.correo.duplicate, ""],
    ]);
    // The summary comes first, the table after it.
    const heading = within(block).getByRole("heading", { level: 2 });
    expect(
      heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("translates the reasons in Spanish", () => {
    renderErrors(ONE, "es");

    const table = screen.getByRole("table", { name: es.errorsPanel.caption });
    expect(cellsOf(table)[1]).toEqual([
      "Grupos",
      "4",
      es.reasons.periodo.invalid,
      "2026-S3",
    ]);
  });

  it("falls back to the raw code for a reason the catalog does not know", () => {
    renderErrors([{ sheet: "Grupos", row: 2, reason: "Invalid input" }]);

    expect(screen.getByText("Invalid input")).toBeInTheDocument();
  });

  it("states the import caps from the real limits, with no row number for a workbook-wide error", () => {
    renderErrors([
      { sheet: "Docentes", row: 0, reason: "accountsToCreate.capExceeded" },
      { sheet: "Docentes", row: 0, reason: "accountEvents.capExceeded" },
    ]);

    expect(
      screen.getByText(
        `More than ${MAX_NEW_ACCOUNTS_PER_APPLY} new accounts would be created in a single import. Split the workbook into smaller parts.`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `The import would create or modify more than ${MAX_ACCOUNT_EVENTS_PER_APPLY} accounts. Split the workbook into smaller parts.`,
      ),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", { name: en.errorsPanel.caption });
    expect(cellsOf(table)[1][1]).toBe("—");
  });

  it("uses the destructive pair through tokens only, never the lime", () => {
    const { container } = renderErrors(THREE);

    const block = screen.getByRole("region");
    expect(block).toHaveClass("border-destructive/30", "bg-destructive/8");
    expect(container.innerHTML).not.toContain("highlight");
    expect(container.innerHTML).not.toMatch(/dark:bg-/);
    expect(container.innerHTML).not.toContain("shadow");
  });
});
