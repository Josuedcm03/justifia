import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import {
  DocenteActiveToggle,
  EditDocenteForm,
} from "@/app/(dashboard)/catalog/docentes/bound-controls";
import {
  DocenteForm,
  type DocenteFormAction,
} from "@/app/(dashboard)/catalog/docentes/docente-form";
import type { ActiveToggleState, CatalogFormState } from "@/lib/catalog/types";

// The bound controls reach the real actions, which import the database; the
// page does the same through them, so they are replaced for the whole file.
const { updateActionMock, toggleActionMock } = vi.hoisted(() => ({
  updateActionMock: vi.fn(),
  toggleActionMock: vi.fn(),
}));
vi.mock("@/app/(dashboard)/catalog/docentes/actions", () => ({
  updateDocenteAction: updateActionMock,
  setDocenteActivoAction: toggleActionMock,
}));

type Locale = "en" | "es";
const MESSAGES = { en: enMessages, es: esMessages } as const;

const RECORD = {
  id: 7,
  nombreCompleto: "Ana Pérez",
  correo: "ana@uni.edu",
  telefono: "555-0100",
  activo: true,
};

const IDLE: CatalogFormState = { kind: "idle" };

function intl(locale: Locale, children: ReactNode) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      onError={(error) => {
        throw error;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

type FormProps = ComponentProps<typeof DocenteForm>;

function renderForm(
  props: Partial<FormProps> = {},
  locale: Locale = "en",
  action: DocenteFormAction = vi.fn<DocenteFormAction>(async () => IDLE),
) {
  const view = render(
    intl(locale, <DocenteForm action={action} record={RECORD} {...props} />),
  );
  return {
    ...view,
    action: action as ReturnType<typeof vi.fn<DocenteFormAction>>,
  };
}

const copy = (locale: Locale) => MESSAGES[locale].catalog.docentes;
const shared = (locale: Locale) => MESSAGES[locale].catalog.shared;

const nameField = (locale: Locale) =>
  screen.findByRole("textbox", { name: copy(locale).form.nombreLabel });
const emailField = (locale: Locale) =>
  screen.findByRole("textbox", { name: copy(locale).form.correoLabel });
const phoneField = (locale: Locale) =>
  screen.findByRole("textbox", { name: copy(locale).form.telefonoLabel });

async function submit(locale: Locale = "en") {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: copy(locale).form.submitSave }),
  );
}

describe.each(["en", "es"] as const)(
  "DocenteForm fields in %s (DM-3)",
  (locale) => {
    it("draws a text, an email and a tel input, prefilled, with the id hidden", async () => {
      renderForm({}, locale);

      const name = (await nameField(locale)) as HTMLInputElement;
      const email = (await emailField(locale)) as HTMLInputElement;
      const phone = (await phoneField(locale)) as HTMLInputElement;
      expect([name.type, email.type, phone.type]).toEqual([
        "text",
        "email",
        "tel",
      ]);
      expect([name.name, email.name, phone.name]).toEqual([
        "nombreCompleto",
        "correo",
        "telefono",
      ]);
      expect([name.value, email.value, phone.value]).toEqual([
        "Ana Pérez",
        "ana@uni.edu",
        "555-0100",
      ]);
      const id = document.querySelector('input[name="id"]') as HTMLInputElement;
      expect(id.type).toBe("hidden");
      expect(id.value).toBe("7");
      expect(
        screen.getByRole("button", { name: copy(locale).form.submitSave }),
      ).toBeEnabled();
    });

    it("shows a docente without email or phone as empty fields, not as text", async () => {
      renderForm(
        { record: { ...RECORD, correo: null, telefono: null } },
        locale,
      );

      expect(((await emailField(locale)) as HTMLInputElement).value).toBe("");
      expect(((await phoneField(locale)) as HTMLInputElement).value).toBe("");
    });

    it("carries the three notices: where remissions go, the earlier login, and import wins (DM-16)", async () => {
      renderForm({}, locale);

      const c = copy(locale);
      expect(c.form.correoHint).toBeTruthy();
      expect(c.form.correoNote).toBeTruthy();
      expect(await screen.findByText(c.form.correoHint)).toBeVisible();
      expect(await screen.findByText(c.form.correoNote)).toBeVisible();
      expect(await screen.findByText(shared(locale).importWins)).toBeVisible();
      // The email-effect notice is the hint of the email field itself.
      const email = await emailField(locale);
      const hint = screen.getByText(c.form.correoHint);
      expect(email.getAttribute("aria-describedby")).toContain(hint.id);
    });

    it("says in the notices what the spec asks: remissions and sign-in, earlier login and reserved address", () => {
      const c = copy(locale);

      expect(c.form.correoHint).toMatch(
        locale === "es" ? /remisiones/i : /remissions/i,
      );
      expect(c.form.correoHint).toMatch(
        locale === "es" ? /inicia sesión/i : /signs in/i,
      );
      expect(c.form.correoNote).toMatch(locale === "es" ? /Usuarios/ : /Users/);
      expect(c.form.correoNote).toMatch(
        locale === "es" ? /reservad/i : /reserved/i,
      );
      expect(c.form.correoNote).toMatch(
        locale === "es" ? /importaci[oó]n/i : /import/i,
      );
    });
  },
);

