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
