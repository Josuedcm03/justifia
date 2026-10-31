import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import {
  RankingCard,
  type RankingRow,
} from "@/app/(dashboard)/reports/ranking-card";

// CR-RANK-3, CR-DASH-1: a presentational ranking. It receives plain display
// strings, so every assertion below is about what a reader sees.

const students: RankingRow[] = [
  {
    key: "s-7",
    label: "Ana Lopez",
    secondary: "2021-0042",
    totalText: "4 requests",
  },
  {
    key: "s-9",
    label: "Luis Mora",
    secondary: "2022-0100",
    totalText: "2 requests",
  },
  { key: "s-3", label: "Eva Ruiz", totalText: "1 request" },
];

function show(rows: RankingRow[] = students) {
  return render(
    <RankingCard
      title="Students"
      description="Students with the most justification requests."
      rows={rows}
      emptyText="No students to rank in this period."
    />,
  );
}

describe("RankingCard rows (CR-RANK-3)", () => {
  it("titles the card with an h2 and states what it counts", () => {
    show();

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Students",
    );
    expect(
      screen.getByText("Students with the most justification requests."),
    ).toBeInTheDocument();
  });

  it("lists the rows in the given order in one ordered list", () => {
    show();

    const list = screen.getByRole("list", { name: "Students" });
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Ana Lopez"),
      expect.stringContaining("Luis Mora"),
      expect.stringContaining("Eva Ruiz"),
    ]);
  });

  it("shows each total next to its name", () => {
    show();

    const [first, second, third] = within(
      screen.getByRole("list"),
    ).getAllByRole("listitem");
    expect(first).toHaveTextContent("4 requests");
    expect(second).toHaveTextContent("2 requests");
    expect(third).toHaveTextContent("1 request");
    expect(third).not.toHaveTextContent("1 requests");
  });

  it("shows the secondary text (the CIF) when a row has one, and only then", () => {
    show();

    const [first, , third] = within(screen.getByRole("list")).getAllByRole(
      "listitem",
    );
    expect(within(first).getByText("2021-0042")).toHaveClass(
      "text-muted-foreground",
    );
    expect(third.textContent).toBe("3Eva Ruiz1 request");
  });

  it("numbers the rows visually without announcing the number twice", () => {
    show();

    const [first, second] = within(screen.getByRole("list")).getAllByRole(
      "listitem",
    );
    const rank = within(first).getByText("1");
    expect(rank).toHaveAttribute("aria-hidden", "true");
    expect(within(second).getByText("2")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("RankingCard empty (CR-DASH-1)", () => {
  it("replaces the list with a muted text, in the same card", () => {
    show([]);

    expect(screen.getByText("No students to rank in this period.")).toHaveClass(
      "text-muted-foreground",
    );
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Students",
    );
  });

  it("shows no empty text beside real rows", () => {
    show();

    expect(
      screen.queryByText("No students to rank in this period."),
    ).toBeNull();
  });
});

describe("RankingCard module", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/reports/ranking-card.tsx"),
    "utf8",
  );

  it("is hook-free and not a client module", () => {
    expect(source).not.toMatch(/["']use client["']/);
    expect(source).not.toMatch(/\buse[A-Z]\w*\(/);
  });

  it.each([
    ["rows", () => show(), true],
    ["empty", () => show([]), false],
  ] as const)(
    "reports no accessibility violation (%s)",
    async (_l, run, hasRules) => {
      const { container } = run();

      // jsdom has no layout, so contrast is measured in the design system.
      const results = await axe.run(container, {
        runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        rules: { "color-contrast": { enabled: false } },
      });

      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      // The empty card is a heading and a paragraph: few rules apply to it.
      if (hasRules) expect(results.passes.length).toBeGreaterThan(0);
    },
  );
});
