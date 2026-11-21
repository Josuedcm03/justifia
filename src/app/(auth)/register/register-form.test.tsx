import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { registerAction } from "@/app/(auth)/register/actions";
import { RegisterForm } from "@/app/(auth)/register/register-form";
import { messages, renderWithIntl } from "@/test/intl";

// The form only hands the action to `useActionState`; a double keeps the
// session and data layers out of the tree.
vi.mock("@/app/(auth)/register/actions", () => ({
  registerAction: vi.fn(async () => ({ error: null })),
}));

const CARRERAS = [
  { id: 1, nombre: "Ingenieria de Sistemas" },
  { id: 2, nombre: "Derecho" },
];

function renderForm(locale: "es" | "en" = "es") {
  return renderWithIntl(<RegisterForm carreras={CARRERAS as never} />, locale);
}

// FE-26, FE-28: the student registers with the email and the CIF, never with a
// chosen username. The register screen is a student screen ("tú").
describe("RegisterForm without a Usuario (FE-26, FE-28)", () => {
  it.each(["es", "en"] as const)("has no login field in %s", (locale) => {
    const { container } = renderForm(locale);

    expect(container.querySelector("[name=login]")).toBeNull();
    expect(container.querySelector("#login")).toBeNull();
    expect(
      screen.queryByLabelText(/^(usuario|username)$/i),
    ).not.toBeInTheDocument();
  });

  it.each(["es", "en"] as const)(
    "requires the email and the CIF in %s",
    (locale) => {
      renderForm(locale);
      const t = messages[locale].auth.register;

      const email = screen.getByLabelText(t.emailLabel);
      expect(email).toHaveAttribute("name", "correo");
      expect(email).toHaveAttribute("type", "email");
      expect(email).toBeRequired();

      const cif = screen.getByLabelText(t.cifLabel);
      expect(cif).toHaveAttribute("name", "cif");
      expect(cif).toBeRequired();
    },
  );

  it.each(["es", "en"] as const)(
    "never says Usuario or username anywhere in the %s form",
    (locale) => {
      const { container } = renderForm(locale);

      expect(container.textContent).not.toMatch(/usuario|user(name)?\b/i);
    },
  );

  it("has no key or label for a Usuario to type in the copy", () => {
    for (const locale of ["es", "en"] as const) {
      for (const [key, value] of Object.entries(
        messages[locale].auth.register,
      )) {
        expect(key.toLowerCase()).not.toContain("login");
        if (typeof value === "string") {
          expect(value).not.toMatch(/^(usuario|username)$/i);
        }
      }
    }
  });

  it("describes the email field by the error when the registration fails", async () => {
    const t = messages.es.auth.register;
    vi.mocked(registerAction).mockResolvedValueOnce({
      error: t.errors.duplicate,
    });
    renderForm();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(t.nameLabel), "Nueva Cuenta");
    await user.type(screen.getByLabelText(t.cifLabel), "26001234");
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Derecho" }));
    await user.type(screen.getByLabelText(t.emailLabel), "nueva@uni.edu");
    await user.type(screen.getByLabelText(t.passwordLabel), "long-enough-pass");
    await user.type(
      screen.getByLabelText(t.confirmPasswordLabel),
      "long-enough-pass",
    );
    await user.click(screen.getByRole("button", { name: t.submit }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(t.errors.duplicate);
    expect(screen.getByLabelText(t.emailLabel)).toHaveAttribute(
      "aria-describedby",
      alert.id,
    );
  });
});

describe("register copy (FE-26, FE-28; student screen, tú)", () => {
  it("pins the duplicate and email-too-long lines in Spanish", () => {
    const es = messages.es.auth.register.errors;

    expect(es.duplicate).toBe("El CIF o el correo ya están registrados.");
    expect(es.emailTooLong).toBe(
      "El correo no puede superar los 60 caracteres.",
    );
  });

  it("pins the duplicate and email-too-long lines in English", () => {
    const en = messages.en.auth.register.errors;

    expect(en.duplicate).toBe("The CIF or email is already registered.");
    expect(en.emailTooLong).toBe("The email cannot exceed 60 characters.");
  });
});
