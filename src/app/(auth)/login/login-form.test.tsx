import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
