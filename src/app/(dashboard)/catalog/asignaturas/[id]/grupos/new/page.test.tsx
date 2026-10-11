import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../../../../i18n/en.json";
import esMessages from "../../../../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  notFoundMock,
  getSessionMock,
  getCatalogActorMock,
  getAsignaturaMock,
  docenteOptionsMock,
  createActionMock,
  formPropsSpy,
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
  getAsignaturaMock: vi.fn(),
  docenteOptionsMock: vi.fn(),
  createActionMock: vi.fn(),
  formPropsSpy: vi.fn<(props: unknown) => void>(),
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
  getAsignaturaById: getAsignaturaMock,
}));
// The page reaches the actions only through a client module, so they are
// replaced here (the real module imports the database).
vi.mock("@/app/(dashboard)/catalog/grupos/actions", () => ({
  createGrupoAction: createActionMock,
  updateGrupoAction: vi.fn(),
  setGrupoActivoAction: vi.fn(),
}));
// The real form renders, wrapped so the test can read exactly what the page
// handed to it.
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

// The data layer returns more than the form needs (Carrera, hours, counts);
// none of it may reach the client form.
const ASIGNATURA = {
  id: 12,
  codigo: "MAT101",
  nombre: "Algebra",
  carreraId: 3,
  carreraNombre: "Engineering",
  horasTotales: 64,
  activo: true,
  gruposActivos: 2,
};
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

let Page: (props: {
  params: Promise<{ id: string }>;
}) => Promise<React.ReactNode>;

/** A `params` promise that records whether the page awaited it. */
function paramsOf(id: string) {
  const awaited = vi.fn();
  const promise = {
    then: (
      resolve: (v: { id: string }) => unknown,
      reject: (e: unknown) => unknown,
    ) => {
      awaited();
      return Promise.resolve({ id }).then(resolve, reject);
    },
  } as unknown as Promise<{ id: string }>;
  return { promise, awaited };
}

const withIntl = (ui: React.ReactNode) => (
  <NextIntlClientProvider
    locale={state.locale}
    messages={state.locale === "es" ? esMessages : enMessages}
    onError={(error) => {
      throw error;
    }}
  >
    {ui}
  </NextIntlClientProvider>
);

async function renderPage(id = "12") {
  return render(withIntl(await Page({ params: Promise.resolve({ id }) })));
}

type FormProps = {
  action: unknown;
  docentes: unknown;
  docentesTruncated?: boolean;
  record?: unknown;
  asignatura?: unknown;
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
  Page = (
    await import("@/app/(dashboard)/catalog/asignaturas/[id]/grupos/new/page")
  ).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  formPropsSpy.mockClear();
  getSessionMock.mockReset();
  getCatalogActorMock.mockReset();
  getCatalogActorMock.mockResolvedValue({ carreraId: null });
  getAsignaturaMock.mockReset();
  getAsignaturaMock.mockResolvedValue(ASIGNATURA);
  docenteOptionsMock.mockReset();
  docenteOptionsMock.mockResolvedValue(DOCENTES);
  createActionMock.mockReset();
  createActionMock.mockResolvedValue({ kind: "idle" });
});

