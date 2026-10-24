import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  sessionFor,
  type Locale,
} from "@/app/(dashboard)/review/test-support";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock, loadMock, state } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  loadMock: vi.fn(),
  state: { locale: "es" as Locale },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
// The REAL dal runs on a mocked session source, so the guard order is the
// production one.
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/enrollment-picker", () => ({
  loadEnrollmentPage: loadMock,
}));
vi.mock("@/app/(dashboard)/enrollment/actions", () => ({
  enrollAction: vi.fn(),
  dropAction: vi.fn(),
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

const EMAIL = "docente.secreto@uam.edu.ni";
const PHONE = "+505 8888 7777";

function enrollment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    grupoId: 11,
    asignaturaId: 1,
    asignaturaCodigo: "MAT-101",
    asignaturaNombre: "Cálculo",
    periodo: "2026-S2",
    numeroGrupo: "01",
    docenteNombre: "Ana Pérez",
    inOpenRequest: false,
    ...overrides,
  };
}

function pageData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      periodo: "2026-S2",
      enrollments: [enrollment()],
      asignaturas: [],
      truncated: false,
      groups: [],
      ...overrides,
    },
    degraded: false,
  };
}

type Query = Record<string, string | string[] | undefined>;
let Page: (props: { searchParams: Promise<Query> }) => Promise<React.ReactNode>;

async function build(query: Query = {}) {
  return Page({ searchParams: Promise.resolve(query) });
}

async function renderPage(query: Query = {}) {
  const ui = await build(query);
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

const es = messages.es.enrollment;

beforeAll(async () => {
  Page = (await import("@/app/(dashboard)/enrollment/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "es";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("estudiante"));
  loadMock.mockReset();
  loadMock.mockResolvedValue(pageData());
});

describe("EnrollmentPage access (RNF-01)", () => {
  it("reads for the session student only, never for an id from the request", async () => {
    await renderPage({ studentId: "99", estudianteId: "99" });

    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(loadMock).toHaveBeenCalledWith(7, null);
  });

  it.each(rolesUsuario.filter((rol) => rol !== "estudiante"))(
    "sends %s to /denied and reads nothing",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(renderPage()).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(loadMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login and reads nothing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("sends a flagged student to the change screen first", async () => {
    getSessionMock.mockResolvedValue(sessionFor("estudiante", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );
    expect(loadMock).not.toHaveBeenCalled();
  });
});

describe("EnrollmentPage ?asignatura= guard (SE-6)", () => {
  it.each([
    ["a number", "12", 12],
    ["a large safe number", "9007199254740991", 9007199254740991],
  ])("passes %s to the read", async (_l, raw, expected) => {
    await renderPage({ asignatura: raw });

    expect(loadMock).toHaveBeenCalledWith(7, expected);
  });

  it.each([
    ["zero", "0"],
    ["a negative", "-3"],
    ["a decimal", "1.5"],
    ["text", "abc"],
    ["a leading-zero id", "012"],
    ["a trailing-junk id", "7abc"],
    ["an unsafe integer", "9007199254740993"],
    ["a repeated param", ["1", "2"]],
    ["an empty value", ""],
  ])("reads without an asignatura for %s", async (_l, raw) => {
    await renderPage({ asignatura: raw });

    expect(loadMock).toHaveBeenCalledWith(7, null);
  });
});

describe("EnrollmentPage content (RF-16)", () => {
  it("has exactly one h1 and lists the student's enrollments", async () => {
    await renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      es.title,
    );
    const items = within(
      screen.getByRole("list", { name: es.list.caption }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("MAT-101 · Cálculo");
  });

  it("shows the empty list state when the student has no enrollment", async () => {
    loadMock.mockResolvedValue(pageData({ enrollments: [] }));

    await renderPage();

    expect(screen.getByText(es.list.empty)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says no group is offered when there is no latest period, keeping the list", async () => {
    loadMock.mockResolvedValue(pageData({ periodo: null }));

    await renderPage();

    expect(screen.getByText(es.noOffering)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: es.list.caption })).toBeVisible();
  });

  it("does not claim that nothing is offered while a period exists", async () => {
    await renderPage();

    expect(screen.queryByText(es.noOffering)).toBeNull();
  });

  it("reads its text from the English catalog", async () => {
    state.locale = "en";

    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.en.enrollment.title,
    );
  });
});

describe("EnrollmentPage degraded read (RF-16)", () => {
  beforeEach(() => {
    loadMock.mockResolvedValue({
      data: pageData({ enrollments: [] }).data,
      degraded: true,
    });
  });

  it("shows the shared status alert in place of the list and the empty states", async () => {
    await renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(es.degraded);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(es.list.empty)).toBeNull();
    expect(screen.queryByText(es.noOffering)).toBeNull();
  });

  it("offers no action", async () => {
    await renderPage();

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("EnrollmentPage never carries docente contact data (RNF-01, RNF-02)", () => {
  it("keeps an email and a phone out of the props and the HTML", async () => {
    loadMock.mockResolvedValue(
      pageData({
        enrollments: [
          enrollment({ docenteEmail: EMAIL, email: EMAIL, telefono: PHONE }),
        ],
      }),
    );

    const ui = await build();
    const { container } = await renderPage();

    const serialized = JSON.stringify(ui);
    expect(serialized).toContain("Ana Pérez");
    for (const secret of [EMAIL, PHONE]) {
      expect(serialized).not.toContain(secret);
      expect(container.innerHTML).not.toContain(secret);
    }
  });
});
