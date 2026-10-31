import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { PeriodFilter } from "@/app/(dashboard)/reports/period-filter";

// CR-PERIOD-1, CR-6: a plain GET form. The page reloads with `?period=...`, so
// the filter holds no client state and needs no router.

function show(selected: string, periods = ["2026-S2", "2026-S1", "2025-S2"]) {
  return render(
    <PeriodFilter
      label="Academic period"
      allLabel="All periods"
      applyLabel="Show period"
      periods={periods}
      selected={selected}
    />,
  );
}

function form() {
  return document.querySelector("form") as HTMLFormElement;
}

async function optionLabels() {
  await userEvent.click(screen.getByRole("combobox"));
  return (await screen.findAllByRole("option")).map(
    (option) => option.textContent,
  );
}

describe("PeriodFilter form", () => {
  it("is a plain GET form to the dashboard with a submit button", () => {
    show("2026-S2");

    expect(form()).toHaveAttribute("method", "get");
    expect(form()).toHaveAttribute("action", "/reports");
    expect(
      within(form()).getByRole("button", { name: "Show period" }),
    ).toHaveAttribute("type", "submit");
  });

  it("labels the select and shows the selected period", () => {
    show("2026-S1");

    const select = screen.getByRole("combobox", { name: "Academic period" });
    expect(select).toHaveTextContent("2026-S1");
  });

  it.each([
    ["2026-S2", "2026-S2"],
    ["2025-S2", "2025-S2"],
    ["all", "all"],
  ])("submits period=%s as the value %s", (selected, value) => {
    show(selected);

    expect(new FormData(form()).get("period")).toBe(value);
  });

  it("shows All periods when every period is selected", () => {
    show("all");

    expect(screen.getByRole("combobox")).toHaveTextContent("All periods");
  });
});

describe("PeriodFilter options", () => {
  it("lists All periods, then the periods newest first", async () => {
    show("2026-S2");

    expect(await optionLabels()).toEqual([
      "All periods",
      "2026-S2",
      "2026-S1",
      "2025-S2",
    ]);
  });

  it("adds a well-formed code that has no data, in its place, so the select shows it", async () => {
    show("2024-S1");

    expect(screen.getByRole("combobox")).toHaveTextContent("2024-S1");
    expect(await optionLabels()).toEqual([
      "All periods",
      "2026-S2",
      "2026-S1",
      "2025-S2",
      "2024-S1",
    ]);
  });

  it("does not repeat a period that is already listed", async () => {
    show("2026-S1");

    const labels = await optionLabels();
    expect(labels.filter((label) => label === "2026-S1")).toHaveLength(1);
  });

  it("still offers All periods when there are no periods", async () => {
    show("all", []);

    expect(await optionLabels()).toEqual(["All periods"]);
  });
});

describe("PeriodFilter accessibility", () => {
  it("reports no accessibility violation", async () => {
    const { container } = show("2026-S2");

    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});
