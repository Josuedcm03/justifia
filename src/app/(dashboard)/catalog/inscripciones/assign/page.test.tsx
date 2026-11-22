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
  notFoundMock,
  getSessionMock,
  scopeMock,
  searchMock,
  loadMock,
  auditMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  searchMock: vi.fn(),
  loadMock: vi.fn(),
  auditMock: vi.fn(),
  state: { locale: "en" as Locale },
}));

vi.mock("next/navigation", async () => ({
  ...(await import("@/test/navigation-mock")).module,
  redirect: redirectMock,
  notFound: notFoundMock,
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
  searchStudents: searchMock,
  loadAssignPage: loadMock,
}));
vi.mock("@/lib/data/request-reads", () => ({
  recordEnrollmentStudentSearch: auditMock,
}));
vi.mock("next-intl/server", async () => serverIntl(state));

const FACULTAD = 4;
const SCOPE = { kind: "facultad", facultadId: FACULTAD } as const;

const student = (overrides: Record<string, unknown> = {}) => ({
  id: 11,
  nombreCompleto: "Ana Pérez",
  cif: "2021-0001",
  ...overrides,
});

const asignatura = (overrides: Record<string, unknown> = {}) => ({
  id: 31,
  codigo: "MAT101",
  nombre: "Calculo I",
  carreraNombre: "Ingenieria",
  ownCarrera: true,
  ...overrides,
});

const group = (overrides: Record<string, unknown> = {}) => ({
  grupoId: 21,
  numeroGrupo: "02",
  docenteNombre: "Luis Gómez",
  dias: ["lunes", "miercoles"],
  current: false,
  ...overrides,
});

function assignData(overrides: Record<string, unknown> = {}) {
  return {
    kind: "ok",
    degraded: false,
    data: {
      student: student(),
      periodo: "2026-S2",
      asignaturas: [asignatura()],
      truncated: false,
      groups: [],
      currentGroup: null,
      ...overrides,
    },
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

/** The props of the first element in the tree that carries `key`. */
function propsWith(node: unknown, key: string): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = propsWith(child, key);
      if (found) return found;
    }
    return null;
  }
  if (node === null || typeof node !== "object" || !("props" in node)) {
    return null;
  }
  const props = (node as { props: Record<string, unknown> }).props;
  return key in props ? props : propsWith(props.children, key);
}

const en = messages.en.catalog.inscripciones;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/inscripciones/assign/page"))
    .default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  searchMock.mockReset();
  searchMock.mockResolvedValue({ data: [], degraded: false });
  loadMock.mockReset();
  loadMock.mockResolvedValue(assignData());
  auditMock.mockReset();
  auditMock.mockResolvedValue(undefined);
});

function expectNothingRead() {
  expect(scopeMock).not.toHaveBeenCalled();
  expect(searchMock).not.toHaveBeenCalled();
  expect(loadMock).not.toHaveBeenCalled();
  expect(auditMock).not.toHaveBeenCalled();
}

