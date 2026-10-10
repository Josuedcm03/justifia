import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import { WorkbookContract } from "@/app/(dashboard)/catalog/import/workbook-contract";
import { SHEETS } from "@/lib/import/sheets";

const en = enMessages.catalog.import.contract;
const es = esMessages.catalog.import.contract;

function renderContract(locale: "en" | "es" = "en", children?: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : esMessages}
      // A missing key must fail the test instead of rendering its path.
      onError={(error) => {
        throw error;
      }}
    >
      <WorkbookContract>{children}</WorkbookContract>
    </NextIntlClientProvider>,
  );
}

const captionFor = (copy: typeof en, sheet: string) =>
  copy.columnsCaption.replace("{sheet}", sheet);

describe("WorkbookContract (CEI: Contract shown before upload)", () => {
  it("titles the panel with an h2 and names the three sheets, in order, as h3", () => {
    renderContract();

    const contract = screen.getByRole("region", { name: en.title });
    expect(
      within(contract).getByRole("heading", { level: 2, name: en.title }),
    ).toBeInTheDocument();

    const sheetList = contract.querySelector("ol") as HTMLElement;
    const sheets = within(sheetList).getAllByRole("heading", { level: 3 });
    expect(sheets.map((h) => h.textContent)).toEqual([
      "Asignaturas",
      "Docentes",
      "Grupos",
    ]);
    expect(sheets.map((h) => h.textContent)).toEqual(SHEETS.map((s) => s.name));
  });

  it.each(SHEETS.map((sheet) => [sheet.name, sheet] as const))(
    "draws %s as a header row: required columns first, then optional ones",
    (_name, sheet) => {
      renderContract();

      const table = screen.getByRole("table", {
        name: captionFor(en, sheet.name),
      });
      const headers = within(table).getAllByRole("columnheader");

      expect(headers.map((th) => th.firstElementChild?.textContent)).toEqual([
        ...sheet.required,
        ...sheet.optional,
      ]);
      for (const th of headers) expect(th).toHaveAttribute("scope", "col");
      // A header strip only: the contract shows row 1, never data.
      expect(within(table).getAllByRole("row")).toHaveLength(1);
    },
  );

  it("marks optional columns with text, and required ones with nothing", () => {
    renderContract();

    for (const sheet of SHEETS) {
      const table = screen.getByRole("table", {
        name: captionFor(en, sheet.name),
      });
      const headers = within(table).getAllByRole("columnheader");
      const marked = headers
        .filter((th) => within(th).queryByText(en.optional) !== null)
        .map((th) => th.firstElementChild?.textContent);

      expect(marked).toEqual([...sheet.optional]);
    }
    // The contract has exactly two optional columns: Docentes.Telefono and
    // Grupos.Dias (CEI-DIAS-4).
    expect(screen.getAllByText(en.optional)).toHaveLength(2);
  });

  it("lists Dias among the optional Grupos columns (CEI-DIAS-4)", () => {
    renderContract();

    const grupos = screen.getByRole("table", {
      name: captionFor(en, "Grupos"),
    });
    expect(
      within(grupos)
        .getAllByRole("columnheader")
        .map((th) => th.firstElementChild?.textContent),
    ).toEqual([
      "CodigoAsignatura",
      "Periodo",
      "NumGrupo",
      "CorreoDocente",
      "Dias",
    ]);
  });

  it("shows every sheet at once and explains the optional convention", () => {
    renderContract();

    expect(screen.getAllByRole("table")).toHaveLength(SHEETS.length);
    for (const table of screen.getAllByRole("table")) {
      expect(table).toBeVisible();
    }
    expect(screen.getByText(en.legend)).toBeInTheDocument();
  });

  it("lets a keyboard user scroll each header strip", () => {
    renderContract();

    for (const sheet of SHEETS) {
      const scroller = screen.getByRole("region", {
        name: captionFor(en, sheet.name),
      });
      expect(scroller).toHaveAttribute("tabindex", "0");
      expect(scroller.className).toContain("focus-visible:ring");
      expect(scroller.className).toContain("overflow-x-auto");
    }
  });

  it("lists the seven validation rules under their own h3", () => {
    renderContract();

    expect(
      screen.getByRole("heading", { level: 3, name: en.rulesTitle }),
    ).toBeInTheDocument();
    for (const rule of Object.values(en.rules)) {
      expect(screen.getByText(rule)).toBeInTheDocument();
    }
    expect(Object.keys(en.rules)).toHaveLength(7);
  });

  it.each([
    ["en", en],
    ["es", es],
  ] as const)(
    "states the Dias tokens and what Dias does as list items of the rules, before any file is chosen, in %s (CEI-DIAS-4)",
    (locale, copy) => {
      renderContract(locale);

      const rules = screen
        .getByRole("heading", { level: 3, name: copy.rulesTitle })
        .parentElement!.querySelector("ul") as HTMLElement;
      const items = within(rules)
        .getAllByRole("listitem")
        .map((li) => li.textContent);

      expect(items).toHaveLength(7);
      expect(items.slice(-2)).toEqual([
        copy.rules.diasTokens,
        copy.rules.diasEffect,
      ]);
    },
  );

  it("offers the template through the guarded route", () => {
    renderContract();

    expect(screen.getByRole("link", { name: en.template })).toHaveAttribute(
      "href",
      "/api/catalog/template",
    );
  });

  it("tints the template link with the theme-aware accent pair", () => {
    renderContract();

    // `accent` and `accent-foreground` are redefined per theme, so the same
    // two classes carry light and dark; a hardcoded `dark:` surface would not.
    const link = screen.getByRole("link", { name: en.template });
    expect(link).toHaveClass("bg-accent", "text-accent-foreground");
    expect(link.className).not.toMatch(/dark:bg-/);
  });

  it("renders its children as the last block of the card, after the rules", () => {
    renderContract("en", <div data-testid="slot" />);

    const contract = screen.getByRole("region", { name: en.title });
    expect(contract.tagName).toBe("SECTION");
    const slot = within(contract).getByTestId("slot");
    const rules = within(contract).getByText(en.rules.noId);
    expect(
      rules.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(contract.lastElementChild).toBe(slot);
  });

  it("never uses the current-location marker", () => {
    const { container } = renderContract();

    expect(container.innerHTML).not.toContain("is-current");
  });

  it("renders in Spanish with the untranslated Excel headers", () => {
    renderContract("es");

    expect(screen.getByRole("region", { name: es.title })).toBeInTheDocument();
    const docentes = screen.getByRole("table", {
      name: captionFor(es, "Docentes"),
    });
    expect(
      within(docentes)
        .getAllByRole("columnheader")
        .map((th) => th.firstElementChild?.textContent),
    ).toEqual(["Correo", "Nombre", "Telefono"]);
    expect(within(docentes).getByText(es.optional)).toBeInTheDocument();
    expect(screen.getByText(es.legend)).toBeInTheDocument();
  });
});
