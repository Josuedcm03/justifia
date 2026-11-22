import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  serverIntl,
  sessionFor,
  type Locale,
} from "@/app/(dashboard)/review/test-support";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  scopeMock,
  listMock,
  periodsMock,
  auditMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  listMock: vi.fn(),
  periodsMock: vi.fn(),
  auditMock: vi.fn(),
  state: { locale: "en" as Locale },
}));

// `redirect` is the guard's; the router and link stand-ins serve the client
// table the page renders (the link stand-in exposes `data-prefetch`).
vi.mock("next/navigation", async () => ({
  ...(await import("@/test/navigation-mock")).module,
  redirect: redirectMock,
}));
vi.mock(
  "next/link",
  async () => (await import("@/test/navigation-mock")).linkModule,
);
// The REAL dal and the REAL requireEnrollmentAccess run on a mocked session
// source and a mocked scope read, so the guard order is the production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/inscripciones", () => ({
  listInscripciones: listMock,
  listInscripcionPeriods: periodsMock,
}));
vi.mock("@/lib/data/request-reads", () => ({
  recordEnrollmentListRead: auditMock,
}));
vi.mock("next-intl/server", async () => serverIntl(state));
// The table binds the server action; the page tests never run it.
vi.mock("@/app/(dashboard)/catalog/inscripciones/actions", () => ({
  setInscripcionActivoAction: vi.fn(),
}));

const FACULTAD = 4;
/** The assign link of the default row (student 11, subject 31). */
const ASSIGN_LINK = "/catalog/inscripciones/assign?estudiante=11&asignatura=31";
const SCOPE = { kind: "facultad", facultadId: FACULTAD } as const;

function row(overrides: Record<string, unknown> = {}) {
  return {
    estudianteId: 11,
    grupoId: 21,
    estudianteNombre: "Ana Pérez",
    estudianteCif: "2021-0001",
    asignaturaId: 31,
    asignaturaCodigo: "MAT101",
    asignaturaNombre: "Calculo I",
    periodo: "2026-S2",
    numeroGrupo: 2,
    activo: true,
    effective: true,
    writable: true,
    hasActiveSibling: false,
    dependentRequests: 3,
    ...overrides,
  };
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    data: [],
    total: 0,
    page: 1,
    pageSize: 10,
    degraded: false,
    resolvedPeriodo: "2026-S2",
    ...overrides,
  };
}

type Params = Record<string, string | string[] | undefined>;
let Page: (props: {
  searchParams: Promise<Params>;
}) => Promise<React.ReactNode>;

const build = (params: Params = {}) =>
  Page({ searchParams: Promise.resolve(params) });

function renderUi(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider
      locale={state.locale}
      messages={messages[state.locale]}
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

const renderPage = async (params: Params = {}) => renderUi(await build(params));

/** Everything a node hands to its children as props, as JSON text. */
function serializedProps(node: unknown, seen = new Set<unknown>()): string {
  if (typeof node === "function" || node === undefined) return "";
  if (node === null || typeof node !== "object") return JSON.stringify(node);
  if (seen.has(node)) return "";
  seen.add(node);
  if (Array.isArray(node)) {
    return node.map((child) => serializedProps(child, seen)).join(" ");
  }
  const record = node as Record<string, unknown>;
  const source = "$$typeof" in record ? record.props : record;
  return Object.entries((source ?? {}) as Record<string, unknown>)
    .map(([key, value]) => `${key}:${serializedProps(value, seen)}`)
    .join(" ");
}

const en = messages.en.catalog.inscripciones;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/inscripciones/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  listMock.mockReset();
  listMock.mockResolvedValue(result());
  periodsMock.mockReset();
  periodsMock.mockResolvedValue(["2026-S2", "2026-S1"]);
  auditMock.mockReset();
  auditMock.mockResolvedValue(undefined);
});

function expectNothingRead() {
  expect(scopeMock).not.toHaveBeenCalled();
  expect(listMock).not.toHaveBeenCalled();
  expect(periodsMock).not.toHaveBeenCalled();
  expect(auditMock).not.toHaveBeenCalled();
}

