import { screen, waitFor, within } from "@testing-library/react";
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
    renderIntl(<CauseDatesStep initial={EMPTY} />);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toEqual([
      "Elige la causa de tu ausencia.",
      "Indica la fecha de inicio.",
      "La fecha de fin no puede ser anterior a 30 días antes de hoy.",
    ]);
    expect(push).not.toHaveBeenCalled();
    // Each message is tied to its field for assistive technology.
    expect(end()).toBeInvalid();
    expect(end()).toHaveAccessibleDescription(
      "La fecha de fin no puede ser anterior a 30 días antes de hoy.",
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
