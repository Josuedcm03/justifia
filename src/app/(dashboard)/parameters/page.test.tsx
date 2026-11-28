import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PARAMETERS } from "@/lib/parameters/registry";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  load: vi.fn(),
  writeParameters: vi.fn(),
  withCatalogWrite: vi.fn(),
  action: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/parameters/loader", () => ({
  loadNormativeParameters: m.load,
}));
// Opening the page must reach neither the write path nor an action.
vi.mock("@/lib/parameters/write", () => ({
  writeParameters: m.writeParameters,
}));
vi.mock("@/lib/data/catalog-write", () => ({
  withCatalogWrite: m.withCatalogWrite,
}));
vi.mock("@/app/(dashboard)/parameters/actions", () => ({
  saveScalarParametersAction: m.action,
  saveCalendarAction: m.action,
  saveDocumentTypeCausesAction: m.action,
  saveCausesAction: m.action,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock(
  "next-intl",
  async () => (await import("@/test/key-echo-intl")).keyEchoIntl,
);

const secretaria = { sub: "7", login: "s", rol: "secretaria", nombre: "S" };

function read(overrides: Record<string, unknown> = {}) {
  return {
    values: { ...DEFAULT_PARAMETERS, issuerRecurrenceThreshold: 4 },
    fallback: [],
    degraded: false,
    ...overrides,
  };
}

async function renderPage() {
  const { default: ParametersPage } =
    await import("@/app/(dashboard)/parameters/page");
  return render(await ParametersPage());
}

describe("ParametersPage", () => {
  // The first dynamic import transforms the whole page tree.
  beforeAll(async () => {
    await import("@/app/(dashboard)/parameters/page");
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    m.requireRole.mockResolvedValue(secretaria);
    m.load.mockResolvedValue(read());
  });

  it("runs the secretaria guard before it reads any parameter", async () => {
    await renderPage();

    expect(m.requireRole).toHaveBeenCalledWith("secretaria");
    expect(m.requireRole.mock.invocationCallOrder[0]).toBeLessThan(
      m.load.mock.invocationCallOrder[0],
    );
    expect(m.load).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a denied role", "/denied"],
    ["an anonymous visitor", "/login"],
    ["a flagged password change", "/change-password"],
  ])("sends %s away with no parameter read", async (_who, destination) => {
    m.requireRole.mockRejectedValue(new Error(`REDIRECT:${destination}`));

    await expect(renderPage()).rejects.toThrow(`REDIRECT:${destination}`);

    expect(m.load).not.toHaveBeenCalled();
  });

  it("serves a secretaria with no Facultad", async () => {
    m.requireRole.mockResolvedValue({ ...secretaria, facultadId: null });

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("has one h1 and no skipped heading level", async () => {
    await renderPage();

    const levels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it("states once when a change takes effect (NP-13)", async () => {
    await renderPage();

    expect(screen.getAllByText("effectNote")).toHaveLength(1);
  });

  it("mounts the scalars section with the values in force", async () => {
    await renderPage();

    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(inputs.map((input) => input.name)).toEqual([
      "plazo_remision_dias",
      "alerta_dias",
      "presentacion_tardia_dias",
      "ventana_presentacion_dias",
      "umbral_reincidencia",
      "tamano_maximo_mib",
    ]);
    expect(inputs.map((input) => input.value)).toEqual([
      "2",
      "1",
      "2",
      "30",
      "4",
      "10",
    ]);
  });

  it("mounts the calendar section with every stored date", async () => {
    await renderPage();

    expect(screen.getAllByLabelText("dateLabel")).toHaveLength(
      DEFAULT_PARAMETERS.nonWorkingDays.length,
    );
  });

  it("mounts the document type to cause section", async () => {
    await renderPage();

    expect(
      screen.getByRole("group", { name: "types.constancia_medica" }),
    ).toBeInTheDocument();
  });

  it("mounts the causes section with a move control per cause", async () => {
    await renderPage();

    expect(screen.getAllByRole("button", { name: "moveUp" })).toHaveLength(5);
  });

  it("writes nothing when it opens", async () => {
    await renderPage();

    expect(m.action).not.toHaveBeenCalled();
    expect(m.writeParameters).not.toHaveBeenCalled();
    expect(m.withCatalogWrite).not.toHaveBeenCalled();
  });

  it("shows no alert and locks no form when the read fell back", async () => {
    m.load.mockResolvedValue(
      read({
        values: DEFAULT_PARAMETERS,
        fallback: ["alerta_dias"],
        degraded: true,
      }),
    );

    await renderPage();

    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    for (const input of screen.getAllByRole("spinbutton")) {
      expect(input).toBeEnabled();
    }
    const saves = screen.getAllByRole("button", { name: /save$/ });
    expect(saves).toHaveLength(4);
    for (const button of saves) expect(button).toBeEnabled();
  });
});