describe("DocenteForm submit (DM-3, DM-6)", () => {
  it("submits through onSubmit with the id and the three edited values only", async () => {
    const { action } = renderForm();
    fireEvent.change(await nameField("en"), { target: { value: "Ana M." } });
    fireEvent.change(await emailField("en"), {
      target: { value: "ana.m@uni.edu" },
    });
    fireEvent.change(await phoneField("en"), { target: { value: "" } });
    await submit();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [previous, formData] = action.mock.calls[0];
    expect(previous).toEqual(IDLE);
    expect([...formData.keys()].sort()).toEqual(
      ["correo", "id", "nombreCompleto", "telefono"].sort(),
    );
    expect(formData.get("id")).toBe("7");
    expect(formData.get("nombreCompleto")).toBe("Ana M.");
    expect(formData.get("correo")).toBe("ana.m@uni.edu");
    expect(formData.get("telefono")).toBe("");
    const form = document.querySelector("form") as HTMLFormElement;
    expect(form.hasAttribute("action")).toBe(false);
    expect(form.getAttribute("method")).toBe("post");
  });

  it("draws no control for the login, a password, the role or the state", async () => {
    renderForm();
    await nameField("en");

    const names = [
      ...document.querySelectorAll<HTMLInputElement>("input, select, textarea"),
    ].map((control) => control.name);
    expect(names.sort()).toEqual(
      ["correo", "id", "nombreCompleto", "telefono"].sort(),
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("disables the submit control while the action is pending", async () => {
    let release: () => void = () => {};
    const action = vi.fn<DocenteFormAction>(
      () =>
        new Promise<CatalogFormState>((resolve) => {
          release = () => resolve(IDLE);
        }),
    );
    renderForm({}, "en", action);
    await submit();

    const pending = await screen.findByRole("button", {
      name: copy("en").form.submitting,
    });
    expect((pending as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      release();
    });
    const idle = await screen.findByRole("button", {
      name: copy("en").form.submitSave,
    });
    expect((idle as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("DocenteForm field errors (DM-3, DM-17)", () => {
  const ERRORS = {
    nombreCompleto: shared("en").fieldErrors.nombre.required,
    correo: shared("en").fieldErrors.correo.invalid,
    telefono: shared("en").fieldErrors.telefono.tooLong,
  };

  it("shows every error at once, each tied to its field and announced", async () => {
    renderForm(
      {},
      "en",
      vi.fn<DocenteFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: ERRORS,
      })),
    );
    await submit();

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent).sort()).toEqual(
      Object.values(ERRORS).sort(),
    );
    const controls: [string, HTMLElement][] = [
      [ERRORS.nombreCompleto, await nameField("en")],
      [ERRORS.correo, await emailField("en")],
      [ERRORS.telefono, await phoneField("en")],
    ];
    for (const [message, control] of controls) {
      const alert = screen.getByText(message);
      expect(alert.getAttribute("role")).toBe("alert");
      expect(control.getAttribute("aria-invalid")).toBe("true");
      expect(control.getAttribute("aria-describedby")).toContain(alert.id);
    }
  });

  it("keeps every typed value after an invalid answer", async () => {
    renderForm(
      {},
      "en",
      vi.fn<DocenteFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: { correo: ERRORS.correo },
      })),
    );
    fireEvent.change(await nameField("en"), { target: { value: "Ana M." } });
    fireEvent.change(await emailField("en"), { target: { value: "ana@" } });
    fireEvent.change(await phoneField("en"), { target: { value: "555-0199" } });
    await submit();

    await screen.findByText(ERRORS.correo);
    expect(((await nameField("en")) as HTMLInputElement).value).toBe("Ana M.");
    expect(((await emailField("en")) as HTMLInputElement).value).toBe("ana@");
    expect(((await phoneField("en")) as HTMLInputElement).value).toBe(
      "555-0199",
    );
  });

  it("keeps the email hint tied to the field next to its error", async () => {
    renderForm(
      {},
      "en",
      vi.fn<DocenteFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: { correo: ERRORS.correo },
      })),
    );
    await submit();

    const alert = await screen.findByText(ERRORS.correo);
    const hint = screen.getByText(copy("en").form.correoHint);
    const describedBy = (await emailField("en")).getAttribute(
      "aria-describedby",
    );
    expect(describedBy).toContain(hint.id);
    expect(describedBy).toContain(alert.id);
  });

  it("shows an error for a field the form does not draw, as text", async () => {
    renderForm(
      {},
      "en",
      vi.fn<DocenteFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: { carreraId: "Select a Carrera from the list" },
      })),
    );
    await submit();

    expect(
      await screen.findByText("Select a Carrera from the list"),
    ).toBeVisible();
  });
});

