import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../../../i18n/en.json";
import esMessages from "../../../../../../../i18n/es.json";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { catalogListHref } from "@/lib/catalog/list-params";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  notFoundMock,
  getSessionMock,
  getCatalogActorMock,
  getByIdMock,
  writeMock,
  auditMock,
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
  writeMock: vi.fn(),
  auditMock: vi.fn(),
  updateActionMock: vi.fn(),
  toggleActionMock: vi.fn(),
  state: { locale: "en" as "en" | "es" },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
// The guard of this page reads no actor: any call here is a failure.
vi.mock("@/lib/data/users", () => ({ getCatalogActor: getCatalogActorMock }));
vi.mock("@/lib/data/docentes", () => ({ getDocenteById: getByIdMock }));
// Tripwires: opening the page writes neither a record nor an audit row.
vi.mock("@/lib/data/catalog-write", () => ({ withCatalogWrite: writeMock }));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: auditMock }));
// The page reaches the actions only through a client module, so they are
// replaced here (the real module imports the database).
vi.mock("@/app/(dashboard)/catalog/docentes/actions", () => ({
  updateDocenteAction: updateActionMock,
  setDocenteActivoAction: toggleActionMock,
}));

// The real catalogs through next-intl's own translator: a missing key throws.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async (namespace: string) =>
      createTranslator({
        locale: state.locale,
        messages: state.locale === "es" ? esMessages : enMessages,
        namespace: namespace as "catalog.docentes",
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
    nombreCompleto: "Ana Pérez",
    correo: "ana@uni.edu",
    telefono: "555-0100",
    activo: true,
    gruposActivos: 3,
    ...overrides,
  };
}

let Page: (props: {
  params: Promise<{ id: string }>;
}) => Promise<React.ReactNode>;

const intl = (ui: React.ReactNode) => (
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
  const ui = await Page({ params: Promise.resolve({ id }) });
  return render(intl(ui));
}

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

const en = enMessages.catalog.docentes;
const shared = enMessages.catalog.shared;

beforeAll(async () => {
  // The first dynamic import transforms the whole page tree.
  Page = (await import("@/app/(dashboard)/catalog/docentes/[id]/edit/page"))
    .default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getSessionMock.mockReset();
  getCatalogActorMock.mockReset();
  getByIdMock.mockReset();
  getByIdMock.mockResolvedValue(detail());
  writeMock.mockReset();
  auditMock.mockReset();
  updateActionMock.mockReset();
  updateActionMock.mockResolvedValue({ kind: "idle" });
  toggleActionMock.mockReset();
  toggleActionMock.mockResolvedValue({ kind: "idle" });
});

describe("EditDocentePage access (DM-1, CM-ACC-1: the guard runs before params and any read)", () => {
  it("renders the form for the secretaria, whatever her own facultad", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.page.editTitle,
    );
    expect(
      screen.getByRole("textbox", { name: en.form.nombreLabel }),
    ).toHaveValue("Ana Pérez");
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
    // Docentes have no scope: no actor row is read to open the page.
    expect(getCatalogActorMock).not.toHaveBeenCalled();
  });

  it.each(
    rolesUsuario.filter((rol) => rol !== "secretaria").map((rol) => [rol]),
  )(
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
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it("sends a secretaria with a forced password change to the change screen first", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );

    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it("reads the session before the docente: the guard is the first await", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/catalog/docentes/[id]/edit/page.tsx",
      ),
      "utf8",
    );

    expect(source.slice(source.indexOf("await "))).toMatch(
      /^await requireDocenteAccess\(\)/,
    );
    expect(source).not.toContain("requireCatalogAccess");
  });
});

