import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IntakeStepper } from "@/app/(dashboard)/requests/new/intake-stepper";
import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

function items() {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("IntakeStepper (RF-01, RNF-11)", () => {
  it("lists the four steps in order, in Spanish", () => {
    renderIntl(<IntakeStepper current={1} />);
    expect(items().map((li) => li.textContent)).toEqual([
      "Causa y fechas",
      "Asignaturas",
      "Documentos",
      "Revisión",
    ]);
    expect(screen.getByRole("navigation")).toHaveAccessibleName(
      "Pasos de la solicitud",
    );
  });

  it("lists the same steps in English", () => {
    renderIntl(<IntakeStepper current={2} />, "en");
    expect(items().map((li) => li.textContent)).toEqual([
      "Cause and dates",
      "Subjects",
      "Documents",
      "Review",
    ]);
  });

  it("marks the current step and says 'Step n of 4' for narrow screens", () => {
    renderIntl(<IntakeStepper current={3} />);
    const current = items().filter((li) =>
      li.querySelector('[aria-current="step"]'),
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Documentos");
    expect(screen.getByText("Paso 3 de 4")).toBeInTheDocument();
  });

  it("links back to earlier steps only", () => {
    renderIntl(<IntakeStepper current={3} />);
    const list = screen.getByRole("list");
    const links = within(list).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Causa y fechas", "/requests/new?step=1"],
      ["Asignaturas", "/requests/new?step=2"],
    ]);
  });

  it("has no links on the first step", () => {
    renderIntl(<IntakeStepper current={1} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
  });
});

describe("IntakeStepper under another base path (the correction)", () => {
  it("links the earlier steps under the given path", () => {
    renderIntl(<IntakeStepper current={3} basePath="/requests/31/correct" />);
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/requests/31/correct?step=1",
      "/requests/31/correct?step=2",
    ]);
  });
});