describe.each(["en", "es"] as const)(
  "DocenteForm answers in %s (DM-6, DM-16)",
  (locale) => {
    const ANSWERS: {
      name: string;
      state: CatalogFormState;
      text: string;
      canSubmit: boolean;
      locked: boolean;
    }[] = [
      {
        name: "unchanged",
        state: { kind: "unchanged" },
        text: shared(locale).refusals.unchanged,
        canSubmit: true,
        locked: false,
      },
      {
        name: "error",
        state: { kind: "error", message: "Could not be saved" },
        text: "Could not be saved",
        canSubmit: true,
        locked: false,
      },
      {
        name: "busy",
        state: { kind: "busy" },
        text: shared(locale).busy,
        canSubmit: true,
        locked: false,
      },
      {
        name: "gone",
        state: { kind: "gone" },
        text: shared(locale).notFound.title,
        canSubmit: false,
        locked: false,
      },
      {
        name: "inactive",
        state: { kind: "inactive" },
        text: shared(locale).refusals.inactive,
        canSubmit: false,
        locked: true,
      },
    ];

    it.each(ANSWERS.map((answer) => [answer.name, answer] as const))(
      "renders the %s answer as text in the polite live region",
      async (_name, answer) => {
        renderForm(
          {},
          locale,
          vi.fn<DocenteFormAction>(async () => answer.state),
        );
        await submit(locale);

        const region = await screen.findByRole("status");
        await waitFor(() => expect(region.textContent).toContain(answer.text));
        expect(region.getAttribute("aria-live")).toBe("polite");
        await waitFor(() =>
          expect(
            screen.queryByRole("button", {
              name: copy(locale).form.submitSave,
            }) !== null,
          ).toBe(answer.canSubmit),
        );
        expect(((await nameField(locale)) as HTMLInputElement).readOnly).toBe(
          answer.locked,
        );
        expect(((await emailField(locale)) as HTMLInputElement).readOnly).toBe(
          answer.locked,
        );
        expect(((await phoneField(locale)) as HTMLInputElement).readOnly).toBe(
          answer.locked,
        );
      },
    );

    it("mounts the live region from the start, empty, so an answer is announced", async () => {
      renderForm({}, locale);

      const region = await screen.findByRole("status");
      expect(region.getAttribute("aria-live")).toBe("polite");
      expect(region.textContent).toBe("");
    });
  },
);

