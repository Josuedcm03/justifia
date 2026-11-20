import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  sessionFor,
  type Locale,
} from "@/app/(dashboard)/review/test-support";
import { PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  getUsuarioMock,
  listCarrerasMock,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  getUsuarioMock: vi.fn(),
  listCarrerasMock: vi.fn(),
  state: { locale: "en" as Locale },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
// The REAL dal runs on a mocked session source (reports page pattern).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/users", () => ({ getUsuarioByLogin: getUsuarioMock }));
vi.mock("@/lib/data/carreras", () => ({ listCarreras: listCarrerasMock }));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

let Page: () => Promise<React.ReactNode>;

async function renderPage() {
  const ui = await Page();
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages.en}
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

function accountOf(login: string, rol: string) {
  return {
    id: 7,
    login,
    rol,
    nombreCompleto: `Name of ${login}`,
    correo: `${login}@example.test`,
    telefono: "8888-0000",
    cif: "2021-0042",
    carreraId: 3,
    creadoEn: new Date("2026-03-05T12:00:00Z"),
  };
}

beforeAll(async () => {
  Page = (await import("@/app/(dashboard)/profile/page"))
    .default as unknown as typeof Page;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(null);
  getUsuarioMock.mockReset();
  getUsuarioMock.mockImplementation(async (login: string) =>
    accountOf(login, "estudiante"),
  );
  listCarrerasMock.mockReset();
  listCarrerasMock.mockResolvedValue([{ id: 3, nombre: "Derecho" }]);
});

// Characterization pins: the page already behaves this way, so these pass at
// write (AEA-2, RNF-01 c).
describe("ProfilePage without a normal session (AEA-2)", () => {
  it("sends an anonymous caller to /login with no profile read", async () => {
    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");

    expect(getUsuarioMock).not.toHaveBeenCalled();
    expect(listCarrerasMock).not.toHaveBeenCalled();
  });

  it("sends a flagged caller to the change screen with no profile read", async () => {
    getSessionMock.mockResolvedValue(sessionFor("estudiante", true));

    await expect(renderPage()).rejects.toThrow(
      `REDIRECT:${PASSWORD_CHANGE_PATH}`,
    );

    expect(getUsuarioMock).not.toHaveBeenCalled();
    expect(listCarrerasMock).not.toHaveBeenCalled();
  });
});

describe("ProfilePage own data per role (AEA-2)", () => {
  it.each(rolesUsuario)(
    "shows %s only the profile of the session login",
    async (rol) => {
      const login = `${rol}.user`;
      getSessionMock.mockResolvedValue({ ...sessionFor(rol), login });
      getUsuarioMock.mockImplementation(async (asked: string) =>
        accountOf(asked, rol),
      );

      await renderPage();

      expect(getUsuarioMock).toHaveBeenCalledTimes(1);
      expect(getUsuarioMock).toHaveBeenCalledWith(login);
      expect(screen.getByText(`Name of ${login}`)).toBeInTheDocument();
      expect(screen.getByText(`${login}@example.test`)).toBeInTheDocument();
      expect(screen.getByText("Derecho")).toBeInTheDocument();
    },
  );
});

// FE-20 (UX-20): the profile offers the voluntary password change to every role
// that can see it. The flagged and anonymous redirects above are unchanged and
// render nothing, so no link can appear for them.
describe("ProfilePage: the Change password link (FE-20)", () => {
  it.each(rolesUsuario)(
    "offers 'Change password' to %s, pointing to the existing change screen",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await renderPage();

      const link = screen.getByRole("link", { name: "Change password" });
      expect(link).toHaveAttribute("href", PASSWORD_CHANGE_PATH);
      expect(PASSWORD_CHANGE_PATH).toBe("/change-password");
    },
  );

  it("says 'Cambiar contraseña' in Spanish", async () => {
    state.locale = "es";
    getSessionMock.mockResolvedValue(sessionFor("estudiante"));

    await renderPage();

    expect(
      screen.getByRole("link", { name: "Cambiar contraseña" }),
    ).toHaveAttribute("href", "/change-password");
  });

  it("is an outline large link, a 44 px target like the other secondary actions", async () => {
    getSessionMock.mockResolvedValue(sessionFor("secretaria"));

    await renderPage();

    const link = screen.getByRole("link", { name: "Change password" });
    expect(link).toHaveClass("h-11", "border-primary");
  });

  it("is the only link on the page and leaves the account rows as they were", async () => {
    getSessionMock.mockResolvedValue(sessionFor("estudiante"));

    await renderPage();

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("caller@example.test")).toBeInTheDocument();
    expect(screen.getByText("2021-0042")).toBeInTheDocument();
  });

  it("has the label in both catalogs", () => {
    expect(messages.es.profile.changePassword).toBe("Cambiar contraseña");
    expect(messages.en.profile.changePassword).toBe("Change password");
  });
});
