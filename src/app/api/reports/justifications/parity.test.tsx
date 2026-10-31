// @vitest-environment node
import ExcelJS from "exceljs";
import { PgDialect } from "drizzle-orm/pg-core";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { messages, sessionFor } from "@/app/(dashboard)/review/test-support";
import { createDbDouble, type Step } from "@/lib/data/test-support/db-double";

// CR-XLS-3, RF-13 d: for the same filters the screen total, the workbook summary
// total and the workbook data rows are equal. The REAL detail page and the REAL
// route run against one shared dataset (a scripted database: the project forbids
// executing SQL from unit tests), and the where clause each one sent to the
// database is compared as compiled SQL, so the two cannot filter differently.

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock, scopeMock, holder } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  holder: { current: null as unknown },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "NEXT_LOCALE" ? { name, value: "en" } : undefined,
  }),
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl({
    locale: "en",
  }),
);
vi.mock("@/lib/data/report-scope", () => ({ resolveReportScope: scopeMock }));
vi.mock("@/lib/data/report-reads", () => ({
  recordReportRequestsRead: vi.fn(async () => {}),
  recordReportDownload: vi.fn(async () => {}),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

const SCOPE = { kind: "carrera", carreraId: 3 } as const;
const PAGE_SIZE = 25;
const dialect = new PgDialect();

/** The one shared dataset: the requests every filter set draws its matches from. */
const DATASET = Array.from({ length: 60 }, (_, at) => ({
  request: {
    id: at + 1,
    estudianteNombre: `Student ${at + 1}`,
    estudianteCif: `2021-${String(at + 1).padStart(3, "0")}`,
    causa: "medica",
    estado: "pendiente",
    fechaInicio: "2026-03-02",
    fechaFin: "2026-03-04",
    presentadaEn: new Date("2026-03-05T15:00:00Z"),
  },
  pair: {
    solicitudId: at + 1,
    codigo: "MAT101",
    asignatura: "Calculo I",
    periodo: "2026-S1",
    docente: "Marta Ruiz",
  },
}));

type FilterSet = { name: string; query: string; matching: number };

const FILTER_SETS: FilterSet[] = [
  { name: "no filter", query: "", matching: 60 },
  { name: "a period", query: "?period=2026-S1", matching: 12 },
  {
    name: "period, teacher and cause",
    query: "?period=2026-S2&docente=4&causa=medica",
    matching: 25,
  },
  { name: "a student search", query: "?q=Student", matching: 26 },
  {
    name: "every filter",
    query: "?period=all&docente=9&causa=fuerza_mayor&q=Ana",
    matching: 51,
  },
  { name: "a page boundary", query: "?causa=medica&page=2", matching: 24 },
  { name: "nothing matches", query: "?docente=999", matching: 0 },
];

let Page: (props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => Promise<React.ReactNode>;
let GET: (request: Request) => Promise<Response>;

beforeAll(async () => {
  // The first dynamic import transforms the whole page and route trees.
  Page = (await import("@/app/(dashboard)/reports/requests/page")).default;
  GET = (await import("@/app/api/reports/justifications/route")).GET;
}, 60_000);

beforeEach(() => {
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
});

function scriptDb(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

/** What the detail asks of the database: count, page, classes, options. */
function detailScript(matching: number): Step[] {
  const rows = DATASET.slice(0, matching);
  const shown = rows.slice(0, PAGE_SIZE);
  return matching === 0
    ? [
        { kind: "select", rows: [{ total: 0 }] },
        { kind: "select", rows: [{ periodo: "2026-S1" }] },
        { kind: "select", rows: [] },
      ]
    : [
        { kind: "select", rows: [{ total: matching }] },
        { kind: "select", rows: shown.map((item) => item.request) },
        { kind: "select", rows: shown.map((item) => item.pair) },
        { kind: "select", rows: [{ periodo: "2026-S1" }] },
        { kind: "select", rows: [] },
      ];
}

/** What the file asks of the database: every matching request, then its classes. */
function exportScript(matching: number, hasTeacher: boolean): Step[] {
  const rows = DATASET.slice(0, matching);
  return [
    { kind: "select", rows: rows.map((item) => item.request) },
    ...(hasTeacher
      ? [{ kind: "select", rows: [{ id: 9, name: "Marta Ruiz" }] } as Step]
      : []),
    ...(matching === 0
      ? []
      : [{ kind: "select", rows: rows.map((item) => item.pair) } as Step]),
  ];
}

function params(query: string) {
  return Object.fromEntries(new URLSearchParams(query.slice(1)));
}

async function screenOf(set: FilterSet) {
  const double = scriptDb(detailScript(set.matching));
  const ui = await Page({ searchParams: Promise.resolve(params(set.query)) });
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      {ui}
    </NextIntlClientProvider>,
  );
  const where = dialect.sqlToQuery(double.log[0].where as never);
  return {
    where,
    shownTotal: html.match(/role="status"[^>]*>([^<]*)</)?.[1] ?? null,
    tableRows: (
      html.match(/<tbody[\s\S]*<\/tbody>/)?.[0].match(/<tr[ >]/g) ?? []
    ).length,
  };
}

async function fileOf(set: FilterSet) {
  const double = scriptDb(
    exportScript(set.matching, set.query.includes("docente")),
  );
  const res = await GET(
    new Request(`http://localhost/api/reports/justifications${set.query}`),
  );
  expect(res.status).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(await res.arrayBuffer()) as unknown as ExcelJS.Buffer,
  );
  const summary = workbook.worksheets[1];
  return {
    where: dialect.sqlToQuery(double.log[0].where as never),
    summaryTotal: summary.getRow(summary.rowCount).getCell(2).value,
    dataRows: workbook.worksheets[0].rowCount - 1,
    names: workbook.worksheets[0].getColumn(1).values.slice(2) as unknown[],
  };
}

describe("total parity between the screen and the file (CR-XLS-3, RF-13 d)", () => {
  it.each(FILTER_SETS)(
    "$name: the same where, and the same total on screen, in the summary and in the rows",
    async (set) => {
      const screenPart = await screenOf(set);
      const filePart = await fileOf(set);

      // The same compiled WHERE and parameters: the file filters as the screen does.
      expect(filePart.where.sql).toBe(screenPart.where.sql);
      expect(filePart.where.params).toEqual(screenPart.where.params);

      // The same number, three ways.
      expect(filePart.summaryTotal).toBe(set.matching);
      expect(filePart.dataRows).toBe(set.matching);
      if (set.matching > 0) {
        expect(screenPart.shownTotal).toBe(
          set.matching === 1 ? "1 request" : `${set.matching} requests`,
        );
      } else {
        expect(screenPart.shownTotal).toBeNull();
      }
    },
  );

  it("the file holds every page: more rows than one screen page shows", async () => {
    const set = FILTER_SETS[0];

    const screenPart = await screenOf(set);
    const filePart = await fileOf(set);

    expect(screenPart.tableRows).toBe(PAGE_SIZE);
    expect(filePart.dataRows).toBe(60);
    expect(filePart.dataRows).toBeGreaterThan(screenPart.tableRows);
    expect(filePart.names).toHaveLength(60);
  });

  it("is not the same when the filters differ: the where compares the parameters", async () => {
    const withCause = await fileOf({
      name: "cause",
      query: "?causa=medica",
      matching: 1,
    });
    const without = await fileOf({ name: "none", query: "", matching: 1 });

    expect(withCause.where.params).not.toEqual(without.where.params);
  });
});
