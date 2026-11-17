import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { messages } from "@/app/(dashboard)/review/test-support";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "es" }));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);

let NotFound: () => Promise<React.ReactNode>;

beforeAll(async () => {
  NotFound = (await import("@/app/(dashboard)/coordination/not-found")).default;
}, 60_000);

describe("coordination not-found", () => {
  it.each(["en", "es"] as const)(
    "answers the same text for every missing or out-of-career escalation in %s",
    async (locale) => {
      state.locale = locale;
      const text = messages[locale].coordination.notFound;

      render(await NotFound());

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        text.title,
      );
      expect(screen.getByText(text.message)).toBeInTheDocument();
      const back = screen.getByRole("link", { name: text.back });
      expect(back).toHaveAttribute("href", "/coordination");
      expect(back).toHaveAttribute("data-prefetch", "false");
    },
  );
});
