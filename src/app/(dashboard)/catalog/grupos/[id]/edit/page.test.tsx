import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../../../i18n/en.json";
import esMessages from "../../../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  notFoundMock,
  getSessionMock,
  getCatalogActorMock,
  getByIdMock,
  asignaturaOptionsMock,
  docenteOptionsMock,
  updateActionMock,
  toggleActionMock,
  formPropsSpy,
  toggleProps,
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
  asignaturaOptionsMock: vi.fn(),
  docenteOptionsMock: vi.fn(),
  updateActionMock: vi.fn(),
  toggleActionMock: vi.fn(),
  formPropsSpy: vi.fn<(props: unknown) => void>(),
  toggleProps: vi.fn<(props: unknown) => void>(),
  state: { locale: "en" as "en" | "es" },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/users", () => ({
  getCatalogActor: getCatalogActorMock,
  listDocenteOptions: docenteOptionsMock,
}));
vi.mock("@/lib/data/asignaturas", () => ({
  listAsignaturaOptions: asignaturaOptionsMock,
}));
vi.mock("@/lib/data/grupos", () => ({ getGrupoById: getByIdMock }));
// The page reaches the actions only through a client module, so they are
// replaced here (the real module imports the database).
vi.mock("@/app/(dashboard)/catalog/grupos/actions", () => ({
  createGrupoAction: vi.fn(),
  updateGrupoAction: updateActionMock,
  setGrupoActivoAction: toggleActionMock,
}));
// The real form and toggle render, wrapped so the test can read exactly what
// the page handed to them.
vi.mock(
  "@/app/(dashboard)/catalog/grupos/grupo-form",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/app/(dashboard)/catalog/grupos/grupo-form")
      >();
    return {
      ...actual,
      GrupoForm: (props: ComponentProps<typeof actual.GrupoForm>) => {
        formPropsSpy(props);
        return <actual.GrupoForm {...props} />;
      },
    };
  },
);
vi.mock("@/app/(dashboard)/catalog/active-toggle", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/app/(dashboard)/catalog/active-toggle")
    >();
  return {
    ...actual,
    ActiveToggle: (props: ComponentProps<typeof actual.ActiveToggle>) => {
      toggleProps(props);
      return <actual.ActiveToggle {...props} />;
    },
  };
});

// The real catalogs through next-intl's own translator: a missing key throws.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async (namespace: string) =>
      createTranslator({
        locale: state.locale,
        messages: state.locale === "es" ? esMessages : enMessages,
        namespace: namespace as "catalog.grupos",
        onError: (error: Error) => {
          throw error;
        },
      }),
  };
});

// Copy that does not exist yet. The page piece (13.7) authors these keys with
// exactly these strings: `catalog.grupos.page.editTitle`, `page.editSubtitle`,
// `page.reactivateHint`, `breadcrumb.label`, `breadcrumb.edit` (takes
// `{codigo}`, `{periodo}` and `{numeroGrupo}`) and `state.title`. Everything
// else is read from the real catalogs (`catalog.grupos.form.*`,
// `catalog.grupos.list.title`, `catalog.shared.*`).
const TEXT = {
  en: {
    editTitle: "Edit group",
    editSubtitle: "Update the group's teacher and meeting days.",
    reactivateHint: "To edit it, reactivate it first in the Status section.",
    breadcrumbLabel: "Breadcrumb",
    breadcrumbEdit: "Edit MAT101 2026-S1 A",
    stateTitle: "Status",
  },
  es: {
    editTitle: "Editar grupo",
    editSubtitle: "Actualiza el docente y los días de clase del grupo.",
    reactivateHint: "Para editarlo, primero reactívalo en la sección Estado.",
    breadcrumbLabel: "Ruta de navegación",
    breadcrumbEdit: "Editar MAT101 2026-S1 A",
    stateTitle: "Estado",
  },
} as const;

const DOCENTES = [
  { id: 7, nombreCompleto: "Ana Ruiz", correo: "ana@example.edu" },
  { id: 8, nombreCompleto: "Luis Mora", correo: null },
];

function detail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    asignaturaId: 1,
    asignaturaCodigo: "MAT101",
    asignaturaNombre: "Algebra",
    periodo: "2026-S1",
    numeroGrupo: "A",
    docenteId: 7,
    docenteNombre: "Ana Ruiz",
    activo: true,
    origen: "manual",
    dias: ["lunes", "jueves"],
    ...overrides,
  };
}