describe("DocenteForm busy retry", () => {
  it("keeps the submit control available for a retry after busy", async () => {
    const action = vi
      .fn<DocenteFormAction>()
      .mockResolvedValueOnce({ kind: "busy" })
      .mockResolvedValueOnce(IDLE);
    renderForm({}, "en", action);

    await submit();
    await screen.findByText(shared("en").busy);
    await submit();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText(shared("en").busy)).toBeNull(),
    );
  });
});

describe("DocenteForm inactive docente (DM-6)", () => {
  it("is read-only, offers no submit and shows the reactivate hint in its place", async () => {
    renderForm({
      record: { ...RECORD, activo: false },
      reactivate: <p>Reactivate hint stub</p>,
    });

    expect(
      await screen.findByText(shared("en").refusals.inactive),
    ).toBeVisible();
    for (const field of [
      await nameField("en"),
      await emailField("en"),
      await phoneField("en"),
    ]) {
      expect((field as HTMLInputElement).readOnly).toBe(true);
    }
    expect(
      screen.queryByRole("button", { name: copy("en").form.submitSave }),
    ).toBeNull();
    expect(screen.getByText("Reactivate hint stub")).toBeVisible();
  });

  it("does not render the reactivate node for an active docente", async () => {
    renderForm({ reactivate: <p>Reactivate hint stub</p> });

    await screen.findByRole("button", { name: copy("en").form.submitSave });
    expect(screen.queryByText("Reactivate hint stub")).toBeNull();
  });

  it("never submits while locked, whatever is typed", async () => {
    const { action } = renderForm({ record: { ...RECORD, activo: false } });

    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    expect(action).not.toHaveBeenCalled();
  });
});

describe("DocenteForm narrow width (DM-17: 360 px single column, 320 px nothing clipped)", () => {
  it("is one column capped at max-w-xl, with a wrapping action row", async () => {
    renderForm();
    await nameField("en");

    const form = document.querySelector("form") as HTMLFormElement;
    expect(form).toHaveClass("flex", "flex-col", "w-full", "max-w-xl");
    expect(form.className).not.toMatch(/\bgrid\b|\bcols-|\bw-\[|\bmin-w-\[/);
    const row = screen
      .getByRole("button", { name: copy("en").form.submitSave })
      .closest("div");
    expect(row).toHaveClass("flex-wrap");
  });

  it("lets an answer break inside a narrow screen", async () => {
    renderForm(
      {},
      "en",
      vi.fn<DocenteFormAction>(async () => ({ kind: "busy" })),
    );
    await submit();

    expect(await screen.findByText(shared("en").busy)).toHaveClass(
      "break-words",
    );
  });
});

describe("EditDocenteForm (bound control, keyed by the state)", () => {
  beforeEach(() => {
    updateActionMock.mockReset();
    updateActionMock.mockResolvedValue(IDLE);
  });

  it("binds the update action and sends the id and the edited values", async () => {
    render(intl("en", <EditDocenteForm record={RECORD} />));
    fireEvent.change(await nameField("en"), { target: { value: "Ana M." } });
    await submit();

    await waitFor(() => expect(updateActionMock).toHaveBeenCalledTimes(1));
    const formData = updateActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("7");
    expect(formData.get("nombreCompleto")).toBe("Ana M.");
  });

  it("starts from a clean form when the state flips, so a refused edit does not stay locked after a reactivation", async () => {
    updateActionMock.mockResolvedValue({ kind: "inactive" });
    const view = render(intl("en", <EditDocenteForm record={RECORD} />));
    await submit();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: copy("en").form.submitSave }),
      ).toBeNull(),
    );

    // The page re-renders: the docente is inactive, then reactivated.
    view.rerender(
      intl("en", <EditDocenteForm record={{ ...RECORD, activo: false }} />),
    );
    view.rerender(intl("en", <EditDocenteForm record={RECORD} />));

    expect(
      await screen.findByRole("button", { name: copy("en").form.submitSave }),
    ).toBeEnabled();
    expect(((await nameField("en")) as HTMLInputElement).readOnly).toBe(false);
  });
});