describe("AssignPage access (EA-ACC-1: other identities denied)", () => {
  it.each(
    rolesUsuario
      .filter((rol) => rol !== "secretaria")
      .map((rol) => [rol] as [RolUsuario]),
  )("sends %s to /denied with no read and no audit row", async (rol) => {
    getSessionMock.mockResolvedValue(sessionFor(rol));

    await expect(renderPage({ q: "ana" })).rejects.toThrow(
      `REDIRECT:${ACCESS_DENIED_PATH}`,
    );

    expectNothingRead();
  });

  it("sends an anonymous caller to /login with no read and no audit row", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage({ estudiante: "11" })).rejects.toThrow(
      "REDIRECT:/login",
    );

    expectNothingRead();
  });

  it("sends a secretaria with a pending password change to the change screen", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria", true));

    await expect(renderPage({ q: "ana" })).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );

    expectNothingRead();
  });

  it("answers an invalid estudiante to a stranger with the redirect, not not-found", async () => {
    getSessionMock.mockResolvedValue(sessionFor("estudiante"));

    await expect(renderPage({ estudiante: "abc" })).rejects.toThrow(
      `REDIRECT:${ACCESS_DENIED_PATH}`,
    );
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe("AssignPage scope none (EA-SCOPE-1)", () => {
  it.each([[{}], [{ q: "ana" }], [{ estudiante: "11" }]] as const)(
    "shows the no-facultad state and reads and audits nothing for %j",
    async (params) => {
      scopeMock.mockResolvedValue({ kind: "none" });

      await renderPage({ ...params });

      expect(screen.getByText(en.noFacultad.title)).toBeInTheDocument();
      expect(screen.getByText(en.noFacultad.message)).toBeInTheDocument();
      expect(screen.queryByRole("search")).toBeNull();
      expect(searchMock).not.toHaveBeenCalled();
      expect(loadMock).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    },
  );
});

describe("AssignPage hostile estudiante (EA-SCOPE-1: not found)", () => {
  it.each([
    ["not a number", "abc"],
    ["zero", "0"],
    ["negative", "-4"],
    ["a decimal", "1.5"],
    ["empty", ""],
    ["repeated", ["1", "2"]],
  ])("answers not found for an estudiante that is %s", async (_name, raw) => {
    await expect(renderPage({ estudiante: raw, q: "ana" })).rejects.toThrow(
      "NOT_FOUND",
    );

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(loadMock).not.toHaveBeenCalled();
    expect(searchMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("answers not found for an unknown or out-of-scope student, alike, with no audit", async () => {
    loadMock.mockResolvedValue({ kind: "not_found", degraded: false });

    await expect(renderPage({ estudiante: "99" })).rejects.toThrow("NOT_FOUND");

    expect(loadMock).toHaveBeenCalledExactlyOnceWith(SCOPE, 99, null);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("reads the student with the facultad of the session and never the URL", async () => {
    await renderPage({
      estudiante: "11",
      asignatura: "31",
      facultadId: "9",
      scope: "all",
    });

    expect(loadMock).toHaveBeenCalledExactlyOnceWith(SCOPE, 11, 31);
  });
});

describe("AssignPage student search (EA-CRE-1, D10: one audit row per search)", () => {
  it("shows only the search form, and reads and audits nothing, without a term", async () => {
    await renderPage();

    const form = screen.getByRole("search", { name: en.assign.search.form });
    expect(within(form).getByLabelText(en.assign.search.label)).toHaveValue("");
    expect(form).toHaveAttribute("method", "get");
    expect(searchMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
    expect(screen.queryByText(en.assign.results.title)).toBeNull();
  });

  it("treats a blank or repeated term as no search", async () => {
    await renderPage({ q: "   " });
    await renderPage({ q: ["a", "b"] });

    expect(searchMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("searches with the facultad scope and the trimmed term, then audits once, after the results", async () => {
    searchMock.mockResolvedValue({
      data: [student(), student({ id: 12, nombreCompleto: "Ana Gómez" })],
      degraded: false,
    });

    await renderPage({ q: "  ana  ", facultadId: "9" });

    expect(searchMock).toHaveBeenCalledExactlyOnceWith(SCOPE, "ana");
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(7, FACULTAD, {
      periodo: "",
      status: "active",
      filters: { q: true, asignatura: false, grupo: false },
      page: 1,
      total: 2,
    });
    expect(searchMock.mock.invocationCallOrder[0]).toBeLessThan(
      auditMock.mock.invocationCallOrder[0],
    );
  });

  it("audits a successful search that found nobody, with a total of zero", async () => {
    await renderPage({ q: "zz" });

    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][2]).toMatchObject({ total: 0 });
    expect(
      screen.getByText(en.assign.results.empty.title.replace("{q}", "zz")),
    ).toBeInTheDocument();
  });

  it("never puts the search text, an id, a name or a CIF in the audit row", async () => {
    searchMock.mockResolvedValue({ data: [student()], degraded: false });

    await renderPage({ q: "Pérez" });

    const text = JSON.stringify(auditMock.mock.calls[0]);
    for (const leak of ["Pérez", "Ana", "2021-0001", '"id"', "11"]) {
      expect(text).not.toContain(leak);
    }
  });

  it("lists each student with the name and the CIF only and a link to choose them", async () => {
    searchMock.mockResolvedValue({
      data: [
        student(),
        student({ id: 12, nombreCompleto: "Ana Gómez", cif: null }),
      ],
      degraded: false,
    });

    await renderPage({ q: "ana" });

    const items = within(
      screen.getByRole("list", { name: en.assign.results.title }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(items[0]).getByText("2021-0001")).toBeInTheDocument();
    expect(within(items[1]).getByText("Ana Gómez")).toBeInTheDocument();
    expect(
      within(items[0]).getByRole("link", { name: "Choose Ana Pérez" }),
    ).toHaveAttribute("href", "/catalog/inscripciones/assign?estudiante=11");
    expect(
      within(items[1]).getByRole("link", { name: "Choose Ana Gómez" }),
    ).toHaveAttribute("href", "/catalog/inscripciones/assign?estudiante=12");
  });

  it("keeps the term in the search box", async () => {
    await renderPage({ q: "  Ana  " });

    expect(screen.getByRole("searchbox")).toHaveValue("Ana");
  });

  it("writes no row and shows no content when the search is degraded (EA-DEG-1)", async () => {
    searchMock.mockResolvedValue({ data: [], degraded: true });

    const { container } = await renderPage({ q: "ana" });

    expect(auditMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(en.assign.degraded);
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).not.toMatch(/error|exception|ECONN/i);
  });

  it("throws when the audit insert fails, so no result is shown without its row", async () => {
    searchMock.mockResolvedValue({ data: [student()], degraded: false });
    auditMock.mockRejectedValue(new Error("insert failed"));

    await expect(build({ q: "ana" })).rejects.toThrow("insert failed");
  });

  it("does not search or audit when a student is chosen, even with a term in the URL", async () => {
    await renderPage({ estudiante: "11", q: "ana" });

    expect(searchMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("builds the audit payload once per render", async () => {
    searchMock.mockResolvedValue({ data: [student()], degraded: false });

    await renderPage({ q: "ana" });

    expect(auditMock).toHaveBeenCalledTimes(1);
  });
});

describe("AssignPage chosen student (EA-CRE-1, EA-CHG-1)", () => {
  it("names the student and offers the subjects, the student's own carrera first", async () => {
    loadMock.mockResolvedValue(
      assignData({
        asignaturas: [
          asignatura({
            id: 40,
            codigo: "FIS200",
            nombre: "Fisica",
            ownCarrera: false,
            carreraNombre: "Arquitectura",
          }),
          asignatura({ id: 31 }),
          asignatura({
            id: 41,
            codigo: "QUI100",
            nombre: "Quimica",
            ownCarrera: false,
            carreraNombre: "Arquitectura",
          }),
        ],
      }),
    );

    await renderPage({ estudiante: "11" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.assign.title,
    );
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("CIF 2021-0001")).toBeInTheDocument();
    const select = screen.getByRole("combobox", {
      name: en.assign.picker.label,
    });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      en.assign.picker.placeholder,
      "MAT101 · Calculo I",
      "FIS200 · Fisica (Arquitectura)",
      "QUI100 · Quimica (Arquitectura)",
    ]);
    // A GET form carrying the student, so the choice lives in the URL.
    const form = select.closest("form")!;
    expect(form).toHaveAttribute("method", "get");
    expect(form.querySelector('input[name="estudiante"]')).toHaveValue("11");
  });

  it("selects the chosen subject and lists its offered groups with the teacher and the days", async () => {
    loadMock.mockResolvedValue(
      assignData({
        groups: [
          group(),
          group({
            grupoId: 22,
            numeroGrupo: "03",
            docenteNombre: null,
            dias: [],
          }),
        ],
      }),
    );

    await renderPage({ estudiante: "11", asignatura: "31" });

    expect(loadMock).toHaveBeenCalledExactlyOnceWith(SCOPE, 11, 31);
    expect(
      screen.getByRole("option", { name: "MAT101 · Calculo I" }),
    ).toHaveProperty("selected", true);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: en.assign.groups.title.replace("{periodo}", "2026-S2"),
      }),
    ).toBeInTheDocument();
    const items = within(
      screen.getByRole("list", { name: "Groups of MAT101 · Calculo I" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Group 02")).toBeInTheDocument();
    expect(within(items[0]).getByText(/Luis Gómez/)).toBeInTheDocument();
    expect(within(items[0]).getByText("Mon, Wed")).toBeInTheDocument();
    expect(within(items[1]).getByText("Group 03")).toBeInTheDocument();
    expect(
      within(items[1]).getByText(en.assign.groups.noTeacher),
    ).toBeInTheDocument();
    expect(within(items[1]).getByText("Days not set")).toBeInTheDocument();
  });

  it("marks the current group in text and names it, even when it is no longer offered", async () => {
    loadMock.mockResolvedValue(
      assignData({
        groups: [
          group({ current: true }),
          group({ grupoId: 22, numeroGrupo: "03" }),
        ],
        currentGroup: { grupoId: 21, numeroGrupo: "02" },
      }),
    );

    await renderPage({ estudiante: "11", asignatura: "31" });

    const items = screen.getAllByRole("listitem");
    expect(
      within(items[0]).getByText(en.assign.groups.current),
    ).toBeInTheDocument();
    expect(within(items[1]).queryByText(en.assign.groups.current)).toBeNull();
    expect(
      screen.getByText("Ana Pérez is currently in group 02 of this subject."),
    ).toBeInTheDocument();
  });

  it("names a current group that is not in the offered list and marks none", async () => {
    loadMock.mockResolvedValue(
      assignData({
        groups: [group({ grupoId: 22, numeroGrupo: "03" })],
        currentGroup: { grupoId: 21, numeroGrupo: "02" },
      }),
    );

    await renderPage({ estudiante: "11", asignatura: "31" });

    expect(
      screen.getByText("Ana Pérez is currently in group 02 of this subject."),
    ).toBeInTheDocument();
    expect(screen.queryByText(en.assign.groups.current)).toBeNull();
  });

  it("says so when the student has no active group in the subject", async () => {
    loadMock.mockResolvedValue(assignData({ groups: [group()] }));

    await renderPage({ estudiante: "11", asignatura: "31" });

    expect(
      screen.getByText(
        "Ana Pérez has no active group in this subject for this period.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no groups for a subject that is not one of the student's offered subjects", async () => {
    await renderPage({ estudiante: "11", asignatura: "999" });

    expect(loadMock).toHaveBeenCalledExactlyOnceWith(SCOPE, 11, 999);
    expect(screen.queryByRole("list", { name: /Groups of/ })).toBeNull();
    expect(screen.getByText(en.assign.groups.empty)).toBeInTheDocument();
  });

  it("shows no subject choice when nothing is offered", async () => {
    loadMock.mockResolvedValue(
      assignData({ periodo: null, asignaturas: [], groups: [] }),
    );

    await renderPage({ estudiante: "11" });

    expect(screen.getByText(en.assign.noOffering)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("notes that the subject list was cut", async () => {
    loadMock.mockResolvedValue(assignData({ truncated: true }));

    await renderPage({ estudiante: "11" });

    expect(screen.getByText(en.assign.picker.truncated)).toBeInTheDocument();
  });

  it("shows the degraded alert in place of the content and offers nothing", async () => {
    loadMock.mockResolvedValue({ kind: "degraded", degraded: true });

    await renderPage({ estudiante: "11", asignatura: "31" });

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(en.assign.degraded);
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("writes no audit row for a student view", async () => {
    loadMock.mockResolvedValue(assignData({ groups: [group()] }));

    await renderPage({ estudiante: "11", asignatura: "31" });

    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("AssignPage hands the group list exactly what the S3b-2 form needs (EA-PII-1)", () => {
  const FULL = assignData({
    groups: [
      group({ current: true }),
      group({ grupoId: 22, numeroGrupo: "03" }),
    ],
    currentGroup: { grupoId: 21, numeroGrupo: "02" },
  });

  it("pins the props, the current group id included", async () => {
    loadMock.mockResolvedValue(FULL);

    const props = propsWith(
      await build({ estudiante: "11", asignatura: "31" }),
      "currentGroup",
    );

    expect(props).not.toBeNull();
    expect(Object.keys(props!).sort()).toEqual([
      "asignatura",
      "currentGroup",
      "groups",
      "periodo",
      "student",
    ]);
    expect(props!.student).toEqual({
      id: 11,
      nombreCompleto: "Ana Pérez",
      cif: "2021-0001",
    });
    expect(props!.asignatura).toEqual({
      id: 31,
      codigo: "MAT101",
      nombre: "Calculo I",
    });
    expect(props!.periodo).toBe("2026-S2");
    // The id the form sends back as `expectedReplaced` (13.6).
    expect(props!.currentGroup).toEqual({ grupoId: 21, numeroGrupo: "02" });
    expect(
      (props!.groups as Record<string, unknown>[]).map((g) =>
        Object.keys(g).sort(),
      ),
    ).toEqual([
      ["current", "dias", "docenteNombre", "grupoId", "numeroGrupo"],
      ["current", "dias", "docenteNombre", "grupoId", "numeroGrupo"],
    ]);
  });

  it("sends nothing else, even if the reads returned more", async () => {
    loadMock.mockResolvedValue(
      assignData({
        student: student({
          correo: "ana@uni.edu",
          telefono: "555-0100",
          hashClave: "$2b$12$LEAKED",
        }),
        asignaturas: [asignatura({ correo: "coord@uni.edu", carreraId: 77 })],
        groups: [
          group({
            current: true,
            docenteCorreo: "luis@uni.edu",
            docenteTelefono: "555-0199",
          }),
        ],
        currentGroup: {
          grupoId: 21,
          numeroGrupo: "02",
          estudianteId: 11,
          creadoEn: "2026-01-01",
        },
      }),
    );

    const ui = await build({ estudiante: "11", asignatura: "31" });
    const { container } = renderUi(ui);

    for (const text of [container.innerHTML, serializedProps(ui)]) {
      expect(text.length).toBeGreaterThan(0);
      for (const leak of [
        "ana@uni.edu",
        "555-0100",
        "LEAKED",
        "coord@uni.edu",
        "luis@uni.edu",
        "555-0199",
        "carreraId",
        "estudianteId",
        "creadoEn",
        "correo",
        "telefono",
      ]) {
        expect(text).not.toContain(leak);
      }
    }
    expect(serializedProps(ui)).toContain("2021-0001");
  });

  it("sends the results list only the name, the CIF and the id", async () => {
    searchMock.mockResolvedValue({
      data: [student({ correo: "ana@uni.edu", telefono: "555-0100" })],
      degraded: false,
    });

    const ui = await build({ q: "ana" });
    const { container } = renderUi(ui);

    for (const text of [container.innerHTML, serializedProps(ui)]) {
      expect(text).not.toContain("ana@uni.edu");
      expect(text).not.toContain("555-0100");
    }
    expect(serializedProps(ui)).toContain("2021-0001");
  });
});

describe("AssignPage never lets a link prefetch it (D10)", () => {
  it("opts every link out of prefetch while results are shown", async () => {
    searchMock.mockResolvedValue({
      data: [student(), student({ id: 12 })],
      degraded: false,
    });

    await renderPage({ q: "ana" });

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it("opts the clear link of the no-results state out of prefetch", async () => {
    await renderPage({ q: "zz" });

    const clear = screen.getByRole("link", {
      name: en.assign.results.empty.clear,
    });
    expect(clear).toHaveAttribute("data-prefetch", "false");
    expect(clear).toHaveAttribute("href", "/catalog/inscripciones/assign");
  });
});

describe("AssignPage structure and copy (EA-UI-1)", () => {
  it.each([
    "search",
    "results",
    "no-results",
    "student",
    "groups",
    "degraded",
    "no-facultad",
  ] as const)(
    "has exactly one h1 and no skipped levels (%s)",
    async (variant) => {
      let params: Params = {};
      if (variant === "results") {
        searchMock.mockResolvedValue({ data: [student()], degraded: false });
        params = { q: "ana" };
      }
      if (variant === "no-results") params = { q: "zz" };
      if (variant === "student") params = { estudiante: "11" };
      if (variant === "groups") {
        loadMock.mockResolvedValue(
          assignData({
            groups: [group({ current: true })],
            currentGroup: { grupoId: 21, numeroGrupo: "02" },
          }),
        );
        params = { estudiante: "11", asignatura: "31" };
      }
      if (variant === "degraded") {
        loadMock.mockResolvedValue({ kind: "degraded", degraded: true });
        params = { estudiante: "11" };
      }
      if (variant === "no-facultad")
        scopeMock.mockResolvedValue({ kind: "none" });

      await renderPage(params);

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

  it("renders the title, the search and the current-group marker in Spanish", async () => {
    state.locale = "es";
    loadMock.mockResolvedValue(
      assignData({
        groups: [group({ current: true })],
        currentGroup: { grupoId: 21, numeroGrupo: "02" },
      }),
    );

    await renderPage({ estudiante: "11", asignatura: "31" });

    const es = messages.es.catalog.inscripciones.assign;
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      es.title,
    );
    expect(screen.getByRole("search")).toHaveAccessibleName(es.search.form);
    expect(screen.getByText(es.groups.current)).toBeInTheDocument();
  });
});
