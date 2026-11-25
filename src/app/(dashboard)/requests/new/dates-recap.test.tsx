import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  DatesRecap,
  FutureStartNotice,
} from "@/app/(dashboard)/requests/new/dates-recap";
import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

// FE-18 and FE-19 (RF-01 a-c): the dates of the absence, written with the
// weekday and the month name, and a notice that never blocks when the start is
// still ahead. Student screen, so the Spanish is in the informal address.

const EDIT = "/requests/new?step=1";
const RANGE = { from: "2026-10-29", to: "2026-10-30" };
const TODAY = "2026-11-02";

const NOTICE_ES =
  "La fecha de inicio es posterior a hoy. Si la ausencia ya ocurrió, corrige las fechas; si es una ausencia prevista, puedes continuar.";
const NOTICE_EN =
  "The start date is later than today. If the absence already happened, correct the dates; if it is a planned absence, you can continue.";

function recap(
  props: Partial<Parameters<typeof DatesRecap>[0]> = {},
  locale: "es" | "en" = "es",
) {
  return renderIntl(
    <DatesRecap range={RANGE} today={TODAY} editHref={EDIT} {...props} />,
    locale,
  );
}

describe("DatesRecap: the dates", () => {
  it("labels the block and writes both dates with weekday and month name (es)", () => {
    recap();
    expect(screen.getByText("Fechas de ausencia")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Del jueves, 29 de octubre de 2026 al viernes, 30 de octubre de 2026",
      ),
    ).toBeInTheDocument();
  });

  it("writes them in English too", () => {
    recap({}, "en");
    expect(screen.getByText("Absence dates")).toBeInTheDocument();
    expect(
      screen.getByText(
        "From Thursday, October 29, 2026 to Friday, October 30, 2026",
      ),
    ).toBeInTheDocument();
  });

  it("shows one date with its weekday when both are the same day", () => {
    recap({ range: { from: "2026-10-29", to: "2026-10-29" } });
    expect(
      screen.getByText("jueves, 29 de octubre de 2026"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Del /)).not.toBeInTheDocument();
  });

  it("shows the single day in English as well", () => {
    recap({ range: { from: "2026-10-29", to: "2026-10-29" } }, "en");
    expect(screen.getByText("Thursday, October 29, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/^From /)).not.toBeInTheDocument();
  });

  describe("with a host time zone far from Managua", () => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it.each(["Pacific/Pago_Pago", "Pacific/Kiritimati", "America/Managua"])(
      "keeps the calendar days as they are in %s",
      (zone) => {
        process.env.TZ = zone;
        recap();
        expect(
          screen.getByText(
            "Del jueves, 29 de octubre de 2026 al viernes, 30 de octubre de 2026",
          ),
        ).toBeInTheDocument();
      },
    );
  });

  it("is read only: no field and no action but the edit link", () => {
    recap();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("lets a long text wrap instead of widening the row", () => {
    recap();
    const range = screen.getByText(/^Del jueves/);
    expect(range).toHaveClass("break-words");
  });
});

describe("DatesRecap: the edit link", () => {
  it("offers 'Editar fechas' to the given href", () => {
    recap({ editHref: "/requests/31/correct?step=1" });
    expect(screen.getByRole("link", { name: "Editar fechas" })).toHaveAttribute(
      "href",
      "/requests/31/correct?step=1",
    );
  });

  it("words the link in English", () => {
    recap({}, "en");
    expect(screen.getByRole("link", { name: "Edit dates" })).toHaveAttribute(
      "href",
      EDIT,
    );
  });

  it("gives the link a 44 px touch target", () => {
    recap();
    expect(screen.getByRole("link", { name: "Editar fechas" })).toHaveClass(
      "min-h-11",
    );
  });
});

describe("DatesRecap: the future-start notice (FE-19)", () => {
  it("shows the notice as a note when the start is after today", () => {
    recap({ range: { from: "2026-11-10", to: "2026-11-12" } });
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(NOTICE_ES);
    expect(screen.getByText("Fechas de ausencia")).toBeInTheDocument();
  });

  it("words the notice in English", () => {
    recap({ range: { from: "2026-11-10", to: "2026-11-12" } }, "en");
    expect(screen.getByRole("note")).toHaveTextContent(NOTICE_EN);
  });

  it.each([
    ["tomorrow", "2026-11-03", true],
    ["today", "2026-11-02", false],
    ["yesterday", "2026-11-01", false],
  ])("for a start %s the notice is shown: %s", (_label, from, shown) => {
    recap({ range: { from, to: "2026-11-20" } });
    expect(screen.queryByRole("note") !== null).toBe(shown);
  });

  it("shows no notice for a past start", () => {
    recap();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("shows no notice when today is not given", () => {
    recap({
      range: { from: "2026-11-10", to: "2026-11-12" },
      today: undefined,
    });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("is informational: no alert role and no error styling", () => {
    recap({ range: { from: "2026-11-10", to: "2026-11-12" } });
    const note = screen.getByRole("note");
    expect(note).not.toHaveAttribute("role", "alert");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(note.className).not.toMatch(/destructive/);
    expect(note).toHaveClass("text-warning-ink");
  });

  it("states the warning in words, not in colour alone", () => {
    recap({ range: { from: "2026-11-10", to: "2026-11-12" } });
    expect(screen.getByRole("note").textContent).toMatch(/posterior a hoy/);
  });

  it("adds no control: the edit link stays the only action", () => {
    recap({ range: { from: "2026-11-10", to: "2026-11-12" } });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("FutureStartNotice", () => {
  it("renders the same note on its own, for the steps that have no recap", () => {
    renderIntl(<FutureStartNotice />);
    expect(screen.getByRole("note")).toHaveTextContent(NOTICE_ES);
  });

  it("lets a long text wrap", () => {
    renderIntl(<FutureStartNotice />);
    expect(screen.getByRole("note")).toHaveClass("break-words");
  });
});