type ToggleProps = ComponentProps<typeof DocenteActiveToggle>;

const TOGGLE: ToggleProps = {
  id: 7,
  nombreCompleto: "Ana Pérez",
  correo: "ana@uni.edu",
  activo: true,
  gruposActivos: 3,
};

function renderToggle(props: Partial<ToggleProps> = {}, locale: Locale = "en") {
  return render(intl(locale, <DocenteActiveToggle {...TOGGLE} {...props} />));
}

describe.each(["en", "es"] as const)(
  "DocenteActiveToggle confirmation in %s (DM-7, DM-8)",
  (locale) => {
    const s = shared(locale);
    const c = copy(locale);

    beforeEach(() => {
      toggleActionMock.mockReset();
      toggleActionMock.mockResolvedValue({ kind: "idle" });
    });

    it("names the docente with the email in parentheses, deletes nothing, keeps grupos and remissions and shows the count", async () => {
      renderToggle({}, locale);
      const user = userEvent.setup();

      await user.click(
        await screen.findByRole("button", { name: s.toggle.deactivate }),
      );

      const group = await screen.findByRole("group");
      expect(group).toHaveTextContent("Ana Pérez (ana@uni.edu)");
      expect(group).toHaveTextContent(s.toggle.nothingDeleted);
      expect(group).toHaveTextContent(c.state.kept);
      expect(group).toHaveTextContent(
        locale === "es" ? "3 grupos activos" : "3 active groups",
      );
      expect(toggleActionMock).not.toHaveBeenCalled();
    });

    it("says the grupos and remissions are kept in words", () => {
      expect(c.state.kept).toMatch(
        locale === "es" ? /grupos.*remisiones/i : /groups.*remissions/i,
      );
    });

    it("names the docente alone when there is no email", async () => {
      renderToggle({ correo: null }, locale);
      const user = userEvent.setup();

      await user.click(
        await screen.findByRole("button", { name: s.toggle.deactivate }),
      );

      const title = (await screen.findByRole("group")).querySelector("p");
      expect(title).toHaveTextContent(
        s.toggle.confirmTitle.replace("{record}", "Ana Pérez"),
      );
      expect(title?.textContent).not.toContain("(");
    });

    it.each([
      [0, /^$/],
      [1, locale === "es" ? /1 grupo activo/ : /1 active group\b/],
      [4, locale === "es" ? /4 grupos activos/ : /4 active groups/],
    ] as const)("shows the count %i the page read", async (count, expected) => {
      renderToggle({ gruposActivos: count }, locale);
      const user = userEvent.setup();

      await user.click(
        await screen.findByRole("button", { name: s.toggle.deactivate }),
      );

      const group = await screen.findByRole("group");
      if (count === 0) {
        expect(group).toHaveTextContent(
          locale === "es" ? "no tiene grupos activos" : "has no active groups",
        );
        expect(group.textContent).not.toMatch(/\d/);
      } else {
        expect(group.textContent).toMatch(expected);
      }
    });

    it("cancel changes nothing, writes nothing and returns the focus to the first step", async () => {
      renderToggle({}, locale);
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", { name: s.toggle.deactivate }),
      );

      await user.click(
        await screen.findByRole("button", { name: s.toggle.cancel }),
      );

      expect(toggleActionMock).not.toHaveBeenCalled();
      expect(screen.queryByRole("group")).toBeNull();
      const first = await screen.findByRole("button", {
        name: s.toggle.deactivate,
      });
      await waitFor(() => expect(first).toHaveFocus());
      expect(screen.getByText(s.status.active)).toBeVisible();
    });

    it("confirming sends the id and the deactivate intent", async () => {
      renderToggle({}, locale);
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", { name: s.toggle.deactivate }),
      );

      await user.click(
        await screen.findByRole("button", { name: s.toggle.confirm }),
      );

      await waitFor(() => expect(toggleActionMock).toHaveBeenCalledTimes(1));
      const formData = toggleActionMock.mock.calls[0][1] as FormData;
      expect(formData.get("id")).toBe("7");
      expect(formData.get("intent")).toBe("deactivate");
    });

    it("an inactive docente is reactivated in one press, with no confirmation", async () => {
      renderToggle({ activo: false }, locale);
      const user = userEvent.setup();

      expect(await screen.findByText(s.status.inactive)).toBeVisible();
      await user.click(
        await screen.findByRole("button", { name: s.toggle.reactivate }),
      );

      await waitFor(() => expect(toggleActionMock).toHaveBeenCalledTimes(1));
      const formData = toggleActionMock.mock.calls[0][1] as FormData;
      expect(formData.get("id")).toBe("7");
      expect(formData.get("intent")).toBe("reactivate");
      expect(screen.queryByRole("group")).toBeNull();
    });

    it("shows the server refusal text, such as the active-grupos count", async () => {
      const message = "Cannot deactivate: this teacher has 3 active groups.";
      toggleActionMock.mockResolvedValue({ kind: "error", message });
      renderToggle({}, locale);
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", { name: s.toggle.deactivate }),
      );
      await user.click(
        await screen.findByRole("button", { name: s.toggle.confirm }),
      );

      const region = await screen.findByRole("status");
      await waitFor(() => expect(region.textContent).toContain(message));
    });
  },
);

