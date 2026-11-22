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
import { rolesUsuario } from "@/lib/validations/auth";

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
// The form's action is a server module; the page only renders the form.
vi.mock("@/app/(dashboard)/catalog/inscripciones/actions", () => ({
  assignInscripcionAction: vi.fn(),
}));

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

const DEGRADED = { kind: "degraded", degraded: true };
const CURRENT_GROUP = { grupoId: 21, numeroGrupo: "02" };
const CURRENT = () =>
  assignData({
    groups: [group({ current: true })],
    currentGroup: CURRENT_GROUP,
  });
const STUDENT_VIEW = { estudiante: "11" };
const SUBJECT_VIEW = { estudiante: "11", asignatura: "31" };

/** The student search answers with these rows (never degraded). */
const found = (...rows: Record<string, unknown>[]) =>
  searchMock.mockResolvedValue({ data: rows, degraded: false });

function expectNothingRead() {
  expect(scopeMock).not.toHaveBeenCalled();
  expect(searchMock).not.toHaveBeenCalled();
  expect(loadMock).not.toHaveBeenCalled();
  expect(auditMock).not.toHaveBeenCalled();
}

describe("AssignPage access (EA-ACC-1: other identities denied)", () => {
  const denied: [string, () => unknown, Params, string][] = [
    ...rolesUsuario
      .filter((rol) => rol !== "secretaria")
      .map((rol): [string, () => unknown, Params, string] => [
        rol,
        () => sessionFor(rol),
        { q: "ana" },
        ACCESS_DENIED_PATH,
      ]),
    ["an anonymous caller", () => null, STUDENT_VIEW, "/login"],
    [
      "a secretaria with a pending password change",
      () => sessionFor("secretaria", true),
      { q: "ana" },
      PASSWORD_CHANGE_PATH,
    ],
    // The redirect wins over the not-found answer of a hostile value.
    [
      "an estudiante with a hostile estudiante",
      () => sessionFor("estudiante"),
      { estudiante: "abc" },
      ACCESS_DENIED_PATH,
    ],
  ];

  it.each(denied)(
    "sends %s away with no read and no audit row",
    async (_who, session, params, path) => {
      getSessionMock.mockResolvedValue(session());

      await expect(renderPage(params)).rejects.toThrow(`REDIRECT:${path}`);

      expectNothingRead();
      expect(notFoundMock).not.toHaveBeenCalled();
    },
  );
});

describe("AssignPage scope none (EA-SCOPE-1)", () => {
  it.each([[{}], [{ q: "ana" }], [STUDENT_VIEW]] as const)(
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
    await renderPage({ ...SUBJECT_VIEW, facultadId: "9", scope: "all" });

    expect(loadMock).toHaveBeenCalledExactlyOnceWith(SCOPE, 11, 31);
  });
});

