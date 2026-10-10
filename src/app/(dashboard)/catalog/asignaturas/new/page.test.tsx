import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../../i18n/en.json";
import esMessages from "../../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  getCatalogActorMock,
  carreraOptionsMock,
  createActionMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  getCatalogActorMock: vi.fn(),
  carreraOptionsMock: vi.fn(),
  createActionMock: vi.fn(),
  state: { locale: "en" as "en" | "es" },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/users", () => ({ getCatalogActor: getCatalogActorMock }));
vi.mock("@/lib/data/asignaturas", () => ({
  listCarreraOptions: carreraOptionsMock,
}));
// The page reaches the actions only through a client module, so they are
// replaced here (the real module imports the database).
vi.mock("@/app/(dashboard)/catalog/asignaturas/actions", () => ({
  createAsignaturaAction: createActionMock,
  updateAsignaturaAction: vi.fn(),
  setAsignaturaActivoAction: vi.fn(),
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

const OPTIONS = [
  { id: 3, nombre: "Engineering" },
  { id: 4, nombre: "Law" },
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

const en = enMessages.catalog.asignaturas;
const shared = enMessages.catalog.shared;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/asignaturas/new/page"))
    .default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getCatalogActorMock.mockReset();
  getCatalogActorMock.mockResolvedValue({ carreraId: null });
  carreraOptionsMock.mockReset();
  carreraOptionsMock.mockResolvedValue(OPTIONS);
  createActionMock.mockReset();
  createActionMock.mockResolvedValue({ kind: "idle" });
});

describe("NewAsignaturaPage access (CM-ACC-1: matrix, denial destinations)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "renders the form for %s",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({
        carreraId: rol === "coordinacion" ? 3 : null,
      });

      await renderPage();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        en.page.newTitle,
      );
      expect(screen.getByLabelText(en.form.codigoLabel)).toBeInTheDocument();
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
      expect(carreraOptionsMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    expect(getCatalogActorMock).not.toHaveBeenCalled();
    expect(carreraOptionsMock).not.toHaveBeenCalled();
  });

  it.each(["secretaria", "docente"] as const)(
    "sends a flagged %s to the change screen before anything else",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol, true));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${PASSWORD_CHANGE_PATH}`,
      );

      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(carreraOptionsMock).not.toHaveBeenCalled();
    },
  );
});

describe("NewAsignaturaPage scope (CM-SCOPE-1: Selects offer only in-scope options; CM-SCOPE-2; CM-SCOPE-3)", () => {
  it.each(["administrador", "secretaria"] as const)(
    "offers the options of scope all to %s in a Carrera select",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await renderPage();

      expect(carreraOptionsMock).toHaveBeenCalledWith({ kind: "all" });
      expect(
        screen.getByRole("combobox", { name: en.form.carreraLabel }),
      ).toBeInTheDocument();
      expect(screen.queryByText(en.form.carreraFixedHint)).toBeNull();
    },
  );

  it("shows the own Carrera as text for coordinacion, with no select", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });
    carreraOptionsMock.mockResolvedValue([OPTIONS[0]]);

    await renderPage();

    expect(carreraOptionsMock).toHaveBeenCalledWith({
      kind: "carrera",
      carreraId: 3,
    });
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText(en.form.carreraFixedHint)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("explains a coordinacion without a Carrera: no form, no option query", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });

    await renderPage();

    expect(carreraOptionsMock).not.toHaveBeenCalled();
    expect(screen.getByText(shared.noCarrera.title)).toBeInTheDocument();
    expect(screen.getByText(shared.noCarrera.message)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.page.newTitle,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: en.form.submitCreate })).toBe(
      null,
    );
  });
});

describe("NewAsignaturaPage structure (CM-NFR-3; the only 'you are here' marker is the breadcrumb)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("has a breadcrumb back to the list whose current segment is the page", async () => {
    const { container } = await renderPage();

    const nav = screen.getByRole("navigation", {
      name: en.breadcrumb.label,
    });
    expect(
      screen.getByRole("link", { name: en.title, hidden: false }),
    ).toHaveAttribute("href", "/catalog/asignaturas");
    const current = nav.querySelector(".is-current");
    expect(current).toHaveTextContent(en.breadcrumb.new);
    expect(current).toHaveAttribute("aria-current", "page");
    // The marker appears once and nowhere else on the page.
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
      esMessages.catalog.asignaturas.page.newTitle,
    );
    expect(
      screen.getByRole("button", {
        name: esMessages.catalog.asignaturas.form.submitCreate,
      }),
    ).toBeInTheDocument();
  });
});

describe("NewAsignaturaPage wiring (the form posts to the create action)", () => {
  it("submits the typed values to createAsignaturaAction", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
    const user = userEvent.setup();

    await renderPage();
    await user.type(screen.getByLabelText(en.form.codigoLabel), "MAT101");
    await user.type(screen.getByLabelText(en.form.nombreLabel), "Calculus");
    await user.type(screen.getByLabelText(en.form.horasLabel), "64");
    await user.click(
      screen.getByRole("button", { name: en.form.submitCreate }),
    );

    await waitFor(() => expect(createActionMock).toHaveBeenCalledTimes(1));
    const formData = createActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("codigo")).toBe("MAT101");
    expect(formData.get("nombre")).toBe("Calculus");
    expect(formData.get("horasTotales")).toBe("64");
    // Let the pending state settle before the test ends.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.form.submitCreate }),
      ).toBeEnabled(),
    );
  });
});
