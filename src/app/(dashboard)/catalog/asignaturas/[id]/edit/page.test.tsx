import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../../../i18n/en.json";
import esMessages from "../../../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { ASIGNATURA_GRUPOS_MAX } from "@/lib/catalog/list-params";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  notFoundMock,
  getSessionMock,
  getCatalogActorMock,
  getByIdMock,
  carreraOptionsMock,
  gruposMock,
  updateActionMock,
  toggleActionMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  getSessionMock: vi.fn(),
  getCatalogActorMock: vi.fn(),
  getByIdMock: vi.fn(),
  carreraOptionsMock: vi.fn(),
  gruposMock: vi.fn(),
  updateActionMock: vi.fn(),
  toggleActionMock: vi.fn(),
  state: { locale: "en" as "en" | "es" },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/users", () => ({ getCatalogActor: getCatalogActorMock }));
vi.mock("@/lib/data/asignaturas", () => ({
  getAsignaturaById: getByIdMock,
  listCarreraOptions: carreraOptionsMock,
}));
vi.mock("@/lib/data/grupos", () => ({ listGruposByAsignatura: gruposMock }));
// The page reaches the actions only through a client module, so they are
// replaced here (the real module imports the database).
vi.mock("@/app/(dashboard)/catalog/asignaturas/actions", () => ({
  createAsignaturaAction: vi.fn(),
  updateAsignaturaAction: updateActionMock,
  setAsignaturaActivoAction: toggleActionMock,
}));

// The real catalogs through next-intl's own translator: a missing key throws.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async (namespace: string) =>
      createTranslator({
        locale: state.locale,
        messages: state.locale === "es" ? esMessages : enMessages,
        namespace: namespace as "catalog.asignaturas",
        onError: (error: Error) => {
          throw error;
        },
      }),
  };
});

function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

function detail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    codigo: "MAT101",
    nombre: "Calculus",
    carreraId: 3,
    carreraNombre: "Engineering",
    horasTotales: 64,
    activo: true,
    gruposActivos: 3,
    ...overrides,
  };
}

let Page: (props: {
  params: Promise<{ id: string }>;
}) => Promise<React.ReactNode>;

