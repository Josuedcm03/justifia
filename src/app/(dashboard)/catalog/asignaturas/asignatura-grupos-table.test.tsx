import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AsignaturaGruposTable,
  type GrupoRow,
} from "@/app/(dashboard)/catalog/asignaturas/asignatura-grupos-table";
import { messages, renderWithIntl, type TestLocale } from "@/test/intl";
import { resetNavigationMock, router } from "@/test/navigation-mock";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation-mock")).module,
);
vi.mock(
  "next/link",
  async () => (await import("@/test/navigation-mock")).linkModule,
);

beforeEach(() => {
  resetNavigationMock();
});

function row(overrides: Partial<GrupoRow> = {}): GrupoRow {
  return {
    id: 31,
    periodo: "2026-S2",
    numeroGrupo: "A",
    docenteNombre: "Ana Pérez",
    activo: true,
    dias: ["lunes", "jueves"],
    ...overrides,
  };
}

/** Newest period first, as the read answers them; the table never reorders. */
const ROWS: GrupoRow[] = [
  row(),
  row({
    id: 30,
    periodo: "2026-S1",
    numeroGrupo: "B",
    docenteNombre: "Luis Gómez",
    activo: false,
    dias: ["sabado"],
  }),
  row({ id: 29, periodo: "2025-S2", dias: [] }),
];

function renderTable({
  rows = ROWS,
  asignaturaId = 12,
  caption = "Groups of MAT101",
  locale = "en",
}: {
  rows?: readonly GrupoRow[];
  asignaturaId?: number;
  caption?: string;
  locale?: TestLocale;
} = {}) {
  return renderWithIntl(
    <AsignaturaGruposTable
      rows={rows}
      asignaturaId={asignaturaId}
      caption={caption}
    />,
    locale,
  );
}

describe.each(["es", "en"] as const)(
  "AsignaturaGruposTable in %s (DT-MODE-1 bounded mode)",
  (locale) => {
    const copy = messages[locale].catalog.asignaturas.grupos;
    const shared = messages[locale].catalog.shared;

    it("names the table with the caption it receives and takes headers from the catalog", () => {
      renderTable({ locale, caption: "Caption from the page" });

      const table = screen.getByRole("table", {
        name: "Caption from the page",
      });
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual([
        copy.columns.periodo,
        copy.columns.numeroGrupo,
        copy.columns.docente,
        copy.columns.dias,
        copy.columns.status,
        copy.columns.actions,
      ]);
    });

    it("has no sort control, no pagination, no toolbar and no URL parameter", () => {
      renderTable({ locale });

      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("search")).toBeNull();
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByRole("combobox")).toBeNull();
      expect(screen.queryByRole("textbox")).toBeNull();
      for (const header of screen.getAllByRole("columnheader")) {
        expect(header).not.toHaveAttribute("aria-sort");
      }
      expect(router.push).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it("keeps the row order it receives", () => {
      renderTable({ locale });

      const [, ...rows] = screen.getAllByRole("row");
      expect(
        rows.map((r) => within(r).getAllByRole("cell")[0].textContent),
      ).toEqual(["2026-S2", "2026-S1", "2025-S2"]);
    });

    it("shows period, number, teacher, status labels and the day names from the catalog", () => {
      renderTable({ locale });

      const [, first, second, third] = screen.getAllByRole("row");
      const a = within(first).getAllByRole("cell");
      expect(a[1]).toHaveTextContent("A");
      expect(a[2]).toHaveTextContent("Ana Pérez");
      expect(a[4]).toHaveTextContent(shared.status.active);
      expect(
        within(a[3]).getByText(
          `${shared.dias.short.lunes}, ${shared.dias.short.jueves}`,
        ),
      ).toHaveAttribute("aria-hidden", "true");
      expect(
        within(a[3]).getByText(
          `${shared.dias.long.lunes}, ${shared.dias.long.jueves}`,
        ),
      ).toHaveClass("sr-only");

      const b = within(second).getAllByRole("cell");
      expect(b[4]).toHaveTextContent(shared.status.inactive);
      expect(within(b[3]).getByText(shared.dias.short.sabado)).toBeVisible();

      expect(
        within(within(third).getAllByRole("cell")[3]).getByText(
          shared.dias.notSet,
        ),
      ).toBeVisible();
    });

    it("links each row to its own edit page under the given Asignatura, named by period and number", () => {
      renderTable({ locale, asignaturaId: 345 });

      const links = screen.getAllByRole("link");
      expect(links.map((l) => l.getAttribute("href"))).toEqual([
        "/catalog/asignaturas/345/grupos/31/edit",
        "/catalog/asignaturas/345/grupos/30/edit",
        "/catalog/asignaturas/345/grupos/29/edit",
      ]);
      const label = (periodo: string, numeroGrupo: string) =>
        copy.editLabel
          .replace("{periodo}", periodo)
          .replace("{numeroGrupo}", numeroGrupo);
      expect(links.map((l) => l.getAttribute("aria-label"))).toEqual([
        label("2026-S2", "A"),
        label("2026-S1", "B"),
        label("2025-S2", "A"),
      ]);
      for (const link of links) expect(link).toHaveTextContent(copy.edit);
    });

    it("renders nothing for zero rows", () => {
      const { container } = renderTable({ locale, rows: [] });

      expect(container).toBeEmptyDOMElement();
    });
  },
);

describe("GrupoRow (DT-DATA-1)", () => {
  it("accepts only the displayed fields and the id (checked by the compiler)", () => {
    // A field outside the displayed set must not compile, so a column added
    // to the read later never reaches the browser by accident.
    // @ts-expect-error `docenteId` is not part of the row
    const withExtra: GrupoRow = { ...row(), docenteId: 5 };

    expect(withExtra.id).toBe(31);
  });
});
