import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RegistrationClosed } from "@/app/(auth)/register/registration-closed";
import { sessionFor } from "@/app/(dashboard)/review/test-support";
import { messages, renderWithIntl } from "@/test/intl";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock, listCarrerasMock, formDouble, envMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    getSessionMock: vi.fn(),
    listCarrerasMock: vi.fn(),
    // The page only hands the careers to the form; a double keeps the tree
    // light (the real form pulls in the register action and the data layer).
    formDouble: () => null,
    // The parsed env; each test sets the REGISTRATION_OPEN switch.
    envMock: { REGISTRATION_OPEN: true },
  }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/env", () => ({ env: envMock }));
// The REAL dal runs on a mocked session source (reports page pattern).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/carreras", () => ({ listCarreras: listCarrerasMock }));
vi.mock("@/app/(auth)/register/register-form", () => ({
  RegisterForm: formDouble,
}));

const CARRERAS = [
  { id: 1, nombre: "Ingenieria de Sistemas" },
  { id: 2, nombre: "Derecho" },
];

type Element = ReactElement<{ carreras: typeof CARRERAS }>;

let Page: () => Promise<Element>;

beforeAll(async () => {
  Page = (await import("@/app/(auth)/register/page"))
    .default as unknown as typeof Page;
}, 60_000);

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(null);
  listCarrerasMock.mockReset();
  listCarrerasMock.mockResolvedValue(CARRERAS);
  envMock.REGISTRATION_OPEN = true;
});

// Characterization pins: a signed-in visitor goes to / whether or not
// registration is open (the default setup opens it).
describe("RegisterPage signed-in identity (AEA-1, RNF-01 c)", () => {
  it.each(rolesUsuario)(
    "sends %s to / without reading the careers",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(Page()).rejects.toThrow("REDIRECT:/");

      expect(redirectMock).toHaveBeenCalledWith("/");
      expect(listCarrerasMock).not.toHaveBeenCalled();
    },
  );

  it.each(rolesUsuario)(
    "sends a flagged %s to / without reading the careers",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol, true));

      await expect(Page()).rejects.toThrow("REDIRECT:/");

      expect(redirectMock).toHaveBeenCalledWith("/");
      expect(listCarrerasMock).not.toHaveBeenCalled();
    },
  );
});

describe("RegisterPage anonymous visitor with registration open (AEA-1)", () => {
  it("gives the form the careers, read after the session check", async () => {
    const el = await Page();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(el.type).toBe(formDouble);
    expect(el.props.carreras).toEqual(CARRERAS);
    expect(getSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
      listCarrerasMock.mock.invocationCallOrder[0],
    );
  });
});

describe("RegisterPage with registration closed (REGISTRATION_OPEN)", () => {
  const closed = messages.es.auth.register.closed;

  beforeEach(() => {
    envMock.REGISTRATION_OPEN = false;
  });

  it("shows the notice and a way back to /login, with no form", async () => {
    const el = await Page();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(el.type).toBe(RegistrationClosed);
    expect(listCarrerasMock).not.toHaveBeenCalled();

    const { container } = renderWithIntl(el);
    expect(
      screen.getByRole("heading", { name: closed.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(closed.body)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: closed.backToLogin }),
    ).toHaveAttribute("href", "/login");
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it.each(rolesUsuario)("still sends a signed-in %s to /", async (rol) => {
    getSessionMock.mockResolvedValue(sessionFor(rol));

    await expect(Page()).rejects.toThrow("REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