function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
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

type FormProps = {
  action: unknown;
  asignaturas: unknown;
  docentes: unknown;
  asignaturasTruncated?: boolean;
  docentesTruncated?: boolean;
  record?: unknown;
  reactivate?: unknown;
};

type ToggleProps = {
  action: unknown;
  id: number;
  recordLabel: string;
  activo: boolean;
  notice?: string;
};

/** The props of the last `GrupoForm` render. */
function formProps(): FormProps {
  const last = formPropsSpy.mock.lastCall;
  expect(last, "GrupoForm was rendered").toBeDefined();
  return last![0] as FormProps;
}

/** The props of the last `ActiveToggle` render. */
function lastToggleProps(): ToggleProps {
  const last = toggleProps.mock.lastCall;
  expect(last, "ActiveToggle was rendered").toBeDefined();
  return last![0] as ToggleProps;
}

/** The codes of the checked day boxes. */
async function checkedDays() {
  const boxes = (await screen.findAllByRole("checkbox")) as HTMLInputElement[];
  return boxes.filter((box) => box.checked).map((box) => box.value);
}

function many(count: number, make: (id: number) => object) {
  return Array.from({ length: count }, (_, i) => make(i + 1));
}

const en = enMessages.catalog.grupos;
const shared = enMessages.catalog.shared;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/grupos/[id]/edit/page"))
    .default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  formPropsSpy.mockClear();
  toggleProps.mockClear();
  getSessionMock.mockReset();
  getCatalogActorMock.mockReset();
  getCatalogActorMock.mockResolvedValue({ carreraId: null });
  getByIdMock.mockReset();
  getByIdMock.mockResolvedValue(detail());
  asignaturaOptionsMock.mockReset();
  asignaturaOptionsMock.mockResolvedValue([]);
  docenteOptionsMock.mockReset();
  docenteOptionsMock.mockResolvedValue(DOCENTES);
  updateActionMock.mockReset();
  updateActionMock.mockResolvedValue({ kind: "idle" });
  toggleActionMock.mockReset();
  toggleActionMock.mockResolvedValue({ kind: "idle" });
});

describe("EditGrupoPage access (CM-ACC-1: matrix; the guard runs before params)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "renders the form for %s",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({
        carreraId: rol === "coordinacion" ? 3 : null,
      });

      await renderPage();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        TEXT.en.editTitle,
      );
      expect(
        await screen.findByRole("combobox", { name: en.form.docenteLabel }),
      ).toHaveValue("Ana Ruiz");
      expect(
        screen.getByRole("button", { name: en.form.submitSave }),
      ).toBeEnabled();
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
      expect(docenteOptionsMock).not.toHaveBeenCalled();
      expect(asignaturaOptionsMock).not.toHaveBeenCalled();
      expect(formPropsSpy).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    expect(getCatalogActorMock).not.toHaveBeenCalled();
    expect(getByIdMock).not.toHaveBeenCalled();
    expect(docenteOptionsMock).not.toHaveBeenCalled();
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
      expect(docenteOptionsMock).not.toHaveBeenCalled();
    },
  );
});

describe("EditGrupoPage not found (CM-SCOPE-1: Foreign record by id; N1, N3)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it.each(["abc", "0", "01", "", "12abc", " 12", "-3"])(
    "answers not-found for the bad id %j without reading the record",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NEXT_NOT_FOUND");

      expect(notFoundMock).toHaveBeenCalledTimes(1);
      expect(getByIdMock).not.toHaveBeenCalled();
      expect(docenteOptionsMock).not.toHaveBeenCalled();
    },
  );

  it("answers the same not-found for a missing id and for a foreign id", async () => {
    getByIdMock.mockResolvedValue(null);
    const missing = await renderPage("99").catch((e: Error) => e);

    // A coordinacion of Carrera 3 asking for a group of another Carrera: the
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
    expect(docenteOptionsMock).not.toHaveBeenCalled();
    expect(formPropsSpy).not.toHaveBeenCalled();
  });

  it("reads the record with the scope from the guard and the parsed id", async () => {
    await renderPage("12");

    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getByIdMock).toHaveBeenCalledWith({ kind: "all" }, 12);
  });

  it("lets a failing record read propagate (no try, no fallback)", async () => {
    getByIdMock.mockRejectedValue(new Error("db down"));

    await expect(renderPage()).rejects.toThrow("db down");
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(docenteOptionsMock).not.toHaveBeenCalled();
  });

  it("lets a failing docente read propagate (no try, no fallback)", async () => {
    docenteOptionsMock.mockRejectedValue(new Error("options down"));

    await expect(renderPage()).rejects.toThrow("options down");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("types params as a Promise and keeps notFound() out of any try block", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/catalog/grupos/[id]/edit/page.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("params: Promise<{ id: string }>");
    expect(source).not.toMatch(/\btry\s*\{/);
  });
});

