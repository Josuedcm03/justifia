import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { loginAction } from "@/app/(auth)/login/actions";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { messages, renderWithIntl } from "@/test/intl";

// The form only hands the action to `useActionState`; a double keeps the
// session and data layers out of the tree.
vi.mock("@/app/(auth)/login/actions", () => ({
  loginAction: vi.fn(async () => ({ error: null })),
}));

const login = messages.es.auth.login;

describe("LoginForm register link (REGISTRATION_OPEN)", () => {
  it("hides the way to /register while registration is closed", () => {
    const { container } = renderWithIntl(
      <LoginForm next="/" registrationOpen={false} />,
    );

    expect(screen.queryByRole("link", { name: login.registerLink })).toBeNull();
    expect(screen.queryByText(login.isStudent)).toBeNull();
    expect(container.querySelector('a[href="/register"]')).toBeNull();
    // The sign-in form itself is unaffected.
    expect(
      screen.getByRole("button", { name: login.submit }),
    ).toBeInTheDocument();
  });

  it("links to /register while registration is open", () => {
    renderWithIntl(<LoginForm next="/" registrationOpen />);

    expect(screen.getByText(login.isStudent)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: login.registerLink }),
    ).toHaveAttribute("href", "/register");
  });
});

// FE-21: one identifier field, labelled with the CIF and the email, and no
// "Usuario" anywhere in the form. The sign-in page is a "usted" screen.
describe("LoginForm identifier field (FE-21)", () => {
  const copy = {
    es: {
      label: "CIF o correo institucional",
      hint: "Los estudiantes pueden usar su CIF o su correo; el personal, su correo institucional.",
    },
    en: {
      label: "CIF or institutional email",
      hint: "Students may use their CIF or email; staff use their institutional email.",
    },
  } as const;

  it.each(["es", "en"] as const)(
    "labels the one identifier field with the CIF and the email in %s",
    (locale) => {
      renderWithIntl(<LoginForm next="/" registrationOpen={false} />, locale);

      const field = screen.getByLabelText(copy[locale].label);
      expect(field).toHaveAttribute("name", "login");
      expect(field).toBeRequired();
      expect(field).toHaveAttribute("autocomplete", "username");
      // Exactly one identifier field besides the password.
      expect(screen.getAllByRole("textbox")).toHaveLength(1);
    },
  );

  it.each(["es", "en"] as const)(
    "explains who uses what with the hint in %s, tied to the field",
    (locale) => {
      renderWithIntl(<LoginForm next="/" registrationOpen={false} />, locale);

      const hint = screen.getByText(copy[locale].hint);
      const field = screen.getByLabelText(copy[locale].label);
      expect(field.getAttribute("aria-describedby")).toContain(hint.id);
    },
  );

  it("pins the catalog values of the label and the hint", () => {
    expect(messages.es.auth.login.loginLabel).toBe(copy.es.label);
    expect(messages.es.auth.login.loginHint).toBe(copy.es.hint);
    expect(messages.en.auth.login.loginLabel).toBe(copy.en.label);
    expect(messages.en.auth.login.loginHint).toBe(copy.en.hint);
  });

  it.each(["es", "en"] as const)(
    "never says Usuario or username in %s, before or after a failed attempt",
    async (locale) => {
      vi.mocked(loginAction).mockResolvedValueOnce({
        error: messages[locale].auth.errors.invalid,
      });
      const { container } = renderWithIntl(
        <LoginForm next="/" registrationOpen />,
        locale,
      );
      const forbidden = /usuario|user(name)?\b/i;

      expect(container.textContent).not.toMatch(forbidden);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(copy[locale].label), "26001234");
      await user.type(
        screen.getByLabelText(messages[locale].auth.login.passwordLabel),
        "temporary-pass",
      );
      await user.click(
        screen.getByRole("button", {
          name: messages[locale].auth.login.submit,
        }),
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(messages[locale].auth.errors.invalid);
      expect(container.textContent).not.toMatch(forbidden);
      expect(screen.getByLabelText(copy[locale].label)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    },
  );
});
