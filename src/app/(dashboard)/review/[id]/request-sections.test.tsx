import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";
import { StudentSection } from "@/app/(dashboard)/review/[id]/request-sections";

// RC-9, request-review "Consent shown on the staff detail": the consent state is
// one text fact of the student section, in the business time zone, and a request
// presented before consent existed reads as a neutral fact, never as an error.

const STUDENT = {
  nombre: "Ana Lopez",
  cif: "2021-0042",
  carrera: "Ingenieria de Sistemas",
  correo: "ana@uam.edu.ni",
};
// 14:05 on 21 October 2026 in America/Managua (UTC-6, no daylight saving).
const RECORDED = {
  version: "2026-10-20",
  en: new Date("2026-10-21T20:05:00Z"),
};

const en = messages.en.review.detail;
const es = messages.es.review.detail;

function fact(label: string) {
  const term = screen.getByText(label, { selector: "dt" });
  return term.nextElementSibling as HTMLElement;
}

describe("StudentSection consent fact (RF-01 d, RN-25)", () => {
  it("shows the version and the Managua date and time of a recorded consent", () => {
    renderIntl(<StudentSection student={STUDENT} consent={RECORDED} />);

    const value = fact(en.fields.consent);
    expect(value).toHaveTextContent("Version 2026-10-20, Oct 21, 2026");
    expect(value.textContent).toMatch(/2:05\s?PM/);
    expect(
      within(
        screen.getByRole("region", { name: en.sections.student }),
      ).getByText(en.fields.consent),
    ).toBeInTheDocument();
  });

  it("converts an instant that is already the next day in UTC to Managua time", () => {
    renderIntl(
      <StudentSection
        student={STUDENT}
        consent={{
          version: "2026-10-20",
          en: new Date("2026-10-22T03:30:00Z"),
        }}
      />,
    );

    const value = fact(en.fields.consent);
    expect(value).toHaveTextContent("Oct 21, 2026");
    expect(value.textContent).toMatch(/9:30\s?PM/);
  });

  it("speaks Spanish", () => {
    renderIntl(<StudentSection student={STUDENT} consent={RECORDED} />, "es");

    const value = fact(es.fields.consent);
    expect(value).toHaveTextContent("Versión 2026-10-20, 21 oct 2026");
    expect(value.textContent).toContain("14:05");
  });

  it("says that no consent is recorded for a request presented before consent existed", () => {
    renderIntl(<StudentSection student={STUDENT} consent={null} />);

    expect(fact(en.fields.consent)).toHaveTextContent(
      "Not recorded (presented before consent existed)",
    );
    expect(screen.queryByText(/Version 2026/)).toBeNull();
  });

  it("words the legacy label in Spanish", () => {
    renderIntl(<StudentSection student={STUDENT} consent={null} />, "es");

    expect(fact(es.fields.consent)).toHaveTextContent(
      "No registrado (presentada antes de que existiera el consentimiento)",
    );
  });

  it.each([
    ["recorded", RECORDED],
    ["legacy", null],
  ] as const)(
    "carries text only for a %s consent: no alert and no error styling",
    (_name, consent) => {
      renderIntl(<StudentSection student={STUDENT} consent={consent} />);

      const value = fact(en.fields.consent);
      expect(value).toHaveTextContent(/\S/);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(value.className).not.toMatch(/destructive|warning/);
      expect(value.querySelector("[class*='destructive']")).toBeNull();
    },
  );

  it("keeps the other student facts", () => {
    renderIntl(<StudentSection student={STUDENT} consent={RECORDED} />);

    expect(fact(en.fields.name)).toHaveTextContent("Ana Lopez");
    expect(fact(en.fields.cif)).toHaveTextContent("2021-0042");
    expect(fact(en.fields.career)).toHaveTextContent("Ingenieria de Sistemas");
    expect(fact(en.fields.email)).toHaveTextContent("ana@uam.edu.ni");
  });
});
