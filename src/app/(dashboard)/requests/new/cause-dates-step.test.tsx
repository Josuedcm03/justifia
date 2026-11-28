import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

const { saveDetailsAction, push } = vi.hoisted(() => ({
  saveDetailsAction: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  saveDetailsAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CauseDatesStep } from "@/app/(dashboard)/requests/new/cause-dates-step";

const EMPTY = { causa: null, fechaInicio: null, fechaFin: null };
const FILLED = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};

beforeEach(() => {
  saveDetailsAction.mockReset();
  push.mockReset();
});

const start = () => screen.getByLabelText("Fecha de inicio");
const end = () => screen.getByLabelText("Fecha de fin");

describe("CauseDatesStep", () => {
  it("offers exactly the five causes, none chosen on an empty draft", () => {
    renderIntl(<CauseDatesStep initial={EMPTY} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Causa y fechas" }),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(
      Array(5).fill("false"),
    );
    expect(
      screen.getByRole("radio", { name: "Intercambio académico" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Maternidad, paternidad o lactancia" }),
    ).toBeInTheDocument();
    expect(start()).toHaveValue("");
    expect(end()).toHaveValue("");
  });

  it("shows the saved values of a resumed draft (D8)", () => {
    renderIntl(<CauseDatesStep initial={FILLED} />);
    expect(screen.getByRole("radio", { name: "Causa médica" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(start()).toHaveValue("2026-10-01");
    expect(end()).toHaveValue("2026-10-03");
  });

  it("saves the chosen values and moves on to the subjects", async () => {
    saveDetailsAction.mockResolvedValue({ ok: true });
    renderIntl(<CauseDatesStep initial={EMPTY} />);

    await userEvent.click(screen.getByRole("radio", { name: "Causa médica" }));
    await userEvent.type(start(), "2026-10-01");
    await userEvent.type(end(), "2026-10-03");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/requests/new?step=2"),
    );
    expect(saveDetailsAction).toHaveBeenCalledWith(FILLED);
  });

  it("returns to the review after saving when opened from it", async () => {
    saveDetailsAction.mockResolvedValue({ ok: true });
    renderIntl(<CauseDatesStep initial={FILLED} fromReview />);

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/requests/new?step=4"),
    );
  });

  it("sends what is there and lets the server say what is missing (RF-03)", async () => {
    saveDetailsAction.mockResolvedValue({ ok: false, errors: [] });
    renderIntl(<CauseDatesStep initial={EMPTY} />);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() =>
      expect(saveDetailsAction).toHaveBeenCalledWith({
        causa: "",
        fechaInicio: "",
        fechaFin: "",
      }),
    );
  });

  it("shows every field error at once, under its own field", async () => {
    saveDetailsAction.mockResolvedValue({
      ok: false,
      errors: [
        { field: "causa", key: "intake.errors.causa_required" },
        { field: "fechaInicio", key: "intake.errors.start_required" },
        { field: "fechaFin", key: "intake.errors.end_too_old" },
      ],
    });
    // The window in force reaches the message (NP-17): 10, not a literal 30.
    renderIntl(
      <CauseDatesStep
        initial={EMPTY}
        limits={{ filingWindowDays: 10, maxDocumentMib: 10 }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toEqual([
      "Elige la causa de tu ausencia.",
      "Indica la fecha de inicio.",
      "La fecha de fin no puede ser anterior a 10 días antes de hoy.",
    ]);
    expect(push).not.toHaveBeenCalled();
    // Each message is tied to its field for assistive technology.
    expect(end()).toBeInvalid();
    expect(end()).toHaveAccessibleDescription(
      "La fecha de fin no puede ser anterior a 10 días antes de hoy.",
    );
    expect(start()).toHaveAccessibleDescription("Indica la fecha de inicio.");
  });

  it("explains an end before the start in English and keeps the dates", async () => {
    saveDetailsAction.mockResolvedValue({
      ok: false,
      errors: [{ field: "fechaFin", key: "intake.errors.end_before_start" }],
    });
    renderIntl(
      <CauseDatesStep
        initial={{
          ...FILLED,
          fechaInicio: "2026-10-10",
          fechaFin: "2026-10-09",
        }}
      />,
      "en",
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The end date cannot be before the start date.",
    );
    expect(screen.getByLabelText("Start date")).toHaveValue("2026-10-10");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-10-09");
  });

  it("reports a form-level failure such as a missing draft", async () => {
    saveDetailsAction.mockResolvedValue({
      ok: false,
      errors: [{ field: "form", key: "intake.errors.no_draft" }],
    });
    renderIntl(<CauseDatesStep initial={FILLED} />);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos tu borrador. Recarga la página para empezar de nuevo.",
    );
  });

  it("clears old errors once a retry succeeds", async () => {
    saveDetailsAction
      .mockResolvedValueOnce({
        ok: false,
        errors: [{ field: "causa", key: "intake.errors.causa_required" }],
      })
      .mockResolvedValueOnce({ ok: true });
    renderIntl(<CauseDatesStep initial={FILLED} />);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("alert");

    const retry = await screen.findByRole("button", { name: "Continuar" });
    await waitFor(() => expect(retry).toBeEnabled());
    await userEvent.click(retry);
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("disables the button while saving", async () => {
    let resolve: (value: { ok: true }) => void = () => {};
    saveDetailsAction.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderIntl(<CauseDatesStep initial={FILLED} />);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const saving = await screen.findByRole("button", { name: "Guardando…" });
    expect(saving).toBeDisabled();
    resolve({ ok: true });
    await waitFor(() => expect(push).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("button", { name: "Guardando…" }),
      ).toBeNull(),
    );
  });
});

describe("CauseDatesStep inside another flow (the correction)", () => {
  const saveDetails = vi.fn();
  const flow = { basePath: "/requests/31/correct", actions: { saveDetails } };

  beforeEach(() => saveDetails.mockReset());

  it("saves through the flow's action and continues under the flow's path", async () => {
    saveDetails.mockResolvedValue({ ok: true });
    renderIntl(<CauseDatesStep initial={FILLED} flow={flow} />);

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/requests/31/correct?step=2"),
    );
    expect(saveDetails).toHaveBeenCalledWith(FILLED);
    expect(saveDetailsAction).not.toHaveBeenCalled();
  });

  it("returns to the flow's review after saving when opened from it", async () => {
    saveDetails.mockResolvedValue({ ok: true });
    renderIntl(<CauseDatesStep initial={FILLED} flow={flow} fromReview />);

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/requests/31/correct?step=4"),
    );
  });

  it("shows the flow action's field errors and stays on the step", async () => {
    saveDetails.mockResolvedValue({
      ok: false,
      errors: [{ field: "fechaFin", key: "intake.errors.end_before_start" }],
    });
    renderIntl(<CauseDatesStep initial={FILLED} flow={flow} />);

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La fecha de fin no puede ser anterior a la de inicio.",
    );
    expect(push).not.toHaveBeenCalled();
  });
});

// FE-19 (RF-01, RF-03): a start date that is still ahead gets a note on this
// step. It is informational: it blocks nothing, is no field error and goes away
// as soon as the start is no longer in the future.
describe("CauseDatesStep: the future-start notice (FE-19)", () => {
  const TODAY = "2026-11-02";
  const FUTURE = {
    causa: "medica",
    fechaInicio: "2026-11-10",
    fechaFin: "2026-11-12",
  };
  const NOTICE =
    "La fecha de inicio es posterior a hoy. Si la ausencia ya ocurrió, corrige las fechas; si es una ausencia prevista, puedes continuar.";
  const notice = () => screen.queryByRole("note");

  it("shows the notice for a saved start after today", () => {
    renderIntl(<CauseDatesStep initial={FUTURE} today={TODAY} />);
    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
  });

  it("says it in English too", () => {
    renderIntl(<CauseDatesStep initial={FUTURE} today={TODAY} />, "en");
    expect(screen.getByRole("note")).toHaveTextContent(
      "The start date is later than today. If the absence already happened, correct the dates; if it is a planned absence, you can continue.",
    );
  });

  it.each([
    ["tomorrow", "2026-11-03", true],
    ["today", "2026-11-02", false],
    ["yesterday", "2026-11-01", false],
  ])(
    "for a saved start %s the notice is shown: %s",
    (_l, fechaInicio, shown) => {
      renderIntl(
        <CauseDatesStep
          initial={{ ...FUTURE, fechaInicio, fechaFin: "2026-11-20" }}
          today={TODAY}
        />,
      );
      expect(notice() !== null).toBe(shown);
    },
  );

  it("shows no notice on an empty draft or when today is not given", () => {
    const { unmount } = renderIntl(
      <CauseDatesStep initial={EMPTY} today={TODAY} />,
    );
    expect(notice()).toBeNull();
    unmount();

    renderIntl(<CauseDatesStep initial={FUTURE} />);
    expect(notice()).toBeNull();
  });

  it("appears when a future start is typed and clears when the start becomes today", () => {
    renderIntl(<CauseDatesStep initial={EMPTY} today={TODAY} />);
    expect(notice()).toBeNull();

    fireEvent.change(start(), { target: { value: "2026-11-10" } });
    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);

    fireEvent.change(start(), { target: { value: "2026-11-02" } });
    expect(notice()).toBeNull();
  });

  it("goes away when the start is cleared", () => {
    renderIntl(<CauseDatesStep initial={FUTURE} today={TODAY} />);
    fireEvent.change(start(), { target: { value: "" } });
    expect(notice()).toBeNull();
  });

  it("follows the start only: changing the end does not move it", () => {
    renderIntl(<CauseDatesStep initial={FUTURE} today={TODAY} />);
    fireEvent.change(end(), { target: { value: "2026-11-30" } });
    expect(notice()).not.toBeNull();
  });

  it("is not an invalid field: no aria-invalid, no alert, not tied to a field", () => {
    renderIntl(<CauseDatesStep initial={FUTURE} today={TODAY} />);
    expect(start()).not.toHaveAttribute("aria-invalid");
    expect(start()).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(notice()?.className).not.toMatch(/destructive/);
  });

  it("disables nothing and still saves the future dates", async () => {
    saveDetailsAction.mockResolvedValue({ ok: true });
    renderIntl(<CauseDatesStep initial={FUTURE} today={TODAY} />);

    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(start()).toBeEnabled();
    expect(end()).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/requests/new?step=2"),
    );
    expect(saveDetailsAction).toHaveBeenCalledWith(FUTURE);
  });

  it("is not among the invalid fields the server reports: the alert lists the cause only", async () => {
    saveDetailsAction.mockResolvedValue({
      ok: false,
      errors: [{ field: "causa", key: "intake.errors.causa_required" }],
    });
    renderIntl(
      <CauseDatesStep initial={{ ...FUTURE, causa: null }} today={TODAY} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Elige la causa de tu ausencia.");
    expect(alert).not.toHaveTextContent(NOTICE);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
    expect(start()).not.toHaveAttribute("aria-invalid");
  });
});
