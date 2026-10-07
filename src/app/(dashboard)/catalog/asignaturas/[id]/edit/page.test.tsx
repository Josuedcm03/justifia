import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../../../i18n/en.json";
import esMessages from "../../../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  notFoundMock,
  getSessionMock,
  getCatalogActorMock,
  getByIdMock,
  carreraOptionsMock,
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