describe("EditGrupoPage scope (CM-SCOPE-1, CM-SCOPE-2)", () => {
  it("reads a coordinacion's group with its Carrera scope", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });

    await renderPage();

    expect(getByIdMock).toHaveBeenCalledWith(
      { kind: "carrera", carreraId: 3 },
      12,
    );
    expect(
      screen.getByRole("button", { name: en.form.submitSave }),
    ).toBeEnabled();
  });

  it("explains a coordinacion without a Carrera: no form, no read, no 404", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });

    await renderPage();

    expect(getByIdMock).not.toHaveBeenCalled();
    expect(docenteOptionsMock).not.toHaveBeenCalled();
    expect(asignaturaOptionsMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(formPropsSpy).not.toHaveBeenCalled();
    expect(toggleProps).not.toHaveBeenCalled();
    expect(screen.getByText(shared.noCarrera.title)).toBeInTheDocument();
    expect(screen.getByText(shared.noCarrera.message)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      TEXT.en.editTitle,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("EditGrupoPage options (CM-GRP-2: only the docente and the days are editable)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  });

  it("queries the docentes once and never the Asignaturas", async () => {
    await renderPage();

    expect(docenteOptionsMock).toHaveBeenCalledTimes(1);
    expect(docenteOptionsMock).toHaveBeenCalledWith();
    expect(asignaturaOptionsMock).not.toHaveBeenCalled();
    expect(formProps().asignaturas).toEqual([]);
    expect(
      screen.queryByRole("combobox", { name: en.form.asignaturaLabel }),
    ).toBeNull();
  });

  it("passes the docentes to the client form without their e-mail", async () => {
    await renderPage();

    expect(formProps().docentes).toEqual([
      { id: 7, nombreCompleto: "Ana Ruiz" },
      { id: 8, nombreCompleto: "Luis Mora" },
    ]);
  });

  it("keeps a docente that is no longer listed selectable under its stored name", async () => {
    getByIdMock.mockResolvedValue(
      detail({ docenteId: 99, docenteNombre: "Rosa Vega" }),
    );

    await renderPage();

    expect(
      await screen.findByRole("combobox", { name: en.form.docenteLabel }),
    ).toHaveValue("Rosa Vega");
  });

  it("flags nothing while the docente list is under the cap", async () => {
    docenteOptionsMock.mockResolvedValue(
      many(CATALOG_OPTIONS_MAX - 1, (id) => ({
        id,
        nombreCompleto: `D${id}`,
        correo: null,
      })),
    );

    await renderPage();

    const props = formProps();
    expect(props.docentesTruncated ?? false).toBe(false);
    expect(props.asignaturasTruncated ?? false).toBe(false);
    expect(screen.queryByText(en.form.truncated)).toBeNull();
  });

  it("flags the docente list when it holds the cap", async () => {
    docenteOptionsMock.mockResolvedValue(
      many(CATALOG_OPTIONS_MAX, (id) => ({
        id,
        nombreCompleto: `D${id}`,
        correo: null,
      })),
    );

    await renderPage();

    const props = formProps();
    expect(props.docentesTruncated).toBe(true);
    expect(props.asignaturasTruncated ?? false).toBe(false);
    expect(screen.getAllByText(en.form.truncated)).toHaveLength(1);
    expect(
      await screen.findByRole("combobox", { name: en.form.docenteLabel }),
    ).toHaveAccessibleDescription(en.form.truncated);
  });
});

describe("EditGrupoPage active record (CM-GRP-2, CM-GRP-4, CM-GRP-6, CM-UX-1)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  });

  it("hands the form every field of the record, bound to the update action", async () => {
    await renderPage();

    const props = formProps();
    expect(props.action).toBe(updateActionMock);
    // Exactly the form record: nothing else of the stored row crosses over.
    expect(props.record).toEqual({
      id: 12,
      asignaturaCodigo: "MAT101",
      asignaturaNombre: "Algebra",
      periodo: "2026-S1",
      numeroGrupo: "A",
      docenteId: 7,
      docenteNombre: "Ana Ruiz",
      activo: true,
      dias: ["lunes", "jueves"],
    });
    expect(props.reactivate).toBeUndefined();
  });

  it("shows the natural key as text, the docente and the days prefilled, and the import note", async () => {
    await renderPage();

    expect(screen.getByLabelText(en.form.asignaturaLabel)).toHaveTextContent(
      "MAT101 - Algebra",
    );
    expect(screen.getByLabelText(en.form.periodoLabel)).toHaveTextContent(
      "2026-S1",
    );
    expect(screen.getByLabelText(en.form.numeroGrupoLabel)).toHaveTextContent(
      "A",
    );
    expect(screen.getByText(en.form.naturalKeyHint)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      await screen.findByRole("combobox", { name: en.form.docenteLabel }),
    ).toHaveValue("Ana Ruiz");
    expect(await checkedDays()).toEqual(["lunes", "jueves"]);
    expect(screen.getByText(shared.importWins)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.form.submitSave }),
    ).toBeEnabled();
    expect(screen.queryByText(TEXT.en.reactivateHint)).toBeNull();
  });

  it("opens a legacy group with no days with no day checked", async () => {
    getByIdMock.mockResolvedValue(detail({ dias: [] }));

    await renderPage();

    expect(formProps().record).toMatchObject({ dias: [] });
    expect(await checkedDays()).toEqual([]);
    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: en.form.submitSave }),
    ).toBeEnabled();
  });

  it("has a State section with the pill and the deactivate control", async () => {
    await renderPage();

    const section = screen.getByRole("region", { name: TEXT.en.stateTitle });
    expect(
      within(section).getByRole("heading", { level: 2 }),
    ).toHaveTextContent(TEXT.en.stateTitle);
    expect(within(section).getByText(shared.status.active)).toBeVisible();
    expect(
      within(section).getByRole("button", { name: shared.toggle.deactivate }),
    ).toBeInTheDocument();
  });

  it("gives the toggle the id, the action and a label that names the record", async () => {
    await renderPage();

    const props = lastToggleProps();
    expect(props.action).toBe(toggleActionMock);
    expect(props.id).toBe(12);
    expect(props.activo).toBe(true);
    for (const part of ["MAT101", "Algebra", "2026-S1", "A"]) {
      expect(props.recordLabel).toContain(part);
    }
    // A group has no dependents that block its deactivation.
    expect(props.notice).toBeUndefined();
  });

  it("names the record when deactivating and adds no blocking note", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole("button", { name: shared.toggle.deactivate }),
    );

    const group = await screen.findByRole("group", { name: /MAT101/ });
    expect(group).toHaveTextContent("MAT101");
    expect(group).toHaveTextContent("Algebra");
    expect(group).toHaveTextContent("2026-S1");
    expect(group).toHaveTextContent(shared.toggle.nothingDeleted);
    expect(within(group).getAllByRole("paragraph")).toHaveLength(2);
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

  it("saving sends the hidden id, the chosen docente and the edited days to the update action", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      await screen.findByRole("combobox", { name: en.form.docenteLabel }),
    );
    await user.click(await screen.findByRole("option", { name: "Luis Mora" }));
    await user.click(
      screen.getByRole("checkbox", { name: shared.dias.long.jueves }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: shared.dias.long.viernes }),
    );
    await user.click(screen.getByRole("button", { name: en.form.submitSave }));

    await waitFor(() => expect(updateActionMock).toHaveBeenCalledTimes(1));
    const formData = updateActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("12");
    expect(formData.get("docenteId")).toBe("8");
    expect(formData.getAll("dias")).toEqual(["lunes", "viernes"]);
    // The natural key is never submitted from the edit form.
    expect(formData.has("asignaturaId")).toBe(false);
    expect(formData.has("periodo")).toBe(false);
    expect(formData.has("numeroGrupo")).toBe(false);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.form.submitSave }),
      ).toBeEnabled(),
    );
  });
});