describe("InscripcionesPage access (EA-ACC-1: other identities denied)", () => {
  it.each(
    rolesUsuario
      .filter((rol) => rol !== "secretaria")
      .map((rol) => [rol] as [RolUsuario]),
  )("sends %s to /denied with no read and no audit row", async (rol) => {
    getSessionMock.mockResolvedValue(sessionFor(rol));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${ACCESS_DENIED_PATH}`,
    );

    expectNothingRead();
  });

  it("sends an anonymous caller to /login with no read and no audit row", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    expectNothingRead();
  });

  it("sends a secretaria with a pending password change to the change screen", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );

    expectNothingRead();
  });

  it("renders the list for a secretaria of a facultad", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.title,
    );
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(scopeMock).toHaveBeenCalledWith(7, "secretaria");
  });
});

describe("InscripcionesPage scope none (EA-SCOPE-1)", () => {
  beforeEach(() => {
    scopeMock.mockResolvedValue({ kind: "none" });
  });

  it("shows the no-facultad state and reads and audits nothing", async () => {
    await renderPage();

    expect(screen.getByText(en.noFacultad.title)).toBeInTheDocument();
    expect(screen.getByText(en.noFacultad.message)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(en.empty)).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
    expect(periodsMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("InscripcionesPage list load (EA-LIST-1, EA-FILT-1)", () => {
  it("lists with the facultad scope of the session and the default params", async () => {
    await renderPage();

    expect(listMock).toHaveBeenCalledExactlyOnceWith({
      scope: SCOPE,
      q: "",
      asignatura: "",
      grupo: "",
      periodo: "",
      status: "active",
      page: 1,
      pageSize: 10,
      sort: { key: "student", dir: "asc" },
    });
    expect(periodsMock).toHaveBeenCalledExactlyOnceWith(SCOPE);
  });

  it("passes the parsed URL state and never lets the URL widen the scope", async () => {
    await renderPage({
      q: "  Ana  ",
      asignatura: "MAT",
      grupo: "2",
      periodo: "2026-S1",
      status: "inactive",
      sort: "subject",
      dir: "desc",
      size: "25",
      page: "2",
      facultadId: "9",
      scope: "all",
    });

    expect(listMock).toHaveBeenCalledExactlyOnceWith({
      scope: SCOPE,
      q: "Ana",
      asignatura: "MAT",
      grupo: "2",
      periodo: "2026-S1",
      status: "inactive",
      page: 2,
      pageSize: 25,
      sort: { key: "subject", dir: "desc" },
    });
  });

  it.each([
    [{ status: "all" }],
    [{ status: ["active", "inactive"] }],
    [{ sort: "hashClave", dir: "asc" }],
    [{ sort: ["student", "group"] }],
    [{ size: "7" }],
    [{ size: "9999" }],
    [{ page: "x" }],
    [{ page: "0" }],
  ] as const)(
    "falls back to the defaults for the hostile values %j",
    async (params) => {
      await renderPage({ ...params } as Params);

      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          page: 1,
          pageSize: 10,
          sort: { key: "student", dir: "asc" },
        }),
      );
    },
  );

  it("renders the page the read clamped to, not the one requested", async () => {
    listMock.mockResolvedValue(result({ total: 25, page: 3, data: [row()] }));

    await renderPage({ page: "99" });

    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  });

  it("renders the rows and the period select from the periods read", async () => {
    listMock.mockResolvedValue(
      result({
        total: 2,
        data: [row(), row({ grupoId: 22, estudianteNombre: "Luis Gómez" })],
      }),
    );

    await renderPage();

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Luis Gómez")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2026-S1" })).toBeInTheDocument();
  });
});

describe("InscripcionesPage audited read (D10, audit-log: one row per load)", () => {
  it("writes one row after the data loaded, with the session actor and the facultad", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));

    await renderPage();

    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(7, FACULTAD, {
      periodo: "2026-S2",
      status: "active",
      filters: { q: false, asignatura: false, grupo: false },
      page: 1,
      total: 1,
    });
    expect(listMock.mock.invocationCallOrder[0]).toBeLessThan(
      auditMock.mock.invocationCallOrder[0],
    );
  });

  it("carries which filters are present as booleans and never the search text", async () => {
    listMock.mockResolvedValue(result({ total: 12, page: 2, data: [row()] }));

    await renderPage({
      q: "Pérez",
      asignatura: "MAT101",
      grupo: "2",
      status: "inactive",
      page: "2",
    });

    const payload = auditMock.mock.calls[0][2];
    expect(payload).toEqual({
      periodo: "2026-S2",
      status: "inactive",
      filters: { q: true, asignatura: true, grupo: true },
      page: 2,
      total: 12,
    });
    const text = JSON.stringify(auditMock.mock.calls[0]);
    for (const leak of ["Pérez", "MAT101", "Ana", "2021-0001"]) {
      expect(text).not.toContain(leak);
    }
  });

  it("records the period the read resolved, so a default load carries the real period", async () => {
    listMock.mockResolvedValue(result({ resolvedPeriodo: "2026-S2" }));
    await renderPage();
    expect(auditMock.mock.calls[0][2].periodo).toBe("2026-S2");

    auditMock.mockClear();
    listMock.mockResolvedValue(result({ resolvedPeriodo: "2026-S1" }));
    await renderPage({ periodo: "2026-S1" });
    expect(auditMock.mock.calls[0][2].periodo).toBe("2026-S1");
  });

  it("never records the URL text, only what the read resolved", async () => {
    listMock.mockResolvedValue(result({ resolvedPeriodo: "2026-S2" }));

    await renderPage({ periodo: "Pérez" });

    expect(auditMock.mock.calls[0][2].periodo).toBe("2026-S2");
    expect(JSON.stringify(auditMock.mock.calls[0])).not.toContain("Pérez");
  });

  it("builds the payload once per render", async () => {
    await renderPage();

    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("writes no row and shows no data when the read is degraded (EA-DEG-1)", async () => {
    listMock.mockResolvedValue(result({ degraded: true }));

    const { container } = await renderPage({ q: "zz", page: "3" });

    expect(auditMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(en.degraded);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(en.empty)).toBeNull();
    expect(container.textContent).not.toMatch(/error|exception|ECONN/i);
  });

  it("throws when the audit insert fails, so no data is shown without its row", async () => {
    listMock.mockResolvedValue(result({ total: 1, data: [row()] }));
    auditMock.mockRejectedValue(new Error("insert failed"));

    await expect(build()).rejects.toThrow("insert failed");
  });
});

/** The rows the page hands the table, read off the element tree. */
function tableRows(ui: React.ReactNode): Record<string, unknown>[] {
  const frame = ui as React.ReactElement<{ children: React.ReactNode[] }>;
  const table = frame.props.children.find(
    (child) =>
      typeof child === "object" &&
      child !== null &&
      "props" in child &&
      "rows" in (child as React.ReactElement<object>).props,
  ) as React.ReactElement<{ rows: Record<string, unknown>[] }>;
  return table.props.rows;
}

describe("InscripcionesPage row toggle (EA-DEACT-1, EA-REACT-1, RNF-12)", () => {
  it("offers the GET filter bar, one POST toggle form per row that has a control, and a change link per offered active row", async () => {
    listMock.mockResolvedValue(
      result({
        total: 4,
        data: [
          row(),
          row({ grupoId: 22 }),
          row({ grupoId: 23, activo: false, writable: false }),
          row({ grupoId: 24, activo: false }),
        ],
      }),
    );

    await renderPage();

    const methods = [...document.querySelectorAll("form")].map((form) =>
      form.getAttribute("method"),
    );
    expect(methods).toEqual(["get", "post", "post", "post"]);
    // Only the two active, offered rows carry the link (EA-CHG-1).
    expect(
      within(screen.getByRole("table"))
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([ASSIGN_LINK, ASSIGN_LINK]);
  });

  it("links the header to the assign page, out of prefetch (EA-CRE-1)", async () => {
    await renderPage();

    const create = screen.getByRole("link", { name: en.rowLinks.create });
    expect(create).toHaveAttribute("href", "/catalog/inscripciones/assign");
    expect(create).toHaveAttribute("data-prefetch", "false");
  });

  // The reactivation toggle and the assign link never share a row: an inactive
  // offered row with no sibling is reactivated in place (EA-REACT-1), with an
  // active sibling it is replaced through the assign page (EA-SIB-1), and an
  // active offered row is changed there (EA-CHG-1); a group that is not
  // offered gets neither.
  it.each([
    ["inactive, offered, no sibling", { activo: false }, true, null],
    [
      "inactive, offered, an active sibling",
      { activo: false, hasActiveSibling: true },
      false,
      ASSIGN_LINK,
    ],
    [
      "inactive, group of an older period",
      { activo: false, writable: false },
      false,
      null,
    ],
    ["active, offered, no sibling", {}, false, ASSIGN_LINK],
    ["active, group no longer offered", { writable: false }, false, null],
  ] as const)(
    "tells the table what a row that is %s can do",
    async (_name, overrides, canReactivate, assignHref) => {
      listMock.mockResolvedValue(
        result({ total: 1, data: [row({ ...overrides })] }),
      );

      const rows = tableRows(await build());

      expect(rows).toHaveLength(1);
      expect(rows[0].canReactivate).toBe(canReactivate);
      expect(rows[0].assignHref).toBe(assignHref);
    },
  );

  it("shows the Reactivate control exactly for the rows that can take it", async () => {
    listMock.mockResolvedValue(
      result({
        total: 3,
        data: [
          row({ activo: false }),
          row({ grupoId: 22, activo: false, hasActiveSibling: true }),
          row({ grupoId: 23, activo: false, writable: false }),
        ],
      }),
    );

    await renderPage({ status: "inactive" });

    expect(screen.getAllByRole("button", { name: "Reactivate" })).toHaveLength(
      1,
    );
  });

  it("passes the dependent-request count of each row and nothing that would reveal a draft", async () => {
    listMock.mockResolvedValue(
      result({
        total: 2,
        data: [
          row({ dependentRequests: 3 }),
          row({ grupoId: 22, dependentRequests: 0 }),
        ],
      }),
    );

    const rows = tableRows(await build());

    expect(rows.map((r) => r.requestCount)).toEqual([3, 0]);
  });

  it("renders no toggle when the read is degraded", async () => {
    listMock.mockResolvedValue(result({ degraded: true }));

    await renderPage();

    expect(document.querySelectorAll("form")).toHaveLength(0);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("InscripcionesPage leaks no personal data (EA-PII-1)", () => {
  it("hands the table exactly the displayed fields plus the three the row controls need", async () => {
    listMock.mockResolvedValue(
      result({ total: 1, data: [row({ correo: "ana@uni.edu" })] }),
    );

    const [first] = tableRows(await build());

    expect(Object.keys(first).sort()).toEqual([
      "activo",
      "asignaturaCodigo",
      "asignaturaNombre",
      "assignHref",
      "canReactivate",
      "effective",
      "estudianteCif",
      "estudianteId",
      "estudianteNombre",
      "grupoId",
      "numeroGrupo",
      "periodo",
      "requestCount",
    ]);
  });

  it("sends the table only the displayed fields, even if the read returned more", async () => {
    listMock.mockResolvedValue(
      result({
        total: 1,
        data: [
          row({
            correo: "ana@uni.edu",
            telefono: "555-0100",
            hashClave: "$2b$12$LEAKED",
          }),
        ],
      }),
    );

    const ui = await build();
    const { container } = renderUi(ui);

    for (const text of [container.innerHTML, serializedProps(ui)]) {
      expect(text.length).toBeGreaterThan(0);
      for (const leak of [
        "ana@uni.edu",
        "555-0100",
        "LEAKED",
        "correo",
        "telefono",
        "dependentRequests",
        "hasActiveSibling",
        "writable",
        "asignaturaId",
      ]) {
        expect(text).not.toContain(leak);
      }
    }
    expect(serializedProps(ui)).toContain("2021-0001");
  });
});

describe("InscripcionesPage never lets a link prefetch it (D10)", () => {
  it("opts every page link out of prefetch while the audited page is shown", async () => {
    listMock.mockResolvedValue(result({ total: 25, page: 2, data: [row()] }));

    await renderPage({ page: "2", q: "ana" });

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    const pageLinks = within(nav).getAllByRole("link");
    expect(pageLinks).toHaveLength(4);
    const all = screen.getAllByRole("link");
    // The four page links, the header link and the row's change link.
    expect(all).toHaveLength(6);
    for (const link of all) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it("opts the clear link of the no-results state out of prefetch", async () => {
    await renderPage({ q: "zz" });

    const clear = screen.getByRole("link", { name: "Clear filters" });
    expect(clear).toHaveAttribute("data-prefetch", "false");
  });
});

describe("InscripcionesPage structure and copy (EA-UI-1)", () => {
  it.each(["rows", "empty", "no-results", "degraded", "no-facultad"] as const)(
    "has exactly one h1 and no skipped levels (%s)",
    async (variant) => {
      if (variant === "rows") {
        listMock.mockResolvedValue(result({ total: 1, data: [row()] }));
      }
      if (variant === "degraded") {
        listMock.mockResolvedValue(result({ degraded: true }));
      }
      if (variant === "no-facultad") {
        scopeMock.mockResolvedValue({ kind: "none" });
      }

      await renderPage(variant === "no-results" ? { q: "zz" } : {});

      const levels = screen
        .getAllByRole("heading")
        .map((h) => Number(h.tagName.slice(1)));
      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);
      levels.slice(1).forEach((level, i) => {
        expect(level - levels[i]).toBeLessThanOrEqual(1);
      });
    },
  );

  it("wraps its content in one page frame", async () => {
    await renderPage();

    expect(document.querySelectorAll('[data-slot="page-frame"]')).toHaveLength(
      1,
    );
  });

  it("renders the title and the state words in Spanish", async () => {
    state.locale = "es";
    listMock.mockResolvedValue(
      result({ total: 1, data: [row({ activo: false })] }),
    );

    await renderPage({ status: "inactive" });

    const es = messages.es.catalog.inscripciones;
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      es.title,
    );
    expect(screen.getByText(es.state.inactive)).toBeInTheDocument();
  });
});
