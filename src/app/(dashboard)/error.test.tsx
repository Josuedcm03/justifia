import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";
import DashboardError from "./error";

function fail(digest?: string) {
  const error = new Error("secret internal detail") as Error & {
    digest?: string;
  };
  if (digest) error.digest = digest;
  return error;
}

function renderError(
  props: { error: Error & { digest?: string }; retry: () => void },
  locale: "es" | "en" = "en",
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <DashboardError {...props} />
    </NextIntlClientProvider>,
  );
}

describe("(dashboard) error boundary (BS-ERR-1)", () => {
  it("never renders the raw error message", () => {
    const { container } = renderError({
      error: fail("d1g3st"),
      retry: vi.fn(),
    });

    expect(container.textContent).not.toContain("secret internal detail");
    expect(screen.queryByText(/secret internal detail/)).toBeNull();
  });

  it("renders exactly one h1, announced as an alert, with the explanation", () => {
    renderError({ error: fail(), retry: vi.fn() });

    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Something went wrong",
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "We could not show this screen. Try again or go back to the dashboard.",
    );
  });

  it("moves focus to the heading", () => {
    renderError({ error: fail(), retry: vi.fn() });

    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("calls retry (not reset) from the primary try-again button", async () => {
    const retry = vi.fn();
    const reset = vi.fn();
    const user = userEvent.setup();
    renderError({
      error: fail(),
      retry,
      // @ts-expect-error `reset` is not part of the contract this screen uses
      reset,
    });

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("retries from the keyboard with Enter and Space", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    renderError({ error: fail(), retry });

    const button = screen.getByRole("button", { name: "Try again" });
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(retry).toHaveBeenCalledTimes(2);
  });

  it("keeps the retry button at the 44px touch target", () => {
    renderError({ error: fail(), retry: vi.fn() });

    expect(screen.getByRole("button", { name: "Try again" })).toHaveClass(
      "h-11",
    );
  });

  it("links back to the dashboard", () => {
    renderError({ error: fail(), retry: vi.fn() });

    expect(
      screen.getByRole("link", { name: "Go to the dashboard" }),
    ).toHaveAttribute("href", "/");
  });

  it("shows the digest as muted reference text when present", () => {
    renderError({ error: fail("a1b2c3"), retry: vi.fn() });

    const reference = screen.getByText("Reference: a1b2c3");
    expect(reference).toHaveClass("text-muted-foreground");
  });

  it("shows no reference line without a digest", () => {
    renderError({ error: fail(), retry: vi.fn() });

    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });

  it("speaks Spanish in the es locale", () => {
    renderError({ error: fail("a1b2c3"), retry: vi.fn() }, "es");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Algo salió mal",
    );
    expect(
      screen.getByRole("button", { name: "Intentar de nuevo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Referencia: a1b2c3")).toBeInTheDocument();
  });

  it("adds no main landmark: the layout's single main holds it", () => {
    renderError({ error: fail(), retry: vi.fn() });

    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("wraps on narrow screens: no fixed width on the screen container", () => {
    const { container } = renderError({ error: fail(), retry: vi.fn() });

    expect(container.innerHTML).not.toMatch(/\bw-\d|\bw-\[|\bmin-w-/);
  });
});