describe("EditDocentePage not found (DM-2: one screen for a bad id, a missing id and another role)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  });

  it.each([
    "abc",
    "0",
    "-3",
    "1.5",
    "007",
    "1e3",
    "9007199254740993",
    "",
    " 12",
    "12abc",
  ])(
    "answers not-found for the malformed id %j without reading the record",
    async (id) => {
      await expect(renderPage(id)).rejects.toThrow("NEXT_NOT_FOUND");

      expect(notFoundMock).toHaveBeenCalledTimes(1);
      expect(getByIdMock).not.toHaveBeenCalled();
    },
  );

  it("answers the identical not-found for a missing id and for the id of another role", async () => {
    // The reader answers null for both: a non-docente account is unreachable.
    getByIdMock.mockResolvedValue(null);
    const missing = await renderPage("99").catch((e: Error) => e);
    const student = await renderPage("41").catch((e: Error) => e);
    const malformed = await renderPage("abc").catch((e: Error) => e);

    for (const outcome of [missing, student, malformed]) {
      expect(outcome).toBeInstanceOf(Error);
      expect((outcome as Error).message).toBe("NEXT_NOT_FOUND");
    }
    expect(notFoundMock).toHaveBeenCalledTimes(3);
    expect(getByIdMock).toHaveBeenCalledTimes(2);
    expect(getByIdMock).toHaveBeenNthCalledWith(1, 99);
    expect(getByIdMock).toHaveBeenNthCalledWith(2, 41);
  });

  it("renders no name, email or phone for an id that is not a docente", async () => {
    getByIdMock.mockResolvedValue(null);

    await expect(renderPage("41")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(document.body.textContent).toBe("");
  });

  it("reads the record by the parsed id alone", async () => {
    await renderPage("12");

    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getByIdMock).toHaveBeenCalledWith(12);
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
        "src/app/(dashboard)/catalog/docentes/[id]/edit/page.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("params: Promise<{ id: string }>");
    expect(source).not.toMatch(/\btry\s*\{/);
  });
});

describe("EditDocentePage delivered data (DM-2, DM-15: only the six fields reach the browser)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  });

  it("serializes the id, name, email, phone, state and grupo count, and nothing else", async () => {
    getByIdMock.mockResolvedValue(
      detail({
        login: "aperez",
        hashClave: "$2b$12$LEAKEDHASH",
        cif: "CIF-0001",
        rol: "docente",
        carreraId: 3,
        facultadId: 2,
        debeCambiarClave: true,
      }),
    );

    const ui = await Page({ params: Promise.resolve({ id: "12" }) });
    const props = serializedProps(ui);
    const { container } = render(intl(ui));

    for (const wanted of ["Ana Pérez", "ana@uni.edu", "555-0100"]) {
      expect(props).toContain(wanted);
    }
    for (const text of [props, container.innerHTML]) {
      for (const leak of [
        "aperez",
        "HashClave",
        "hashClave",
        "LEAKEDHASH",
        "CIF-0001",
        "debeCambiarClave",
        "carreraId",
        "facultadId",
      ]) {
        expect(text).not.toContain(leak);
      }
      expect(text).not.toMatch(/password/i);
      expect(text).not.toMatch(/"docente"/);
    }
  });

  it("opening writes no audit row and calls neither action: a GET changes no record", async () => {
    await renderPage();

    expect(writeMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
    expect(updateActionMock).not.toHaveBeenCalled();
    expect(toggleActionMock).not.toHaveBeenCalled();
    expect(getByIdMock).toHaveBeenCalledTimes(1);
  });

  it("carries no write, audit or action import in its source", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/catalog/docentes/[id]/edit/page.tsx",
      ),
      "utf8",
    );

    expect(source).not.toMatch(
      /withCatalogWrite|insertAuditEvents|setDocenteActivo\b|updateDocente\b/,
    );
    expect(source).not.toMatch(/from\s+["'][^"']*\/actions["']/);
    expect(source).not.toMatch(/["']use server["']/);
  });
});

