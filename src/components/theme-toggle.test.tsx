import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";
import messages from "../../i18n/en.json";

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: "light" }),
}));

describe("ThemeToggle", () => {
  it("renders the accessible toggle label", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ThemeToggle />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole("button", { name: messages.theme.toggle }),
    ).toBeInTheDocument();
  });
});
