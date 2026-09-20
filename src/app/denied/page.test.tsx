import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const messages = enMessages as unknown as Record<
      string,
      Record<string, string>
    >;
    const dict = messages[namespace] ?? {};
    return (key: string) => dict[key];
  },
}));

describe("DeniedPage", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("renders one h1, the explanation and a single control leading to /", async () => {
    const { default: DeniedPage } = await import("@/app/denied/page");

    render(await DeniedPage());

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(enMessages.denied.title);
    expect(screen.getByText(enMessages.denied.message)).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/");
    expect(links[0]).toHaveAccessibleName(enMessages.denied.back);

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("gives the way-back control the 44px touch floor and leaves the global focus ring alone", async () => {
    const { default: DeniedPage } = await import("@/app/denied/page");

    render(await DeniedPage());

    const link = screen.getByRole("link", { name: enMessages.denied.back });
    expect(link.className).toContain("h-11");
    expect(link.className).not.toContain("ring-denied-foreground");
  });

  it("sits on the neutral app background with red confined to one icon accent", async () => {
    const { default: DeniedPage } = await import("@/app/denied/page");

    const { container } = render(await DeniedPage());

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.className.split(/\s+/)).toContain("bg-background");
    expect(main?.className.split(/\s+/)).not.toContain("bg-denied");

    expect(container.querySelectorAll(".text-denied")).toHaveLength(1);
  });

  it("exposes a document title through generateMetadata", async () => {
    const { generateMetadata } = await import("@/app/denied/page");

    const metadata = await generateMetadata();

    expect(String(metadata.title)).toContain(enMessages.denied.title);
  });

  it("has no session or role guard: the source imports neither dal nor permissions", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/denied/page.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/@\/lib\/auth\/dal/);
    expect(source).not.toMatch(/@\/lib\/auth\/permissions/);
  });

  it("keeps the es and en denied catalogs in sync and non-empty", () => {
    const esKeys = Object.keys(esMessages.denied ?? {}).sort();
    const enKeys = Object.keys(enMessages.denied ?? {}).sort();

    expect(esKeys).toEqual(["back", "message", "title"]);
    expect(esKeys).toEqual(enKeys);

    for (const key of esKeys) {
      expect(esMessages.denied[key as keyof typeof esMessages.denied]).not.toBe(
        "",
      );
      expect(enMessages.denied[key as keyof typeof enMessages.denied]).not.toBe(
        "",
      );
    }
  });
});