describe.each(["en", "es"] as const)(
  "DocenteActiveToggle already-in-state answers in %s (DM-7, DM-9, DM-16)",
  (locale) => {
    const s = shared(locale);
    const c = copy(locale);

    beforeEach(() => {
      toggleActionMock.mockReset();
      toggleActionMock.mockResolvedValue({
        kind: "unchanged",
      } satisfies ActiveToggleState);
    });

    it("says the docente was already inactive after a deactivate that changed nothing", async () => {
      renderToggle({}, locale);
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", { name: s.toggle.deactivate }),
      );
      await user.click(
        await screen.findByRole("button", { name: s.toggle.confirm }),
      );

      const region = await screen.findByRole("status");
      await waitFor(() =>
        expect(region.textContent).toContain(c.state.alreadyInactive),
      );
      expect(region.textContent).not.toContain(c.state.alreadyActive);
      expect(region.textContent).not.toContain(s.refusals.unchanged);
    });

    it("says the docente was already active after a reactivate that changed nothing", async () => {
      renderToggle({ activo: false }, locale);
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", { name: s.toggle.reactivate }),
      );

      const region = await screen.findByRole("status");
      await waitFor(() =>
        expect(region.textContent).toContain(c.state.alreadyActive),
      );
      expect(region.textContent).not.toContain(c.state.alreadyInactive);
      expect(region.textContent).not.toContain(s.refusals.unchanged);
    });

    it("states it in words: already active, already inactive", () => {
      expect(c.state.alreadyActive).toMatch(
        locale === "es" ? /ya estaba activo/i : /already active/i,
      );
      expect(c.state.alreadyInactive).toMatch(
        locale === "es" ? /ya estaba inactivo/i : /already inactive/i,
      );
    });
  },
);

describe("DocenteActiveToggle narrow width (DM-17)", () => {
  it("lets a long name and email break inside the confirmation", async () => {
    renderToggle({
      nombreCompleto: "Maria de los Angeles Fernandez-Villanueva y Altamirano",
      correo:
        "maria.de.los.angeles.fernandez.villanueva.altamirano@universidad.example.test",
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: shared("en").toggle.deactivate,
      }),
    );

    const group = await screen.findByRole("group");
    const paragraphs = [...group.querySelectorAll("p")];
    // The title (name and email), the nothing-deleted line and the notice.
    expect(paragraphs).toHaveLength(3);
    for (const paragraph of paragraphs) {
      expect(paragraph).toHaveClass("break-words");
    }
    const row = screen.getByText(shared("en").status.active).parentElement;
    expect(row).toHaveClass("flex-wrap");
  });
});