describe("EditGrupoPage inactive record (CM-GRP-2: an inactive group is read-only)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
    getByIdMock.mockResolvedValue(detail({ activo: false }));
  });

  it("locks the form, says to reactivate first and offers no save control", async () => {
    await renderPage();

    expect(formProps().record).toMatchObject({ activo: false });
    expect(
      await screen.findByRole("combobox", { name: en.form.docenteLabel }),
    ).toBeDisabled();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(7);
    boxes.forEach((box) => expect(box).toBeDisabled());
    expect(await checkedDays()).toEqual(["lunes", "jueves"]);
    expect(screen.queryByRole("button", { name: en.form.submitSave })).toBe(
      null,
    );
    expect(screen.getByText(shared.refusals.inactive)).toBeInTheDocument();
    expect(screen.getByText(TEXT.en.reactivateHint)).toBeInTheDocument();
  });

  it("hands the form a plain hint in the reactivate slot, not the toggle", async () => {
    await renderPage();

    expect(formProps().reactivate).toBeDefined();
    // One toggle only: the one in the State section.
    expect(toggleProps).toHaveBeenCalled();
    expect(
      screen.getAllByRole("button", { name: shared.toggle.reactivate }),
    ).toHaveLength(1);
  });

  it("offers the reactivate control in the State section, as a single press", async () => {
    const user = userEvent.setup();
    await renderPage();

    const section = screen.getByRole("region", { name: TEXT.en.stateTitle });
    expect(within(section).getByText(shared.status.inactive)).toBeVisible();
    expect(lastToggleProps().activo).toBe(false);
    await user.click(
      within(section).getByRole("button", { name: shared.toggle.reactivate }),
    );

    await waitFor(() => expect(toggleActionMock).toHaveBeenCalledTimes(1));
    const formData = toggleActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("12");
    expect(formData.get("intent")).toBe("reactivate");
    // No confirmation step (the days fieldset is also a "group", so match the
    // confirmation by the record it names).
    expect(screen.queryByRole("group", { name: /MAT101/ })).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: shared.toggle.reactivate }),
      ).toBeEnabled(),
    );
  });

  it("never nests one form inside another", async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll("form form")).toHaveLength(0);
    expect(container.querySelectorAll("form")).toHaveLength(2);
  });
});

