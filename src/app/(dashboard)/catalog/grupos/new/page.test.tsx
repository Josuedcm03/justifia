import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../../i18n/en.json";
import esMessages from "../../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  getCatalogActorMock,
  asignaturaOptionsMock,
  docenteOptionsMock,
  createActionMock,
  formPropsSpy,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  getCatalogActorMock: vi.fn(),
  asignaturaOptionsMock: vi.fn(),
  docenteOptionsMock: vi.fn(),
  createActionMock: vi.fn(),
  formPropsSpy: vi.fn<(props: unknown) => void>(),
  state: { locale: "en" as "en" | "es" },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/users", () => ({
  getCatalogActor: getCatalogActorMock,
  listDocenteOptions: docenteOptionsMock,
}));
vi.mock("@/lib/data/asignaturas", () => ({
  listAsignaturaOptions: asignaturaOptionsMock,
}));
// The page reaches the actions only through a client module, so they are
// replaced here (the real module imports the database).
vi.mock("@/app/(dashboard)/catalog/grupos/actions", () => ({
  createGrupoAction: createActionMock,
  updateGrupoAction: vi.fn(),
  setGrupoActivoAction: vi.fn(),
}));
// The real form renders, wrapped so the test can read exactly what the page
// handed to it (the combobox popups only show a few options).
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
// exactly these strings: `catalog.grupos.page.newTitle`, `page.newSubtitle`,
// `breadcrumb.label`, `breadcrumb.new`. Everything else is read from the real
// catalogs (`catalog.grupos.form.*`, `catalog.grupos.list.title`,
// `catalog.shared.*`).
const TEXT = {
  en: {
    newTitle: "New group",
    newSubtitle: "Fill in the details to add a group to the catalog.",
    breadcrumbLabel: "Breadcrumb",
    breadcrumbNew: "New group",
  },
  es: {
    newTitle: "Nuevo grupo",
    newSubtitle: "Completa los datos para agregar un grupo al catálogo.",
    breadcrumbLabel: "Ruta de navegación",
    breadcrumbNew: "Nuevo grupo",
  },
} as const;

const ASIGNATURAS = [
  { id: 1, codigo: "MAT101", nombre: "Algebra" },
  { id: 2, codigo: "FIS200", nombre: "Fisica" },
];
// The data layer also returns the e-mail; it must not reach the client form.
const DOCENTES = [
  { id: 7, nombreCompleto: "Ana Ruiz", correo: "ana@example.edu" },
  { id: 8, nombreCompleto: "Luis Mora", correo: null },
];

function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

let Page: () => Promise<React.ReactNode>;

async function renderPage() {
  const ui = await Page();
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
};

/** The props of the last `GrupoForm` render. */
function formProps(): FormProps {
  const last = formPropsSpy.mock.lastCall;
  expect(last, "GrupoForm was rendered").toBeDefined();
  return last![0] as FormProps;
}

function many(count: number, make: (id: number) => object) {
  return Array.from({ length: count }, (_, i) => make(i + 1));
}

const en = enMessages.catalog.grupos;
const shared = enMessages.catalog.shared;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/grupos/new/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  formPropsSpy.mockClear();
  getSessionMock.mockReset();
  getCatalogActorMock.mockReset();
  getCatalogActorMock.mockResolvedValue({ carreraId: null });
  asignaturaOptionsMock.mockReset();
  asignaturaOptionsMock.mockResolvedValue(ASIGNATURAS);
  docenteOptionsMock.mockReset();
  docenteOptionsMock.mockResolvedValue(DOCENTES);
  createActionMock.mockReset();
  createActionMock.mockResolvedValue({ kind: "idle" });
});

describe("NewGrupoPage access (CM-ACC-1: matrix, denial destinations)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "renders the form for %s",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({
        carreraId: rol === "coordinacion" ? 3 : null,
      });

      await renderPage();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        TEXT.en.newTitle,
      );
      expect(
        screen.getByRole("button", { name: en.form.submitCreate }),
      ).toBeInTheDocument();
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it.each(rolesUsuario.filter((r) => r === "docente" || r === "estudiante"))(
    "sends %s to /denied and reads nothing",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(asignaturaOptionsMock).not.toHaveBeenCalled();
      expect(docenteOptionsMock).not.toHaveBeenCalled();
      expect(formPropsSpy).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    expect(getCatalogActorMock).not.toHaveBeenCalled();
    expect(asignaturaOptionsMock).not.toHaveBeenCalled();
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
      expect(asignaturaOptionsMock).not.toHaveBeenCalled();
      expect(docenteOptionsMock).not.toHaveBeenCalled();
    },
  );
});