async function renderPage(id = "12") {
  const ui = await Page({ params: Promise.resolve({ id }) });
  return render(
    <NextIntlClientProvider
      locale={state.locale}
      messages={state.locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

const en = enMessages.catalog.asignaturas;
const shared = enMessages.catalog.shared;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/asignaturas/[id]/edit/page"))
    .default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getSessionMock.mockReset();
  getCatalogActorMock.mockReset();
  getCatalogActorMock.mockResolvedValue({ carreraId: null });
  getByIdMock.mockReset();
  getByIdMock.mockResolvedValue(detail());
  carreraOptionsMock.mockReset();
  carreraOptionsMock.mockResolvedValue([
    { id: 3, nombre: "Engineering" },
    { id: 4, nombre: "Law" },
  ]);
  gruposMock.mockReset();
  gruposMock.mockResolvedValue({ data: [], truncated: false, degraded: false });
  updateActionMock.mockReset();
  updateActionMock.mockResolvedValue({ kind: "idle" });
  toggleActionMock.mockReset();
  toggleActionMock.mockResolvedValue({ kind: "idle" });
});

describe("EditAsignaturaPage access (CM-ACC-1: matrix; the guard runs before params)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "renders the form for %s",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({
        carreraId: rol === "coordinacion" ? 3 : null,
      });

      await renderPage();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        en.page.editTitle,
      );
      expect(screen.getByLabelText(en.form.nombreLabel)).toHaveValue(
        "Calculus",
      );
      expect(redirectMock).not.toHaveBeenCalled();
      expect(notFoundMock).not.toHaveBeenCalled();
    },
  );

  it.each(rolesUsuario.filter((r) => r === "docente" || r === "estudiante"))(
    "sends %s to /denied without awaiting params or reading anything",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      const then = vi.fn();
      const params = { then } as unknown as Promise<{ id: string }>;

      await expect(Page({ params })).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(then).not.toHaveBeenCalled();
      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(getByIdMock).not.toHaveBeenCalled();
      expect(carreraOptionsMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it.each(["secretaria", "docente"] as const)(
    "sends a flagged %s to the change screen before anything else",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol, true));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${PASSWORD_CHANGE_PATH}`,
      );

      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(getByIdMock).not.toHaveBeenCalled();
    },
  );
});

describe("EditAsignaturaPage not found (CM-SCOPE-1: Foreign record by id; N1, N3)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it.each(["abc", "0", "01", "", "12abc", " 12", "-3"])(
    "answers not-found for the bad id %j without reading the record",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NEXT_NOT_FOUND");

      expect(notFoundMock).toHaveBeenCalledTimes(1);
      expect(getByIdMock).not.toHaveBeenCalled();
      expect(carreraOptionsMock).not.toHaveBeenCalled();
    },
  );

  it("answers the same not-found for a missing id and for a foreign id", async () => {
    getByIdMock.mockResolvedValue(null);
    const missing = await renderPage("99").catch((e: Error) => e);

    // A coordinacion of Carrera 3 asking for a record of another Carrera: the
    // scoped read answers null exactly as for a missing id.
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });
    const foreign = await renderPage("41").catch((e: Error) => e);

    expect(missing).toBeInstanceOf(Error);
    expect((missing as Error).message).toBe("NEXT_NOT_FOUND");
    expect((foreign as Error).message).toBe((missing as Error).message);
    expect(notFoundMock).toHaveBeenCalledTimes(2);
    expect(getByIdMock).toHaveBeenLastCalledWith(
      { kind: "carrera", carreraId: 3 },
      41,
    );
    expect(carreraOptionsMock).not.toHaveBeenCalled();
  });

  it("reads the record with the scope from the guard and the parsed id", async () => {
    await renderPage("12");

    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getByIdMock).toHaveBeenCalledWith({ kind: "all" }, 12);
  });

  it("lets a failing read propagate (no try, no fallback)", async () => {
    getByIdMock.mockRejectedValue(new Error("db down"));

    await expect(renderPage()).rejects.toThrow("db down");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("types params as a Promise and keeps notFound() out of any try block", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/catalog/asignaturas/[id]/edit/page.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("params: Promise<{ id: string }>");
    expect(source).not.toMatch(/\btry\s*\{/);
  });
});

describe("EditAsignaturaPage scope (CM-SCOPE-1: Selects offer only in-scope options; CM-SCOPE-2)", () => {
  it("offers the Carrera options of scope all to administrador", async () => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));

    await renderPage();

    expect(carreraOptionsMock).toHaveBeenCalledWith({ kind: "all" });
    expect(
      screen.getByRole("combobox", { name: en.form.carreraLabel }),
    ).toBeInTheDocument();
  });

  it("shows the record's own Carrera as text for coordinacion, with no select", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });

    await renderPage();

    expect(getByIdMock).toHaveBeenCalledWith(
      { kind: "carrera", carreraId: 3 },
      12,
    );
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("explains a coordinacion without a Carrera: no form, no read, no 404", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });

    await renderPage();

    expect(getByIdMock).not.toHaveBeenCalled();
    expect(carreraOptionsMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(screen.getByText(shared.noCarrera.title)).toBeInTheDocument();
    expect(screen.getByText(shared.noCarrera.message)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("EditAsignaturaPage active record (CM-ASG-3, CM-ASG-4, CM-UX-1)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  });

  it("renders the prefilled form with the Codigo as text and the import note", async () => {
    await renderPage();

    expect(screen.getByLabelText(en.form.nombreLabel)).toHaveValue("Calculus");
    expect(screen.getByLabelText(en.form.horasLabel)).toHaveValue(64);
    expect(screen.queryByRole("textbox", { name: en.form.codigoLabel })).toBe(
      null,
    );
    expect(screen.getByText("MAT101")).toBeInTheDocument();
    expect(screen.getByText(shared.importWins)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.form.submitSave }),
    ).toBeEnabled();
    expect(screen.queryByText(en.page.reactivateHint)).toBeNull();
  });

  it("has a State section with the pill and the deactivate control", async () => {
    await renderPage();

    const section = screen.getByRole("region", { name: en.state.title });
    expect(
      within(section).getByRole("heading", { level: 2 }),
    ).toHaveTextContent(en.state.title);
    expect(within(section).getByText(shared.status.active)).toBeVisible();
    expect(
      within(section).getByRole("button", { name: shared.toggle.deactivate }),
    ).toBeInTheDocument();
  });

  it("names the record and states the active-group count when deactivating", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole("button", { name: shared.toggle.deactivate }),
    );

    const group = await screen.findByRole("group");
    expect(group).toHaveTextContent("MAT101");
    expect(group).toHaveTextContent("Calculus");
    expect(group).toHaveTextContent(shared.toggle.nothingDeleted);
    expect(group).toHaveTextContent(
      "This subject has 3 active groups. Deactivate them before you can deactivate the subject.",
    );
  });

  it("says there are no active groups when the count is zero", async () => {
    getByIdMock.mockResolvedValue(detail({ gruposActivos: 0 }));
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole("button", { name: shared.toggle.deactivate }),
    );

    expect(await screen.findByRole("group")).toHaveTextContent(
      "This subject has no active groups.",
    );
  });

  it("confirming sends the id and the intent to the toggle action", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole("button", { name: shared.toggle.deactivate }),
    );
    await user.click(
      await screen.findByRole("button", { name: shared.toggle.confirm }),
    );

    await waitFor(() => expect(toggleActionMock).toHaveBeenCalledTimes(1));
    const formData = toggleActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("12");
    expect(formData.get("intent")).toBe("deactivate");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: shared.toggle.deactivate }),
      ).toBeEnabled(),
    );
  });

  it("saving sends the hidden id and the edited values to the update action", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.clear(screen.getByLabelText(en.form.nombreLabel));
    await user.type(screen.getByLabelText(en.form.nombreLabel), "Calculus II");
    await user.click(screen.getByRole("button", { name: en.form.submitSave }));

    await waitFor(() => expect(updateActionMock).toHaveBeenCalledTimes(1));
    const formData = updateActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("12");
    expect(formData.get("nombre")).toBe("Calculus II");
    expect(formData.has("codigo")).toBe(false);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.form.submitSave }),
      ).toBeEnabled(),
    );
  });
});

describe("EditAsignaturaPage inactive record (CM-ASG-3: Inactive record is read-only)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
    getByIdMock.mockResolvedValue(detail({ activo: false, gruposActivos: 0 }));
  });

  it("renders the fields read-only with no save control and says to reactivate first", async () => {
    await renderPage();

    expect(screen.getByLabelText(en.form.nombreLabel)).toHaveAttribute(
      "readonly",
    );
    expect(screen.getByLabelText(en.form.horasLabel)).toHaveAttribute(
      "readonly",
    );
    expect(screen.queryByRole("button", { name: en.form.submitSave })).toBe(
      null,
    );
    expect(screen.getByText(shared.refusals.inactive)).toBeInTheDocument();
    expect(screen.getByText(en.page.reactivateHint)).toBeInTheDocument();
  });

  it("offers the reactivate control in the State section, as a single press", async () => {
    const user = userEvent.setup();
    await renderPage();

    const section = screen.getByRole("region", { name: en.state.title });
    expect(within(section).getByText(shared.status.inactive)).toBeVisible();
    await user.click(
      within(section).getByRole("button", { name: shared.toggle.reactivate }),
    );

    await waitFor(() => expect(toggleActionMock).toHaveBeenCalledTimes(1));
    const formData = toggleActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("12");
    expect(formData.get("intent")).toBe("reactivate");
    expect(screen.queryByRole("group")).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: shared.toggle.reactivate }),
      ).toBeEnabled(),
    );
  });

  it("never nests one form inside another", async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll("form form")).toHaveLength(0);
    expect(container.querySelectorAll("form").length).toBeGreaterThan(0);
  });
});

describe("EditAsignaturaPage structure (CM-NFR-3; the only 'you are here' marker is the breadcrumb)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("has a breadcrumb back to the list whose current segment names the record", async () => {
    const { container } = await renderPage();

    const nav = screen.getByRole("navigation", { name: en.breadcrumb.label });
    expect(within(nav).getByRole("link", { name: en.title })).toHaveAttribute(
      "href",
      "/catalog/asignaturas",
    );
    const current = nav.querySelector(".is-current");
    expect(current).toHaveTextContent("Edit MAT101");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(container.querySelectorAll(".is-current")).toHaveLength(1);
    expect(container.querySelectorAll("[aria-current]")).toHaveLength(1);
  });

  it("has one h1 and no skipped heading level", async () => {
    await renderPage();

    const levels = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, i) => {
      expect(level).toBeLessThanOrEqual(levels[i] + 1);
    });
  });

  it("renders in Spanish from the real catalog", async () => {
    state.locale = "es";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      esMessages.catalog.asignaturas.page.editTitle,
    );
    expect(
      screen.getByRole("region", {
        name: esMessages.catalog.asignaturas.state.title,
      }),
    ).toBeInTheDocument();
  });
});

const enGrupos = en.grupos;

function grupo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 31,
    asignaturaId: 12,
    asignaturaCodigo: "MAT101",
    asignaturaNombre: "Calculus",
    periodo: "2026-S2",
    numeroGrupo: "A",
    docenteId: 5,
    docenteNombre: "Ana Pérez",
    activo: true,
    origen: "manual",
    dias: ["lunes", "jueves"],
    ...overrides,
  };
}

/** Newest period first, then group number, as the read answers them. */
const THREE_GRUPOS = [
  grupo(),
  grupo({
    id: 30,
    periodo: "2026-S1",
    numeroGrupo: "B",
    docenteNombre: "Luis Gómez",
    activo: false,
    dias: ["sabado"],
  }),
  grupo({ id: 29, periodo: "2025-S2", dias: [] }),
];

function answer(overrides: Partial<Record<string, unknown>> = {}) {
  return { data: [], truncated: false, degraded: false, ...overrides };
}

const gruposRegion = (name = enGrupos.title) =>
  screen.getByRole("region", { name });

describe("EditAsignaturaPage Grupos section rows and links (CM-ASG-7, CM-GRP-7)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("lists every group in the order received with period, number, teacher, days and status", async () => {
    gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));
    await renderPage();

    const table = within(gruposRegion()).getByRole("table", {
      name: "Groups of MAT101",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual([
      enGrupos.columns.periodo,
      enGrupos.columns.numeroGrupo,
      enGrupos.columns.docente,
      enGrupos.columns.dias,
      enGrupos.columns.status,
      enGrupos.columns.actions,
    ]);
    const [, ...rows] = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);

    const first = within(rows[0]).getAllByRole("cell");
    expect(first[0]).toHaveTextContent("2026-S2");
    expect(first[1]).toHaveTextContent("A");
    expect(first[2]).toHaveTextContent("Ana Pérez");
    expect(within(first[3]).getByText("Mon, Thu")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(within(first[3]).getByText("Monday, Thursday")).toHaveClass(
      "sr-only",
    );
    expect(first[4]).toHaveTextContent(shared.status.active);

    const second = within(rows[1]).getAllByRole("cell");
    expect(second[0]).toHaveTextContent("2026-S1");
    expect(second[1]).toHaveTextContent("B");
    expect(second[2]).toHaveTextContent("Luis Gómez");
    expect(within(second[3]).getByText("Sat")).toBeInTheDocument();
    expect(second[4]).toHaveTextContent(shared.status.inactive);

    const third = within(rows[2]).getAllByRole("cell");
    expect(third[0]).toHaveTextContent("2025-S2");
    expect(third[3]).toHaveTextContent(shared.dias.notSet);
  });

  it("links each row to its own edit page with a label naming period and number", async () => {
    gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));
    await renderPage();

    const links = within(gruposRegion()).getAllByRole("link", {
      name: /^Edit group/,
    });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/catalog/asignaturas/12/grupos/31/edit",
      "/catalog/asignaturas/12/grupos/30/edit",
      "/catalog/asignaturas/12/grupos/29/edit",
    ]);
    expect(links.map((l) => l.getAttribute("aria-label"))).toEqual([
      "Edit group 2026-S2 A",
      "Edit group 2026-S1 B",
      "Edit group 2025-S2 A",
    ]);
    for (const link of links) expect(link).toHaveTextContent(enGrupos.edit);
  });

  it.each([
    ["administrador", { kind: "all" }, null],
    ["coordinacion", { kind: "carrera", carreraId: 3 }, 3],
    ["secretaria", { kind: "all" }, null],
  ] as const)(
    "gives %s the section, read with the scope and the record id",
    async (rol, scope, carreraId) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({ carreraId });
      gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));

      await renderPage();

      expect(gruposMock).toHaveBeenCalledTimes(1);
      expect(gruposMock).toHaveBeenCalledWith(scope, 12);
      expect(
        within(gruposRegion()).getAllByRole("link", { name: /^Edit group/ }),
      ).toHaveLength(3);
    },
  );

  it("sits after the form and before the State section", async () => {
    gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));
    await renderPage();

    const form = screen.getByLabelText(en.form.nombreLabel);
    const grupos = gruposRegion();
    const stateSection = screen.getByRole("region", { name: en.state.title });
    expect(
      form.compareDocumentPosition(grupos) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      grupos.compareDocumentPosition(stateSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it.each([
    ["12", 12],
    ["345", 345],
  ] as const)(
    "an active subject with rows shows exactly one Add group link built from the numeric id %s",
    async (param, id) => {
      getByIdMock.mockResolvedValue(detail({ id }));
      gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));
      await renderPage(param);

      const adds = screen.getAllByRole("link", { name: enGrupos.add });
      expect(adds).toHaveLength(1);
      expect(adds[0]).toHaveAttribute(
        "href",
        `/catalog/asignaturas/${id}/grupos/new`,
      );
      expect(gruposRegion()).toContainElement(adds[0]);
      expect(gruposMock).toHaveBeenCalledWith({ kind: "all" }, id);
    },
  );

  it("an active subject with no groups shows the empty state whose only link is Add group", async () => {
    await renderPage();

    const region = gruposRegion();
    expect(within(region).getByText(enGrupos.empty)).toBeInTheDocument();
    expect(within(region).queryByRole("table")).toBeNull();
    const links = within(region).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent(enGrupos.add);
    expect(links[0]).toHaveAttribute(
      "href",
      "/catalog/asignaturas/12/grupos/new",
    );
    expect(screen.getAllByRole("link", { name: enGrupos.add })).toHaveLength(1);
  });

  it("an inactive subject with rows shows the reactivate hint, the rows and no Add group link", async () => {
    getByIdMock.mockResolvedValue(detail({ activo: false, gruposActivos: 0 }));
    gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));
    await renderPage();

    const region = gruposRegion();
    expect(within(region).getByText(enGrupos.inactiveHint)).toBeInTheDocument();
    expect(
      within(region).getAllByRole("link", { name: /^Edit group/ }),
    ).toHaveLength(3);
    expect(screen.queryByRole("link", { name: enGrupos.add })).toBeNull();
    expect(
      screen
        .queryAllByRole("link")
        .filter((l) => l.getAttribute("href")?.includes("/grupos/new")),
    ).toHaveLength(0);
  });

  it("an inactive subject with no groups shows the hint and the empty sentence with no action", async () => {
    getByIdMock.mockResolvedValue(detail({ activo: false, gruposActivos: 0 }));
    await renderPage();

    const region = gruposRegion();
    expect(within(region).getByText(enGrupos.inactiveHint)).toBeInTheDocument();
    expect(within(region).getByText(enGrupos.empty)).toBeInTheDocument();
    expect(within(region).queryByRole("table")).toBeNull();
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
    expect(within(region).queryByRole("button")).toBeNull();
  });

  it("renders the section in Spanish from the real catalog", async () => {
    state.locale = "es";
    gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));
    await renderPage();

    const es = esMessages.catalog.asignaturas.grupos;
    const region = gruposRegion(es.title);
    const table = within(region).getByRole("table", {
      name: "Grupos de MAT101",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual([
      es.columns.periodo,
      es.columns.numeroGrupo,
      es.columns.docente,
      es.columns.dias,
      es.columns.status,
      es.columns.actions,
    ]);
    expect(
      within(region).getByRole("link", { name: es.add }),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("link", { name: "Editar grupo 2026-S2 A" }),
    ).toHaveAttribute("href", "/catalog/asignaturas/12/grupos/31/edit");
  });

  // CM-ASG-7 "Active and inactive groups are listed": the parent in each Edit
  // link is the page's own Asignatura (a second id rules out a constant), and
  // an inactive Asignatura keeps its groups editable (they stay reachable to
  // be reactivated).
  it.each([
    ["an active", true],
    ["an inactive", false],
  ] as const)(
    "builds every Edit link under the page's own Asignatura (%s subject, id 345)",
    async (_label, activo) => {
      getByIdMock.mockResolvedValue(detail({ id: 345, activo }));
      gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));
      await renderPage("345");

      const links = within(gruposRegion()).getAllByRole("link", {
        name: /^Edit group/,
      });
      expect(links.map((l) => l.getAttribute("href"))).toEqual([
        "/catalog/asignaturas/345/grupos/31/edit",
        "/catalog/asignaturas/345/grupos/30/edit",
        "/catalog/asignaturas/345/grupos/29/edit",
      ]);
    },
  );
});

describe("EditAsignaturaPage Grupos section degraded, cap, scope and structure (CM-ASG-7, CM-SCOPE-1, CM-SCOPE-2, CM-NFR-3)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it.each([
    ["active", true],
    ["inactive", false],
  ] as const)(
    "a failed read on an %s subject shows a status notice, no table and never the empty sentence",
    async (_label, activo) => {
      getByIdMock.mockResolvedValue(detail({ activo, gruposActivos: 0 }));
      gruposMock.mockResolvedValue(answer({ degraded: true }));
      await renderPage();

      const region = gruposRegion();
      const notice = within(region).getByRole("status");
      expect(notice).toHaveTextContent(enGrupos.degraded);
      expect(within(region).queryByRole("table")).toBeNull();
      expect(screen.queryByText(enGrupos.empty)).toBeNull();
      expect(
        screen.queryAllByRole("link", { name: enGrupos.add }),
      ).toHaveLength(activo ? 1 : 0);
      // The rest of the page still renders.
      expect(screen.getByLabelText(en.form.nombreLabel)).toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: en.state.title }),
      ).toBeInTheDocument();
    },
  );

  it("past the cap shows the table, then the note with the cap, and no link to any list (CM-ASG-7 More groups than the cap)", async () => {
    gruposMock.mockResolvedValue(
      answer({ data: THREE_GRUPOS, truncated: true }),
    );
    await renderPage();

    const region = gruposRegion();
    const table = within(region).getByRole("table");
    const note = within(region).getByText(
      `Showing the ${ASIGNATURA_GRUPOS_MAX} most recent groups.`,
    );
    expect(
      table.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(note.querySelector("a")).toBeNull();
    // Only Add group and the three Edit links: nothing points at a list.
    const hrefs = within(region)
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual([
      "/catalog/asignaturas/12/grupos/new",
      "/catalog/asignaturas/12/grupos/31/edit",
      "/catalog/asignaturas/12/grupos/30/edit",
      "/catalog/asignaturas/12/grupos/29/edit",
    ]);
    expect(
      within(region).getAllByRole("link", { name: enGrupos.add }),
    ).toHaveLength(1);
  });

  it("a code with an ampersand and a space reaches no URL, and Add group stays numeric", async () => {
    getByIdMock.mockResolvedValue(detail({ codigo: "A&B C" }));
    gruposMock.mockResolvedValue(
      answer({ data: THREE_GRUPOS, truncated: true }),
    );
    await renderPage();

    for (const link of within(gruposRegion()).getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(
        /^\/catalog\/asignaturas\/12\//,
      );
      expect(link.getAttribute("href")).not.toMatch(/[?&% ]|A&B/);
    }
    expect(screen.getByRole("link", { name: enGrupos.add })).toHaveAttribute(
      "href",
      "/catalog/asignaturas/12/grupos/new",
    );
  });

  it("shows no note when the list is not cut", async () => {
    gruposMock.mockResolvedValue(answer({ data: THREE_GRUPOS }));
    await renderPage();

    const region = gruposRegion();
    expect(within(region).getByRole("table")).toBeInTheDocument();
    expect(within(region).queryByText(/most recent groups/)).toBeNull();
  });

  it.each(["abc", "0", "-3", ""])(
    "never reads the groups for the malformed id %j",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NEXT_NOT_FOUND");

      expect(gruposMock).not.toHaveBeenCalled();
    },
  );

  it("never reads the groups for a missing id or for an id of another Carrera, with the same not-found", async () => {
    getByIdMock.mockResolvedValue(null);
    const missing = await renderPage("99").catch((e: Error) => e);
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });
    const foreign = await renderPage("41").catch((e: Error) => e);

    expect((missing as Error).message).toBe("NEXT_NOT_FOUND");
    expect((foreign as Error).message).toBe("NEXT_NOT_FOUND");
    expect(gruposMock).not.toHaveBeenCalled();
  });

  it("never reads the groups for a coordinacion without a Carrera", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });
    await renderPage();

    expect(gruposMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: enGrupos.title })).toBeNull();
    expect(screen.queryByRole("link", { name: enGrupos.add })).toBeNull();
  });

  it.each(["docente", "estudiante"] as const)(
    "never reads the groups for %s",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );
      expect(gruposMock).not.toHaveBeenCalled();
    },
  );

  it("keeps one h1, no skipped level, one aria-current and one is-current with the section on the page", async () => {
    gruposMock.mockResolvedValue(
      answer({ data: THREE_GRUPOS, truncated: true }),
    );
    const { container } = await renderPage();

    const levels = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(
      within(gruposRegion()).getByRole("heading", { level: 2 }),
    ).toHaveTextContent(enGrupos.title);
    levels.slice(1).forEach((level, i) => {
      expect(level).toBeLessThanOrEqual(levels[i] + 1);
    });
    expect(container.querySelectorAll("[aria-current]")).toHaveLength(1);
    expect(container.querySelectorAll(".is-current")).toHaveLength(1);
  });

  it("the page and the section import no actions module and the section is a plain server component", () => {
    const dir = join(process.cwd(), "src/app/(dashboard)/catalog/asignaturas");
    const section = readFileSync(
      join(dir, "asignatura-grupos-section.tsx"),
      "utf8",
    );
    const page = readFileSync(join(dir, "[id]/edit/page.tsx"), "utf8");

    for (const source of [section, page]) {
      expect(source).not.toMatch(/from\s+["'][^"']*\/actions["']/);
      expect(source).not.toMatch(/["']use server["']/);
    }
    expect(section).not.toMatch(/["']use client["']/);
    expect(section).not.toMatch(/from\s+["']@\/lib\/data\//);
    expect(section).not.toMatch(/is-current|aria-current/);
  });
});
