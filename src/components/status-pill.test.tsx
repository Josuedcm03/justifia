import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "../../i18n/en.json";
import esMessages from "../../i18n/es.json";
import { StatusPill } from "@/components/status-pill";

// The pill takes its word from the caller; this harness resolves it from the
// existing `users.status` keys, as `/users` does.
function Harness({ active }: { active: boolean }) {
  const t = useTranslations("users.status");
  return (
    <StatusPill active={active} label={active ? t("active") : t("inactive")} />
  );
}

function renderPill(active: boolean, locale: "es" | "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <Harness active={active} />
    </NextIntlClientProvider>,
  );
}

describe("StatusPill (CM-NFR-3: Status is text; CM-LST-1: state as a word)", () => {
  it.each([
    [true, "es", "Activo"],
    [false, "es", "Inactivo"],
    [true, "en", "Active"],
    [false, "en", "Inactive"],
  ] as const)(
    "renders the word for active=%s in %s",
    (active, locale, word) => {
      renderPill(active, locale);

      expect(screen.getByText(word)).toBeInTheDocument();
    },
  );

  it("carries the state as text, never colour alone: the two states differ in their word", () => {
    const active = renderPill(true, "en");
    const activeText = active.container.textContent;
    active.unmount();
    const inactive = renderPill(false, "en");

    expect(activeText).not.toBe("");
    expect(inactive.container.textContent).not.toBe("");
    expect(activeText).not.toBe(inactive.container.textContent);
  });

  it("keeps the markup it had in /users: a pill with the success and muted tints", () => {
    const active = render(<StatusPill active label="x" />);
    const activeClass = active.getByText("x").className;
    active.unmount();
    const inactive = render(<StatusPill active={false} label="x" />);
    const inactiveClass = inactive.getByText("x").className;

    expect(activeClass).toContain("rounded-full");
    expect(activeClass).toContain("bg-success/10");
    expect(activeClass).toContain("text-success-ink");
    expect(inactiveClass).toContain("rounded-full");
    expect(inactiveClass).toContain("bg-muted");
    expect(inactiveClass).toContain("text-muted-foreground");
  });
});