describe("NewGrupoPage options (CM-SCOPE-1: Selects offer only in-scope options; CM-GRP-1)", () => {
  it.each(["administrador", "secretaria"] as const)(
    "hands %s the scope-all Asignaturas and the docentes, in create mode",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await renderPage();

      expect(asignaturaOptionsMock).toHaveBeenCalledTimes(1);
      expect(asignaturaOptionsMock).toHaveBeenCalledWith({ kind: "all" });
      expect(docenteOptionsMock).toHaveBeenCalledTimes(1);
      expect(docenteOptionsMock).toHaveBeenCalledWith();

      const props = formProps();
      expect(props.action).toBe(createActionMock);
      expect(props.record).toBeUndefined();
      expect(props.asignaturas).toEqual(ASIGNATURAS);
      expect(
        screen.getByRole("combobox", { name: en.form.asignaturaLabel }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: en.form.docenteLabel }),
      ).toBeInTheDocument();
    },
  );

  it("passes the docentes to the client form without their e-mail", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));

    await renderPage();

    expect(formProps().docentes).toEqual([
      { id: 7, nombreCompleto: "Ana Ruiz" },
      { id: 8, nombreCompleto: "Luis Mora" },
    ]);
  });

  it("scopes a coordinacion's Asignaturas to its Carrera and offers only those", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });
    asignaturaOptionsMock.mockImplementation(async (scope: { kind: string }) =>
      scope.kind === "carrera" ? [ASIGNATURAS[0]] : ASIGNATURAS,
    );
    const user = userEvent.setup();

    await renderPage();

    expect(asignaturaOptionsMock).toHaveBeenCalledWith({
      kind: "carrera",
      carreraId: 3,
    });
    expect(formProps().asignaturas).toEqual([ASIGNATURAS[0]]);
    await user.click(
      screen.getByRole("combobox", { name: en.form.asignaturaLabel }),
    );
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["MAT101 - Algebra"]);
  });

  it("explains a coordinacion without a Carrera: no form, no option query", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });

    await renderPage();

    expect(asignaturaOptionsMock).not.toHaveBeenCalled();
    expect(docenteOptionsMock).not.toHaveBeenCalled();
    expect(formPropsSpy).not.toHaveBeenCalled();
    expect(screen.getByText(shared.noCarrera.title)).toBeInTheDocument();
    expect(screen.getByText(shared.noCarrera.message)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      TEXT.en.newTitle,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lets a failing option read propagate (no try, no fallback)", async () => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
    docenteOptionsMock.mockRejectedValue(new Error("db down"));

    await expect(renderPage()).rejects.toThrow("db down");
  });
});

describe("NewGrupoPage cap note (the lists are cut at CATALOG_OPTIONS_MAX)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("flags nothing while both lists are under the cap", async () => {
    asignaturaOptionsMock.mockResolvedValue(
      many(CATALOG_OPTIONS_MAX - 1, (id) => ({
        id,
        codigo: `C${id}`,
        nombre: `N${id}`,
      })),
    );

    await renderPage();

    const props = formProps();
    expect(props.asignaturasTruncated ?? false).toBe(false);
    expect(props.docentesTruncated ?? false).toBe(false);
    expect(screen.queryByText(en.form.truncated)).toBeNull();
  });

  it("flags the Asignatura list when it holds the cap, and only that one", async () => {
    asignaturaOptionsMock.mockResolvedValue(
      many(CATALOG_OPTIONS_MAX, (id) => ({
        id,
        codigo: `C${id}`,
        nombre: `N${id}`,
      })),
    );

    await renderPage();

    const props = formProps();
    expect(props.asignaturasTruncated).toBe(true);
    expect(props.docentesTruncated ?? false).toBe(false);
    expect(screen.getAllByText(en.form.truncated)).toHaveLength(1);
    expect(
      screen.getByRole("combobox", { name: en.form.asignaturaLabel }),
    ).toHaveAccessibleDescription(en.form.truncated);
  });

  it("flags the docente list when it holds the cap, and only that one", async () => {
    docenteOptionsMock.mockResolvedValue(
      many(CATALOG_OPTIONS_MAX, (id) => ({
        id,
        nombreCompleto: `D${id}`,
        correo: null,
      })),
    );

    await renderPage();

    const props = formProps();
    expect(props.asignaturasTruncated ?? false).toBe(false);
    expect(props.docentesTruncated).toBe(true);
    expect(screen.getAllByText(en.form.truncated)).toHaveLength(1);
    expect(
      screen.getByRole("combobox", { name: en.form.docenteLabel }),
    ).toHaveAccessibleDescription(en.form.truncated);
  });
});