describe("NewGrupoPage access (CM-GRP-9, CM-ACC-1: matrix, denial destinations)", () => {
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
      expect(
        screen.getByRole("button", { name: en.form.submitCreate }),
      ).toBeInTheDocument();
      expect(redirectMock).not.toHaveBeenCalled();
      expect(notFoundMock).not.toHaveBeenCalled();
    },
  );

  it.each(rolesUsuario.filter((r) => r === "docente" || r === "estudiante"))(
    "sends %s to /denied without awaiting params or reading anything",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      const p = paramsOf("12");

      await expect(Page({ params: p.promise })).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(p.awaited).not.toHaveBeenCalled();
      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(getAsignaturaMock).not.toHaveBeenCalled();
      expect(docenteOptionsMock).not.toHaveBeenCalled();
      expect(formPropsSpy).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);
    const p = paramsOf("12");

    await expect(Page({ params: p.promise })).rejects.toThrow(
      "REDIRECT:/login",
    );

    expect(p.awaited).not.toHaveBeenCalled();
    expect(getCatalogActorMock).not.toHaveBeenCalled();
    expect(getAsignaturaMock).not.toHaveBeenCalled();
    expect(docenteOptionsMock).not.toHaveBeenCalled();
  });

  it.each(["secretaria", "docente"] as const)(
    "sends a flagged %s to the change screen before anything else",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol, true));
      const p = paramsOf("12");

      await expect(Page({ params: p.promise })).rejects.toThrow(
        `REDIRECT:${PASSWORD_CHANGE_PATH}`,
      );

      expect(p.awaited).not.toHaveBeenCalled();
      expect(getCatalogActorMock).not.toHaveBeenCalled();
      expect(getAsignaturaMock).not.toHaveBeenCalled();
      expect(docenteOptionsMock).not.toHaveBeenCalled();
    },
  );

  it("explains a coordinacion without a Carrera: no form, no read, no 404 (CM-SCOPE-2)", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });
    const p = paramsOf("12");

    render(withIntl(await Page({ params: p.promise })));

    expect(p.awaited).not.toHaveBeenCalled();
    expect(getAsignaturaMock).not.toHaveBeenCalled();
    expect(docenteOptionsMock).not.toHaveBeenCalled();
    expect(formPropsSpy).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(screen.getByText(shared.noCarrera.title)).toBeInTheDocument();
    expect(screen.getByText(shared.noCarrera.message)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.page.newTitle,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("NewGrupoPage unusable parent (CM-GRP-9, CM-SCOPE-1, U11: every case answers not-found alike)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it.each(["abc", "0", "-1", "1.5", "01", "", "12abc", "1".repeat(400)])(
    "answers not-found for the malformed id %j without reading anything",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NEXT_NOT_FOUND");

      expect(notFoundMock).toHaveBeenCalledTimes(1);
      expect(getAsignaturaMock).not.toHaveBeenCalled();
      expect(docenteOptionsMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
      expect(formPropsSpy).not.toHaveBeenCalled();
    },
  );

  // Unknown, foreign (the scoped read finds nothing) and inactive all end in
  // the same call, with the same output, and never in the denied screen.
  const UNUSABLE = [
    ["unknown", "99", null, "administrador"],
    ["of another Carrera (coordinacion)", "41", null, "coordinacion"],
    [
      "inactive, in scope",
      "12",
      { ...ASIGNATURA, activo: false },
      "secretaria",
    ],
  ] as const;

  it.each(UNUSABLE)(
    "answers not-found for an Asignatura that is %s, before reading the docentes",
    async (_name, id, found, rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));
      getCatalogActorMock.mockResolvedValue({
        carreraId: rol === "coordinacion" ? 3 : null,
      });
      getAsignaturaMock.mockResolvedValue(found);

      await expect(renderPage(id)).rejects.toThrow("NEXT_NOT_FOUND");

      expect(notFoundMock).toHaveBeenCalledTimes(1);
      expect(getAsignaturaMock).toHaveBeenCalledTimes(1);
      expect(docenteOptionsMock).not.toHaveBeenCalled();
      expect(formPropsSpy).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("gives the same outcome for every row of the table, so nothing tells them apart", async () => {
    const outcomes: unknown[] = [];
    for (const id of ["abc", "0", "-1", "1.5"]) {
      outcomes.push(await renderPage(id).catch((e: Error) => e.message));
    }
    getAsignaturaMock.mockResolvedValue(null);
    outcomes.push(await renderPage("99").catch((e: Error) => e.message));
    getAsignaturaMock.mockResolvedValue({ ...ASIGNATURA, activo: false });
    outcomes.push(await renderPage("12").catch((e: Error) => e.message));
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });
    getAsignaturaMock.mockResolvedValue(null);
    outcomes.push(await renderPage("41").catch((e: Error) => e.message));

    expect(outcomes).toEqual(Array(7).fill("NEXT_NOT_FOUND"));
    expect(notFoundMock).toHaveBeenCalledTimes(7);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reads the Asignatura with the scope from the guard and the parsed id", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: 3 });

    await renderPage("12");

    expect(getAsignaturaMock).toHaveBeenCalledExactlyOnceWith(
      { kind: "carrera", carreraId: 3 },
      12,
    );
  });

  it("lets a failing read propagate (no try, no fallback)", async () => {
    getAsignaturaMock.mockRejectedValue(new Error("db down"));
    await expect(renderPage()).rejects.toThrow("db down");

    getAsignaturaMock.mockResolvedValue(ASIGNATURA);
    docenteOptionsMock.mockRejectedValue(new Error("db down"));
    await expect(renderPage()).rejects.toThrow("db down");
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe("NewGrupoPage form (CM-GRP-9: the Asignatura is fixed by the route; CM-SCOPE-1)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  });

  it("hands the form the route's Asignatura and nothing else of the record", async () => {
    await renderPage("12");

    const props = formProps();
    expect(props.action).toBe(createActionMock);
    expect(props.record).toBeUndefined();
    expect(props.asignatura).toEqual({
      id: 12,
      codigo: "MAT101",
      nombre: "Algebra",
    });
    expect(props).not.toHaveProperty("asignaturas");
    expect(props).not.toHaveProperty("defaultAsignaturaId");
  });

  it("shows the Asignatura as text, posts its id and offers no selector", async () => {
    await renderPage("12");

    expect(screen.getByText("MAT101 - Algebra")).toBeInTheDocument();
    expect(document.querySelector('input[name="asignaturaId"]')).toHaveValue(
      "12",
    );
    expect(
      screen.queryByRole("combobox", { name: en.form.asignaturaLabel }),
    ).toBeNull();
    expect(
      screen.getByRole("combobox", { name: en.form.docenteLabel }),
    ).toBeInTheDocument();
  });

  it("opens with Periodo, NumeroGrupo, Docente and the days empty", async () => {
    await renderPage();

    expect(
      screen.getByRole("textbox", { name: en.form.periodoLabel }),
    ).toHaveValue("");
    expect(
      screen.getByRole("textbox", { name: en.form.numeroGrupoLabel }),
    ).toHaveValue("");
    expect(
      screen.getByRole("combobox", { name: en.form.docenteLabel }),
    ).toHaveValue("");
    const days = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(days).toHaveLength(7);
    expect(days.every((box) => !box.checked)).toBe(true);
  });

  it("reads the docentes once, after the Asignatura, and passes them without their e-mail", async () => {
    await renderPage();

    expect(docenteOptionsMock).toHaveBeenCalledExactlyOnceWith();
    expect(getAsignaturaMock.mock.invocationCallOrder[0]).toBeLessThan(
      docenteOptionsMock.mock.invocationCallOrder[0],
    );
    expect(formProps().docentes).toEqual([
      { id: 7, nombreCompleto: "Ana Ruiz" },
      { id: 8, nombreCompleto: "Luis Mora" },
    ]);
  });

  it("performs no write on a plain read", async () => {
    await renderPage();

    expect(createActionMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("submits the route's Asignatura id, the typed values and the checked days to the create action", async () => {
    const user = userEvent.setup();

    await renderPage("12");
    await user.type(
      screen.getByRole("textbox", { name: en.form.periodoLabel }),
      "2026-S2",
    );
    await user.type(
      screen.getByRole("textbox", { name: en.form.numeroGrupoLabel }),
      "B",
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
    expect(formData.get("asignaturaId")).toBe("12");
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

describe("NewGrupoPage cap note (the docente list is cut at CATALOG_OPTIONS_MAX)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("flags nothing while the list is under the cap", async () => {
    docenteOptionsMock.mockResolvedValue(
      many(CATALOG_OPTIONS_MAX - 1, (id) => ({
        id,
        nombreCompleto: `D${id}`,
        correo: null,
      })),
    );

    await renderPage();

    expect(formProps().docentesTruncated ?? false).toBe(false);
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

    expect(formProps().docentesTruncated).toBe(true);
    expect(screen.getAllByText(en.form.truncated)).toHaveLength(1);
    expect(
      screen.getByRole("combobox", { name: en.form.docenteLabel }),
    ).toHaveAccessibleDescription(en.form.truncated);
  });
});

describe("NewGrupoPage structure (CM-GRP-9 breadcrumb; CM-NFR-3; the only 'you are here' marker is the breadcrumb)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("administrador"));
  });

  it("has a breadcrumb: the Asignaturas list, then the Asignatura (linking to its edit page), then the page itself", async () => {
    const { container } = await renderPage("12");

    const nav = screen.getByRole("navigation", {
      name: en.breadcrumb.label,
    });
    // The current segment is exposed as a link without an href.
    const links = within(nav)
      .getAllByRole("link")
      .filter((a) => a.hasAttribute("href"));
    expect(links.map((a) => a.textContent)).toEqual([
      enMessages.catalog.asignaturas.title,
      "MAT101",
    ]);
    expect(links[0]).toHaveAttribute("href", "/catalog/asignaturas");
    expect(links[1]).toHaveAttribute("href", "/catalog/asignaturas/12/edit");
    const current = nav.querySelector(".is-current");
    expect(current).toHaveTextContent(en.breadcrumb.new);
    expect(current).toHaveAttribute("aria-current", "page");
    // The marker appears once and nowhere else on the page.
    expect(container.querySelectorAll(".is-current")).toHaveLength(1);
    expect(container.querySelectorAll("[aria-current]")).toHaveLength(1);
  });

  it("keeps the breadcrumb to the list and the page when no Asignatura was read (no Carrera)", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
    getCatalogActorMock.mockResolvedValue({ carreraId: null });

    await renderPage("12");

    const nav = screen.getByRole("navigation", { name: en.breadcrumb.label });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href"))
        .filter((href) => href !== null),
    ).toEqual(["/catalog/asignaturas"]);
    expect(nav.querySelector(".is-current")).toHaveTextContent(
      en.breadcrumb.new,
    );
  });

  it("has one h1 with the subtitle and no skipped heading level", async () => {
    await renderPage();

    expect(screen.getByText(en.page.newSubtitle)).toBeInTheDocument();
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

    await renderPage("12");

    const es = esMessages.catalog.grupos;
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      es.page.newTitle,
    );
    expect(screen.getByText(es.page.newSubtitle)).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: es.breadcrumb.label }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: esMessages.catalog.asignaturas.title }),
    ).toHaveAttribute("href", "/catalog/asignaturas");
    expect(
      screen.getByRole("button", { name: es.form.submitCreate }),
    ).toBeInTheDocument();
  });

  it("types params as a Promise, reaches the form through grupos/bound-controls and keeps notFound() out of any try", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/catalog/asignaturas/[id]/grupos/new/page.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("params: Promise<{ id: string }>");
    expect(source).toContain("grupos/bound-controls");
    expect(source).not.toMatch(/from\s+["'][^"']*\/actions["']/);
    expect(source).not.toMatch(/\btry\s*\{/);
  });
});
