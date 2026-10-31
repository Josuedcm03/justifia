import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import { RequestFilters } from "@/app/(dashboard)/reports/requests/request-filters";

vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);

// CR-DET-2, CR-6: a plain GET form. The page reloads with the query string, so
// the filters hold no client state and need no router.

const LABELS = {
  region: "Filters",
  period: "Academic period",
  allPeriods: "All periods",
  teacher: "Teacher",
  allTeachers: "All teachers",
  teacherOutside: "Teacher outside your career",
  student: "Student",
  studentHint: "Name or CIF",
  cause: "Cause",
  allCauses: "All causes",
  apply: "Apply filters",
  clear: "Clear filters",
};

const PERIODS = ["2026-S2", "2026-S1"];
const DOCENTES = [
  { id: 4, name: "Ana Mora" },
  { id: 9, name: "Marta Ruiz" },
];
const CAUSES = [
  { value: "medica", label: "Medical" },
  { value: "fuerza_mayor", label: "Other force majeure" },
];

const NONE = { period: "all", docenteId: null, causa: null, q: "" } as const;

function show(selected: Parameters<typeof RequestFilters>[0]["selected"]) {
  return render(
    <RequestFilters
      labels={LABELS}
      periods={PERIODS}
      docentes={DOCENTES}
      causes={CAUSES}
      selected={selected}
      clearHref="/reports/requests"
    />,
  );
}

function form() {
  return document.querySelector("form") as HTMLFormElement;
}

async function optionLabels(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name }));
  const labels = (await screen.findAllByRole("option")).map(
    (option) => option.textContent,
  );
  await userEvent.keyboard("{Escape}");
  return labels;
}

describe("RequestFilters form", () => {
  it("is a labelled plain GET form to the detail with a submit button", () => {
    show(NONE);

    expect(screen.getByRole("form", { name: "Filters" })).toBe(form());
    expect(form()).toHaveAttribute("method", "get");
    expect(form()).toHaveAttribute("action", "/reports/requests");
    expect(
      within(form()).getByRole("button", { name: "Apply filters" }),
    ).toHaveAttribute("type", "submit");
  });

  it("labels the period, teacher and cause selects and the student field", () => {
    show(NONE);

    expect(
      screen.getByRole("combobox", { name: "Academic period" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Teacher" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Cause" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Student" })).toHaveAttribute(
      "name",
      "q",
    );
  });

  it("hints that the student field takes a name or a CIF", () => {
    show(NONE);

    expect(
      screen.getByRole("textbox", { name: "Student" }),
    ).toHaveAccessibleDescription("Name or CIF");
  });

  it("submits every filter as all or empty when none is chosen", () => {
    show(NONE);

    const data = new FormData(form());
    expect(data.get("period")).toBe("all");
    expect(data.get("docente")).toBe("all");
    expect(data.get("causa")).toBe("all");
    expect(data.get("q")).toBe("");
  });

  it("keeps the chosen values: they are what the form submits and shows", () => {
    show({ period: "2026-S1", docenteId: 9, causa: "medica", q: "Ana Lopez" });

    const data = new FormData(form());
    expect(data.get("period")).toBe("2026-S1");
    expect(data.get("docente")).toBe("9");
    expect(data.get("causa")).toBe("medica");
    expect(data.get("q")).toBe("Ana Lopez");
    expect(
      screen.getByRole("combobox", { name: "Academic period" }),
    ).toHaveTextContent("2026-S1");
    expect(screen.getByRole("combobox", { name: "Teacher" })).toHaveTextContent(
      "Marta Ruiz",
    );
    expect(screen.getByRole("combobox", { name: "Cause" })).toHaveTextContent(
      "Medical",
    );
    expect(screen.getByRole("textbox", { name: "Student" })).toHaveValue(
      "Ana Lopez",
    );
  });
});

describe("RequestFilters options", () => {
  it("offers all periods, then the periods newest first", async () => {
    show(NONE);

    expect(await optionLabels("Academic period")).toEqual([
      "All periods",
      "2026-S2",
      "2026-S1",
    ]);
  });

  it("adds a well-formed period with no data in its place, once", async () => {
    show({ ...NONE, period: "2025-S1" });

    expect(
      screen.getByRole("combobox", { name: "Academic period" }),
    ).toHaveTextContent("2025-S1");
    expect(await optionLabels("Academic period")).toEqual([
      "All periods",
      "2026-S2",
      "2026-S1",
      "2025-S1",
    ]);
  });

  it("offers all teachers, then the teachers of the career by name", async () => {
    show(NONE);

    expect(await optionLabels("Teacher")).toEqual([
      "All teachers",
      "Ana Mora",
      "Marta Ruiz",
    ]);
  });

  it("shows a teacher id outside the career as a generic option, never a name", async () => {
    show({ ...NONE, docenteId: 99 });

    expect(screen.getByRole("combobox", { name: "Teacher" })).toHaveTextContent(
      "Teacher outside your career",
    );
    expect(new FormData(form()).get("docente")).toBe("99");
    expect(await optionLabels("Teacher")).toEqual([
      "All teachers",
      "Ana Mora",
      "Marta Ruiz",
      "Teacher outside your career",
    ]);
  });

  it("offers all causes, then the causes it is given", async () => {
    show(NONE);

    expect(await optionLabels("Cause")).toEqual([
      "All causes",
      "Medical",
      "Other force majeure",
    ]);
  });
});

describe("RequestFilters clear control", () => {
  it("is a link back to the unfiltered detail that never prefetches it", () => {
    show({ period: "2026-S1", docenteId: 4, causa: "medica", q: "x" });

    const clear = screen.getByRole("link", { name: "Clear filters" });
    expect(clear).toHaveAttribute("href", "/reports/requests");
    expect(clear).toHaveAttribute("data-prefetch", "false");
  });
});

describe("RequestFilters accessibility", () => {
  it("reports no accessibility violation", async () => {
    const { container } = show({
      period: "2026-S1",
      docenteId: 9,
      causa: "medica",
      q: "Ana",
    });

    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});