describe("NewGrupoPage structure (CM-NFR-3; the only 'you are here' marker is the breadcrumb)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("has a breadcrumb back to the list whose current segment is the page", async () => {
    const { container } = await renderPage();

    const nav = screen.getByRole("navigation", {
      name: TEXT.en.breadcrumbLabel,
    });
    expect(
      within(nav).getByRole("link", { name: en.list.title }),
    ).toHaveAttribute("href", "/catalog/grupos");
    const current = nav.querySelector(".is-current");
    expect(current).toHaveTextContent(TEXT.en.breadcrumbNew);
    expect(current).toHaveAttribute("aria-current", "page");
    // The marker appears once and nowhere else on the page.
    expect(container.querySelectorAll(".is-current")).toHaveLength(1);
    expect(container.querySelectorAll("[aria-current]")).toHaveLength(1);
  });

  it("has one h1 with the subtitle and no skipped heading level", async () => {
    await renderPage();

    expect(screen.getByText(TEXT.en.newSubtitle)).toBeInTheDocument();
    const levels = screen
      .queryAllByRole("heading")
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
      TEXT.es.newTitle,
    );
    expect(screen.getByText(TEXT.es.newSubtitle)).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: TEXT.es.breadcrumbLabel }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: esMessages.catalog.grupos.list.title }),
    ).toHaveAttribute("href", "/catalog/grupos");
    expect(
      screen.getByRole("button", {
        name: esMessages.catalog.grupos.form.submitCreate,
      }),
    ).toBeInTheDocument();
  });

  it("reaches the form through grupos/bound-controls, never through an actions module", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/catalog/grupos/new/page.tsx"),
      "utf8",
    );

    expect(source).toContain("grupos/bound-controls");
    expect(source).not.toMatch(/from\s+["'][^"']*\/actions["']/);
  });
});

describe("NewGrupoPage wiring (the form posts to the create action)", () => {
  it("submits the chosen ids, the typed values and the checked days to createGrupoAction", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
    const user = userEvent.setup();

    await renderPage();
    await user.type(
      screen.getByRole("textbox", { name: en.form.periodoLabel }),
      "2026-S2",
    );
    await user.type(
      screen.getByRole("textbox", { name: en.form.numeroGrupoLabel }),
      "B",
    );
    await user.click(
      screen.getByRole("combobox", { name: en.form.asignaturaLabel }),
    );
    await user.click(
      await screen.findByRole("option", { name: "FIS200 - Fisica" }),
    );
    await user.click(
      screen.getByRole("combobox", { name: en.form.docenteLabel }),
    );
    await user.click(await screen.findByRole("option", { name: "Ana Ruiz" }));
    await user.click(
      screen.getByRole("checkbox", { name: shared.dias.long.miercoles }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: shared.dias.long.lunes }),
    );
    await user.click(
      screen.getByRole("button", { name: en.form.submitCreate }),
    );

    await waitFor(() => expect(createActionMock).toHaveBeenCalledTimes(1));
    const formData = createActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("asignaturaId")).toBe("2");
    expect(formData.get("docenteId")).toBe("7");
    expect(formData.get("periodo")).toBe("2026-S2");
    expect(formData.get("numeroGrupo")).toBe("B");
    expect(formData.getAll("dias")).toEqual(["lunes", "miercoles"]);
    // Let the pending state settle before the test ends.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.form.submitCreate }),
      ).toBeEnabled(),
    );
  });
});
