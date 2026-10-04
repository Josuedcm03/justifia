import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";

const { changePasswordAction } = vi.hoisted(() => ({
  changePasswordAction: vi.fn(),
}));

vi.mock("@/app/change-password/actions", () => ({ changePasswordAction }));

import { ChangePasswordForm } from "@/app/change-password/change-password-form";

function renderForm(
  props: { forced?: boolean } = {},
  locale: "en" | "es" = "en",
) {
  const messages = locale === "en" ? enMessages : esMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ChangePasswordForm forced={props.forced ?? true} />
    </NextIntlClientProvider>,
  );
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    changePasswordAction.mockReset();
    changePasswordAction.mockResolvedValue({ error: null });
  });

  it.each([
    ["en", enMessages],
    ["es", esMessages],
  ] as const)("shows the three password fields in %s", (locale, messages) => {
    renderForm({}, locale);
    const copy = messages.changePassword;

    const current = screen.getByLabelText(copy.currentPasswordLabel);
    const next = screen.getByLabelText(copy.newPasswordLabel);
    const confirm = screen.getByLabelText(copy.confirmPasswordLabel);

    expect(current).toHaveAttribute("name", "currentPassword");
    expect(next).toHaveAttribute("name", "newPassword");
    expect(confirm).toHaveAttribute("name", "confirmPassword");
    for (const field of [current, next, confirm]) {
      expect(field).toHaveAttribute("type", "password");
      expect(field).toBeRequired();
    }
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      copy.title,
    );
    expect(
      screen.getByRole("button", { name: copy.submit }),
    ).toBeInTheDocument();
  });

  it("hints the browser which field holds which password", () => {
    renderForm();
    const copy = enMessages.changePassword;

    expect(screen.getByLabelText(copy.currentPasswordLabel)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByLabelText(copy.newPasswordLabel)).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText(copy.confirmPasswordLabel)).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });

  it("reuses PasswordInput: every field has a show/hide toggle", async () => {
    renderForm();
    const user = userEvent.setup();

    const toggles = screen.getAllByRole("button", {
      name: enMessages.common.showPassword,
    });
    expect(toggles).toHaveLength(3);

    await user.click(toggles[1]);
    expect(
      screen.getByLabelText(enMessages.changePassword.newPasswordLabel),
    ).toHaveAttribute("type", "text");
  });

  it("explains the forced change when the account is flagged", () => {
    renderForm({ forced: true });

    expect(
      screen.getByText(enMessages.changePassword.subtitleForced),
    ).toBeInTheDocument();
  });

  it("uses the neutral subtitle for a voluntary change", () => {
    renderForm({ forced: false });

    expect(
      screen.getByText(enMessages.changePassword.subtitle),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(enMessages.changePassword.subtitleForced),
    ).not.toBeInTheDocument();
  });

  it("shows no error before a submission", () => {
    renderForm();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error text returned in the action state", async () => {
    changePasswordAction.mockResolvedValue({
      error: enMessages.changePassword.errors.wrongCurrent,
    });
    renderForm();
    const copy = enMessages.changePassword;
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(copy.currentPasswordLabel),
      "old-pass",
    );
    await user.type(screen.getByLabelText(copy.newPasswordLabel), "new-pass-1");
    await user.type(
      screen.getByLabelText(copy.confirmPasswordLabel),
      "new-pass-1",
    );
    await user.click(screen.getByRole("button", { name: copy.submit }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.errors.wrongCurrent);
    expect(changePasswordAction).toHaveBeenCalledTimes(1);
    const submitted = changePasswordAction.mock.calls[0][1] as FormData;
    expect(submitted.get("currentPassword")).toBe("old-pass");
    expect(submitted.get("newPassword")).toBe("new-pass-1");
    expect(submitted.get("confirmPassword")).toBe("new-pass-1");
  });
});
