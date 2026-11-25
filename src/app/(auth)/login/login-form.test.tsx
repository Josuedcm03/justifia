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
    es: { label: "CIF o correo institucional" },
    en: { label: "CIF or institutional email" },
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
    "has the label alone in %s: no hint under the field, and no description until an error",
    (locale) => {
      renderWithIntl(<LoginForm next="/" registrationOpen={false} />, locale);

      const field = screen.getByLabelText(copy[locale].label);
      expect(field).not.toHaveAttribute("aria-describedby");
      expect(field.nextElementSibling).toBeNull();
      expect(messages[locale].auth.login).not.toHaveProperty("loginHint");
    },
  );

  it("pins the catalog values of the label", () => {
    expect(messages.es.auth.login.loginLabel).toBe(copy.es.label);
    expect(messages.en.auth.login.loginLabel).toBe(copy.en.label);
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
      const field = screen.getByLabelText(copy[locale].label);
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAttribute("aria-describedby", alert.id);
    },
  );
});

// FE-32 (UX-22): one checkbox, unchecked by default, posted as "mantener".
describe("LoginForm keep the session signed in (FE-32)", () => {
  const label = {
    es: "Mantener la sesión iniciada",
    en: "Keep me signed in",
  } as const;

  async function submitWith(locale: "es" | "en", check: boolean) {
    vi.mocked(loginAction).mockClear();
    renderWithIntl(<LoginForm next="/" registrationOpen={false} />, locale);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(messages[locale].auth.login.loginLabel),
      "26001234",
    );
    await user.type(
      screen.getByLabelText(messages[locale].auth.login.passwordLabel),
      "temporary-pass",
    );
    if (check) await user.click(screen.getByLabelText(label[locale]));
    await user.click(
      screen.getByRole("button", { name: messages[locale].auth.login.submit }),
    );
    await vi.waitFor(() => expect(loginAction).toHaveBeenCalledTimes(1));
    // Let the action promise settle: the button is back to its label once the
    // transition ends.
    await screen.findByRole("button", {
      name: messages[locale].auth.login.submit,
    });
    return vi.mocked(loginAction).mock.calls[0][1] as FormData;
  }

  it.each(["es", "en"] as const)(
    "offers an unchecked native checkbox labelled for %s",
    (locale) => {
      renderWithIntl(<LoginForm next="/" registrationOpen={false} />, locale);

      const box = screen.getByRole("checkbox", { name: label[locale] });
      expect(box).not.toBeChecked();
      expect(box).toHaveAttribute("name", "mantener");
      expect(box).toHaveAttribute("type", "checkbox");
      // The whole row is the target, and its text is a body line like the
      // other checkbox rows, not a field label.
      const row = box.closest("label");
      expect(row).toHaveClass("min-h-11", "text-sm");
      expect(row).toHaveTextContent(label[locale]);
    },
  );

  it("pins the catalog values of the label", () => {
    expect(messages.es.auth.login.keepSession).toBe(label.es);
    expect(messages.en.auth.login.keepSession).toBe(label.en);
  });

  it("posts mantener=on when the box is checked", async () => {
    const data = await submitWith("es", true);

    expect(data.get("mantener")).toBe("on");
  });

  it("posts no mantener when the box is left unchecked", async () => {
    const data = await submitWith("es", false);

    expect(data.has("mantener")).toBe(false);
  });

  it("keeps the identifier and the password fields as they were", async () => {
    const data = await submitWith("en", true);

    expect(data.get("login")).toBe("26001234");
    expect(data.get("password")).toBe("temporary-pass");
  });
});