describe("EditGrupoPage structure (CM-NFR-3; the only 'you are here' marker is the breadcrumb)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("has a breadcrumb back to the list whose current segment names the record", async () => {
    const { container } = await renderPage();

    const nav = screen.getByRole("navigation", {
      name: TEXT.en.breadcrumbLabel,
    });
    expect(
      within(nav).getByRole("link", { name: en.list.title }),
    ).toHaveAttribute("href", "/catalog/grupos");
    const current = nav.querySelector(".is-current");
    expect(current).toHaveTextContent(TEXT.en.breadcrumbEdit);
    expect(current).toHaveAttribute("aria-current", "page");
    // The marker appears once and nowhere else on the page.
    expect(container.querySelectorAll(".is-current")).toHaveLength(1);
    expect(container.querySelectorAll("[aria-current]")).toHaveLength(1);
  });

  it("has one h1 with the subtitle, one h2 for the State and no skipped level", async () => {
    await renderPage();

    expect(screen.getByText(TEXT.en.editSubtitle)).toBeInTheDocument();
    const levels = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels.filter((l) => l === 2)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, i) => {
      expect(level).toBeLessThanOrEqual(levels[i] + 1);
    });
  });

  it("renders in Spanish from the real catalog", async () => {
    state.locale = "es";
    const es = esMessages.catalog.grupos;

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      TEXT.es.editTitle,
    );
    expect(screen.getByText(TEXT.es.editSubtitle)).toBeInTheDocument();
    const nav = screen.getByRole("navigation", {
      name: TEXT.es.breadcrumbLabel,
    });
    expect(nav.querySelector(".is-current")).toHaveTextContent(
      TEXT.es.breadcrumbEdit,
    );
    expect(
      within(nav).getByRole("link", { name: es.list.title }),
    ).toHaveAttribute("href", "/catalog/grupos");
    expect(
      screen.getByRole("region", { name: TEXT.es.stateTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: es.form.submitSave }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: esMessages.catalog.shared.toggle.deactivate,
      }),
    ).toBeInTheDocument();
  });

  it("renders the Spanish reactivate hint for an inactive record", async () => {
    state.locale = "es";
    getByIdMock.mockResolvedValue(detail({ activo: false }));

    await renderPage();

    expect(screen.getByText(TEXT.es.reactivateHint)).toBeInTheDocument();
  });

  it("reaches the form and the toggle through grupos/bound-controls, never through an actions module", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/catalog/grupos/[id]/edit/page.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("grupos/bound-controls");
    expect(source).not.toMatch(/from\s+["'][^"']*\/actions["']/);
    expect(source).not.toContain("listAsignaturaOptions");
  });
});
