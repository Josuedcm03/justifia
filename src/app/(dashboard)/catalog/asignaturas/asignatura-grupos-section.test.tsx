import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AsignaturaGruposSection,
  type AsignaturaGruposLabels,
} from "@/app/(dashboard)/catalog/asignaturas/asignatura-grupos-section";
import type { GrupoRow } from "@/app/(dashboard)/catalog/asignaturas/asignatura-grupos-table";
import type { AsignaturaGruposResult } from "@/lib/catalog/types";
import { resetNavigationMock } from "@/test/navigation-mock";

const { tableProps } = vi.hoisted(() => ({
  tableProps: vi.fn(),
}));

vi.mock(
  "next/link",
  async () => (await import("@/test/navigation-mock")).linkModule,
);
// The table is a client module of its own (tested separately); here only what
// the server part hands it matters.
vi.mock(
  "@/app/(dashboard)/catalog/asignaturas/asignatura-grupos-table",
  () => ({
    AsignaturaGruposTable: (props: {
      rows: readonly GrupoRow[];
      asignaturaId: number;
      caption: string;
    }) => {
      tableProps(props);
      return <div data-testid="grupos-table">{props.caption}</div>;
    },
  }),
);

beforeEach(() => {
  resetNavigationMock();
  tableProps.mockReset();
});

const LABELS: AsignaturaGruposLabels = {
  title: "Groups",
  add: "Add group",
  empty: "No groups yet.",
  inactiveHint: "Reactivate the subject first.",
  tableCaption: "Groups of MAT101",
  truncated: "Showing the 100 most recent groups.",
  degraded: "Could not load the groups.",
};

function grupo(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    asignaturaId: 12,
    asignaturaCodigo: "MAT101",
    asignaturaNombre: "Calculus",
    periodo: "2026-S2",
    numeroGrupo: "A",
    docenteId: 5,
    docenteNombre: "Ana Pérez",
    activo: true,
    origen: "manual" as const,
    dias: ["lunes"] as const,
    ...overrides,
  };
}

function result(
  overrides: Partial<AsignaturaGruposResult> = {},
): AsignaturaGruposResult {
  return { data: [], truncated: false, degraded: false, ...overrides };
}

function renderSection({
  value = result(),
  activo = true,
}: { value?: AsignaturaGruposResult; activo?: boolean } = {}) {
  return render(
    <AsignaturaGruposSection
      result={value}
      asignaturaId={12}
      activo={activo}
      labels={LABELS}
    />,
  );
}

const region = () => screen.getByRole("region", { name: LABELS.title });

describe("AsignaturaGruposSection (server part)", () => {
  it("is a server module: no client directive and no hook", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/catalog/asignaturas/asignatura-grupos-section.tsx",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/^\s*["']use client["']/m);
    expect(source).not.toMatch(/useTranslations|useMemo|useState/);
  });

  it("hands the table the given order, the Asignatura id and the caption, with only displayed fields", () => {
    const data = [
      grupo(31),
      grupo(30, { periodo: "2026-S1", activo: false }),
      grupo(29, { periodo: "2025-S2", dias: [] }),
    ];
    renderSection({ value: result({ data }) });

    expect(tableProps).toHaveBeenCalledTimes(1);
    const props = tableProps.mock.calls[0][0];
    expect(props.asignaturaId).toBe(12);
    expect(props.caption).toBe(LABELS.tableCaption);
    expect(props.rows.map((r: GrupoRow) => r.id)).toEqual([31, 30, 29]);
    for (const r of props.rows) {
      expect(Object.keys(r).sort()).toEqual(
        [
          "activo",
          "dias",
          "docenteNombre",
          "id",
          "numeroGrupo",
          "periodo",
        ].sort(),
      );
    }
    // Plain data only: nothing callable travels to the client module.
    expect(
      Object.values(props).some((value) => typeof value === "function"),
    ).toBe(false);
  });

  it("renders the heading, one add link in the header and the table", () => {
    renderSection({ value: result({ data: [grupo(31)] }) });

    const section = within(region());
    expect(
      section.getByRole("heading", { level: 2, name: LABELS.title }),
    ).toBeInTheDocument();
    expect(section.getAllByRole("link", { name: LABELS.add })).toHaveLength(1);
    expect(section.getByRole("link", { name: LABELS.add })).toHaveAttribute(
      "href",
      "/catalog/asignaturas/12/grupos/new",
    );
    expect(section.getByTestId("grupos-table")).toBeInTheDocument();
    expect(section.queryByText(LABELS.inactiveHint)).toBeNull();
  });

  it("an inactive subject shows the hint and no add link", () => {
    renderSection({ value: result({ data: [grupo(31)] }), activo: false });

    const section = within(region());
    expect(section.getByText(LABELS.inactiveHint)).toBeInTheDocument();
    expect(section.queryByRole("link", { name: LABELS.add })).toBeNull();
  });

  it("a failed read shows the shared status alert, no table and no empty sentence", () => {
    renderSection({ value: result({ degraded: true }) });

    const section = within(region());
    expect(section.getByRole("status")).toHaveTextContent(LABELS.degraded);
    expect(section.queryByTestId("grupos-table")).toBeNull();
    expect(section.queryByText(LABELS.empty)).toBeNull();
    expect(tableProps).not.toHaveBeenCalled();
  });

  it("no groups shows the empty sentence with the add action only while active", () => {
    const { unmount } = renderSection();
    expect(within(region()).getByText(LABELS.empty)).toBeInTheDocument();
    expect(
      within(region()).getAllByRole("link", { name: LABELS.add }),
    ).toHaveLength(1);
    expect(screen.queryByTestId("grupos-table")).toBeNull();
    unmount();

    renderSection({ activo: false });
    expect(within(region()).getByText(LABELS.empty)).toBeInTheDocument();
    expect(
      within(region()).queryByRole("link", { name: LABELS.add }),
    ).toBeNull();
  });

  it("shows the cap note after the table only when the read was cut (CM-ASG-7)", () => {
    const { unmount } = renderSection({
      value: result({ data: [grupo(31)], truncated: true }),
    });
    const note = within(region()).getByText(LABELS.truncated);
    expect(
      screen.getByTestId("grupos-table").compareDocumentPosition(note) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    unmount();

    renderSection({ value: result({ data: [grupo(31)] }) });
    expect(within(region()).queryByText(LABELS.truncated)).toBeNull();
  });
});