describe("AssignPage student search (EA-CRE-1, D10: one audit row per search)", () => {
  it.each([
    ["no term", {}],
    ["a blank term", { q: "   " }],
    ["a repeated term", { q: ["a", "b"] }],
  ])(
    "shows only the search form, reading and auditing nothing, for %s",
    async (_name, params) => {
      await renderPage(params);

      const form = screen.getByRole("search", { name: en.assign.search.form });
      expect(within(form).getByLabelText(en.assign.search.label)).toHaveValue(
        "",
      );
      expect(form).toHaveAttribute("method", "get");
      expect(screen.queryByText(en.assign.results.title)).toBeNull();
      expect(searchMock).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    },
  );

  it("searches with the facultad scope and the trimmed term, then audits once, after the results", async () => {
    found(student(), student({ id: 12, nombreCompleto: "Ana Gómez" }));

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
    const clear = screen.getByRole("link", {
      name: en.assign.results.empty.clear,
    });
    expect(clear).toHaveAttribute("href", "/catalog/inscripciones/assign");
    expect(clear).toHaveAttribute("data-prefetch", "false");
  });

  it("never puts the search text, an id, a name or a CIF in the audit row", async () => {
    found(student());

    await renderPage({ q: "Pérez" });

    const text = JSON.stringify(auditMock.mock.calls[0]);
    for (const leak of ["Pérez", "Ana", "2021-0001", '"id"', "11"]) {
      expect(text).not.toContain(leak);
    }
  });

  it("lists each student with the name and the CIF only and a link, out of prefetch, to choose them; keeps the term in the box", async () => {
    found(
      student(),
      student({ id: 12, nombreCompleto: "Ana Gómez", cif: null }),
    );

    await renderPage({ q: "  Ana  " });

    expect(screen.getByRole("searchbox")).toHaveValue("Ana");
    const items = within(
      screen.getByRole("list", { name: en.assign.results.title }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(items[0]).getByText("2021-0001")).toBeInTheDocument();
    expect(within(items[1]).getByText("Ana Gómez")).toBeInTheDocument();
    const links = [
      within(items[0]).getByRole("link", { name: "Choose Ana Pérez" }),
      within(items[1]).getByRole("link", { name: "Choose Ana Gómez" }),
    ];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/catalog/inscripciones/assign?estudiante=11",
      "/catalog/inscripciones/assign?estudiante=12",
    ]);
    // D10: no link of the audited page prefetches it.
    expect(screen.getAllByRole("link")).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it("throws when the audit insert fails, so no result is shown without its row", async () => {
    found(student());
    auditMock.mockRejectedValue(new Error("insert failed"));

    await expect(build({ q: "ana" })).rejects.toThrow("insert failed");
  });

  it("does not search or audit when a student is chosen, even with a term in the URL", async () => {
    loadMock.mockResolvedValue(assignData({ groups: [group()] }));

    await renderPage({ ...SUBJECT_VIEW, q: "ana" });

    expect(searchMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("AssignPage degraded (EA-DEG-1)", () => {
  it.each([
    [
      "search",
      { q: "ana" },
      () => searchMock.mockResolvedValue({ data: [], degraded: true }),
    ],
    ["student read", SUBJECT_VIEW, () => loadMock.mockResolvedValue(DEGRADED)],
  ] as [string, Params, () => unknown][])(
    "shows one alert in place of the content, with nothing offered or audited, for the %s",
    async (_name, params, arrange) => {
      arrange();

      const { container } = await renderPage(params);

      expect(auditMock).not.toHaveBeenCalled();
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent(en.assign.degraded);
      for (const role of ["search", "link", "button", "combobox", "list"]) {
        expect(screen.queryByRole(role)).toBeNull();
      }
      expect(container.textContent).not.toMatch(/error|exception|ECONN/i);
    },
  );
});

describe("AssignPage chosen student (EA-CRE-1, EA-CHG-1)", () => {
  it("names the student and offers the subjects, the student's own carrera first", async () => {
    const other = { ownCarrera: false, carreraNombre: "Arquitectura" };
    loadMock.mockResolvedValue(
      assignData({
        asignaturas: [
          asignatura({ id: 40, codigo: "FIS200", nombre: "Fisica", ...other }),
          asignatura({ id: 31 }),
          asignatura({ id: 41, codigo: "QUI100", nombre: "Quimica", ...other }),
        ],
      }),
    );

    await renderPage(STUDENT_VIEW);

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

    await renderPage(SUBJECT_VIEW);

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

  // The current group is marked in text and named in a notice; a current group
  // that is no longer offered is named with no group marked.
  it.each([
    [
      "is offered",
      [group({ current: true }), group({ grupoId: 22, numeroGrupo: "03" })],
      CURRENT_GROUP,
      "Ana Pérez is currently in group 02 of this subject.",
      0,
    ],
    [
      "is no longer offered",
      [group({ grupoId: 22, numeroGrupo: "03" })],
      CURRENT_GROUP,
      "Ana Pérez is currently in group 02 of this subject.",
      null,
    ],
    [
      "does not exist",
      [group()],
      null,
      "Ana Pérez has no active group in this subject for this period.",
      null,
    ],
  ])(
    "names the student's situation when the current group %s",
    async (_name, groups, currentGroup, notice, marked) => {
      loadMock.mockResolvedValue(assignData({ groups, currentGroup }));

      await renderPage(SUBJECT_VIEW);

      expect(screen.getByText(notice)).toBeInTheDocument();
      const markers = screen.queryAllByText(en.assign.groups.current);
      expect(markers).toHaveLength(marked === null ? 0 : 1);
      // The form offers every group but the current one (S3b-2).
      expect(
        screen.queryAllByRole("button", { name: /^Assign group / }),
      ).toHaveLength(groups.length - (marked === null ? 0 : 1));
      if (marked !== null) {
        expect(
          within(screen.getAllByRole("listitem")[marked]).getByText(
            en.assign.groups.current,
          ),
        ).toBeInTheDocument();
      }
    },
  );

  it("shows no groups for a subject that is not one of the student's offered subjects", async () => {
    await renderPage({ ...STUDENT_VIEW, asignatura: "999" });

    expect(screen.queryByRole("list", { name: /Groups of/ })).toBeNull();
    expect(screen.getByText(en.assign.groups.empty)).toBeInTheDocument();
  });

  it("shows no subject choice when nothing is offered", async () => {
    loadMock.mockResolvedValue(
      assignData({ periodo: null, asignaturas: [], groups: [] }),
    );

    await renderPage(STUDENT_VIEW);

    expect(screen.getByText(en.assign.noOffering)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("notes that the subject list was cut", async () => {
    loadMock.mockResolvedValue(assignData({ truncated: true }));

    await renderPage(STUDENT_VIEW);

    expect(screen.getByText(en.assign.picker.truncated)).toBeInTheDocument();
  });
});

describe("AssignPage hands the components exactly what the S3b-2 form needs (EA-PII-1)", () => {
  const LEAKS = [
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
  ];

  /** Neither the HTML nor the props handed to a child hold any of `LEAKS`. */
  async function expectNoLeak(params: Params) {
    const ui = await build(params);
    const { container } = renderUi(ui);

    for (const text of [container.innerHTML, serializedProps(ui)]) {
      expect(text.length).toBeGreaterThan(0);
      for (const leak of LEAKS) expect(text).not.toContain(leak);
    }
    expect(serializedProps(ui)).toContain("2021-0001");
  }

  it("pins the props of the group list, the current group id included", async () => {
    loadMock.mockResolvedValue(
      assignData({
        groups: [
          group({ current: true }),
          group({ grupoId: 22, numeroGrupo: "03" }),
        ],
        currentGroup: CURRENT_GROUP,
      }),
    );

    const props = propsWith(await build(SUBJECT_VIEW), "currentGroup");

    // Strict: a key the page adds or lets through fails here. The current
    // group id is the `expectedReplaced` the form sends back (13.6).
    expect(props).toStrictEqual({
      student: { id: 11, nombreCompleto: "Ana Pérez", cif: "2021-0001" },
      asignatura: { id: 31, codigo: "MAT101", nombre: "Calculo I" },
      periodo: "2026-S2",
      groups: [
        {
          grupoId: 21,
          numeroGrupo: "02",
          docenteNombre: "Luis Gómez",
          dias: ["lunes", "miercoles"],
          current: true,
        },
        {
          grupoId: 22,
          numeroGrupo: "03",
          docenteNombre: "Luis Gómez",
          dias: ["lunes", "miercoles"],
          current: false,
        },
      ],
      currentGroup: CURRENT_GROUP,
    });
  });

  it("sends nothing else to the group list, even if the reads returned more", async () => {
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
        currentGroup: { ...CURRENT_GROUP, estudianteId: 11, creadoEn: "2026" },
      }),
    );

    await expectNoLeak(SUBJECT_VIEW);
  });

  it("sends the results list only the name, the CIF and the id", async () => {
    found(student({ correo: "ana@uni.edu", telefono: "555-0100" }));

    await expectNoLeak({ q: "ana" });
  });
});

describe("AssignPage structure and copy (EA-UI-1)", () => {
  const VARIANTS: [string, Params, () => unknown][] = [
    ["search", {}, () => undefined],
    ["results", { q: "ana" }, () => found(student())],
    ["no-results", { q: "zz" }, () => undefined],
    ["student", STUDENT_VIEW, () => undefined],
    ["groups", SUBJECT_VIEW, () => loadMock.mockResolvedValue(CURRENT())],
    ["degraded", STUDENT_VIEW, () => loadMock.mockResolvedValue(DEGRADED)],
    ["no-facultad", {}, () => scopeMock.mockResolvedValue({ kind: "none" })],
  ];

  it.each(VARIANTS)(
    "has one page frame, exactly one h1 and no skipped levels (%s)",
    async (_variant, params, arrange) => {
      arrange();

      await renderPage(params);

      expect(
        document.querySelectorAll('[data-slot="page-frame"]'),
      ).toHaveLength(1);
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

  it("renders the title, the search and the current-group marker in Spanish", async () => {
    state.locale = "es";
    loadMock.mockResolvedValue(CURRENT());

    await renderPage(SUBJECT_VIEW);

    const es = messages.es.catalog.inscripciones.assign;
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      es.title,
    );
    expect(screen.getByRole("search")).toHaveAccessibleName(es.search.form);
    expect(screen.getByText(es.groups.current)).toBeInTheDocument();
  });
});