describe("EditDocentePage active docente (DM-3, DM-6, DM-16)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  });

  it("renders the prefilled form with the three notices", async () => {
    await renderPage();

    expect(screen.getByLabelText(en.form.nombreLabel)).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText(en.form.correoLabel)).toHaveValue(
      "ana@uni.edu",
    );
    expect(screen.getByLabelText(en.form.telefonoLabel)).toHaveValue(
      "555-0100",
    );
    expect(screen.getByText(en.form.correoHint)).toBeInTheDocument();
    expect(screen.getByText(en.form.correoNote)).toBeInTheDocument();
    expect(screen.getByText(shared.importWins)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.form.submitSave }),
    ).toBeEnabled();
    expect(screen.queryByText(en.page.reactivateHint)).toBeNull();
  });

  it("saving sends the hidden id and the edited values to the update action", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.clear(screen.getByLabelText(en.form.nombreLabel));
    await user.type(screen.getByLabelText(en.form.nombreLabel), "Ana M.");
    await user.click(screen.getByRole("button", { name: en.form.submitSave }));

    await waitFor(() => expect(updateActionMock).toHaveBeenCalledTimes(1));
    const formData = updateActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("12");
    expect(formData.get("nombreCompleto")).toBe("Ana M.");
    expect(formData.get("correo")).toBe("ana@uni.edu");
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

  it("confirming names the docente with the email, states what is kept and shows the count", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole("button", { name: shared.toggle.deactivate }),
    );

    const group = await screen.findByRole("group");
    expect(group).toHaveTextContent("Ana Pérez (ana@uni.edu)");
    expect(group).toHaveTextContent(shared.toggle.nothingDeleted);
    expect(group).toHaveTextContent(en.state.kept);
    expect(group).toHaveTextContent("This teacher has 3 active groups.");
    expect(toggleActionMock).not.toHaveBeenCalled();
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
  });

  it("links to the Asignaturas search by the docente's name while grupos are active", async () => {
    await renderPage();

    const link = screen.getByRole("link", { name: en.state.findGroups });
    expect(link).toHaveAttribute(
      "href",
      catalogListHref("/catalog/asignaturas", { q: "Ana Pérez" }),
    );
    expect(link.getAttribute("href")).toMatch(/^\/catalog\/asignaturas\?q=/);
    expect(
      within(screen.getByRole("region", { name: en.state.title })).getByRole(
        "link",
        { name: en.state.findGroups },
      ),
    ).toBe(link);
  });

  it("shows no such link, and says there are none, when no grupo is active", async () => {
    getByIdMock.mockResolvedValue(detail({ gruposActivos: 0 }));
    const user = userEvent.setup();
    await renderPage();

    expect(
      screen.queryByRole("link", { name: en.state.findGroups }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: shared.toggle.deactivate }),
    );
    expect(await screen.findByRole("group")).toHaveTextContent(
      "This teacher has no active groups.",
    );
  });

  it("names a docente without email by the name alone", async () => {
    getByIdMock.mockResolvedValue(detail({ correo: null }));
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole("button", { name: shared.toggle.deactivate }),
    );

    const group = await screen.findByRole("group");
    expect(group).toHaveTextContent("Deactivate Ana Pérez?");
    expect(group.textContent).not.toContain("(");
  });
});

describe("EditDocentePage inactive docente (DM-6, DM-9)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
    getByIdMock.mockResolvedValue(detail({ activo: false, gruposActivos: 0 }));
  });

  it("renders the fields read-only with no save control and says to reactivate first", async () => {
    await renderPage();

    for (const label of [
      en.form.nombreLabel,
      en.form.correoLabel,
      en.form.telefonoLabel,
    ]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("readonly");
    }
    expect(
      screen.queryByRole("button", { name: en.form.submitSave }),
    ).toBeNull();
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
  });

  it("never nests one form inside another", async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll("form form")).toHaveLength(0);
    expect(container.querySelectorAll("form").length).toBeGreaterThan(1);
  });
});

describe("EditDocentePage structure (DM-17: one h1, breadcrumb, narrow width)", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  });

  it("has a breadcrumb back to the list whose current segment names the docente", async () => {
    const { container } = await renderPage();

    const nav = screen.getByRole("navigation", { name: en.breadcrumb.label });
    expect(within(nav).getByRole("link", { name: en.title })).toHaveAttribute(
      "href",
      "/catalog/docentes",
    );
    const current = nav.querySelector(".is-current");
    expect(current).toHaveTextContent("Edit Ana Pérez");
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

  it("keeps every block inside the max-w-xl column", async () => {
    const { container } = await renderPage();

    const section = screen.getByRole("region", { name: en.state.title });
    expect(section).toHaveClass("max-w-xl");
    const form = container.querySelector("form") as HTMLFormElement;
    expect(form).toHaveClass("max-w-xl");
  });

  it("renders in Spanish from the real catalog", async () => {
    state.locale = "es";

    await renderPage();

    const es = esMessages.catalog.docentes;
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      es.page.editTitle,
    );
    expect(
      screen.getByRole("region", { name: es.state.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(es.form.correoHint)).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: es.breadcrumb.label }),
    ).toBeInTheDocument();
  });
});
