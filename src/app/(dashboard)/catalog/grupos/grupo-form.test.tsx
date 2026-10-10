import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import {
  GrupoForm,
  type GrupoFormAction,
} from "@/app/(dashboard)/catalog/grupos/grupo-form";
import { DIAS_SEMANA } from "@/lib/catalog/dias";
import type { CatalogFormState } from "@/lib/catalog/types";

const MESSAGES = { en: enMessages, es: esMessages } as const;

const TEXT = {
  en: {
    asignatura: "Subject",
    docente: "Teacher",
    periodo: "Period",
    numero: "Group number",
    dias: "Days of the week",
    periodoHint: "Use the format YYYY-S1 or YYYY-S2, for example 2026-S1.",
    diasHint: "Select at least one day.",
    keyHint:
      "The subject, period and group number cannot be changed after the group is created.",
    truncated:
      "Only the first options are listed. If you cannot find what you need, ask whoever administers the system.",
    create: "Create group",
    save: "Save changes",
    saving: "Saving…",
  },
  es: {
    asignatura: "Asignatura",
    docente: "Docente",
    periodo: "Periodo",
    numero: "Número de grupo",
    dias: "Días de la semana",
    periodoHint: "Usa el formato AAAA-S1 o AAAA-S2, por ejemplo 2026-S1.",
    diasHint: "Selecciona al menos un día.",
    keyHint:
      "La asignatura, el periodo y el número de grupo no se pueden cambiar después de crear el grupo.",
    truncated:
      "Solo se muestran las primeras opciones. Si no encuentras lo que buscas, consulta a quien administra el sistema.",
    create: "Crear grupo",
    save: "Guardar cambios",
    saving: "Guardando…",
  },
} as const;

type Locale = keyof typeof TEXT;
type FormProps = ComponentProps<typeof GrupoForm>;

const ASIGNATURAS = [
  { id: 1, codigo: "MAT101", nombre: "Algebra" },
  { id: 2, codigo: "FIS200", nombre: "Fisica" },
];
const DOCENTES = [
  { id: 7, nombreCompleto: "Ana Ruiz" },
  { id: 8, nombreCompleto: "Luis Mora" },
];
const RECORD = {
  id: 3,
  asignaturaCodigo: "MAT101",
  asignaturaNombre: "Algebra",
  periodo: "2026-S1",
  numeroGrupo: "A",
  docenteId: 8,
  docenteNombre: "Luis Mora",
  activo: true,
  dias: ["lunes", "jueves"] as const,
};

const IDLE: CatalogFormState = { kind: "idle" };
const dayName = (locale: Locale, dia: (typeof DIAS_SEMANA)[number]) =>
  MESSAGES[locale].catalog.shared.dias.long[dia];

function renderForm(
  props: Partial<FormProps> = {},
  locale: Locale = "en",
  action: GrupoFormAction = vi.fn<GrupoFormAction>(async () => IDLE),
) {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      onError={(error) => {
        throw error;
      }}
    >
      <GrupoForm
        action={action}
        asignaturas={ASIGNATURAS}
        docentes={DOCENTES}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { action: action as ReturnType<typeof vi.fn<GrupoFormAction>> };
}

const combo = (name: string) => screen.findByRole("combobox", { name });
const text = (name: string) => screen.findByRole("textbox", { name });
const day = (name: string) => screen.findByRole("checkbox", { name });

/** Opens a combobox and chooses an option; the popup hides the rest of the
 *  page while open, so every query of another control comes after this. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  option: string,
) {
  await user.click(input);
  await user.click(await screen.findByRole("option", { name: option }));
}

async function checkedDays() {
  const boxes = (await screen.findAllByRole("checkbox")) as HTMLInputElement[];
  return boxes.filter((box) => box.checked).map((box) => box.value);
}

async function fillAll() {
  const user = userEvent.setup();
  const asignatura = await combo(TEXT.en.asignatura);
  const docente = await combo(TEXT.en.docente);
  fireEvent.change(await text(TEXT.en.periodo), {
    target: { value: "2026-S2" },
  });
  fireEvent.change(await text(TEXT.en.numero), { target: { value: "B" } });
  await choose(user, asignatura, "FIS200 - Fisica");
  await choose(user, docente, "Ana Ruiz");
  await user.click(await day("Wednesday"));
  await user.click(await day("Monday"));
  return user;
}

async function submit(label: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: label }));
}

describe("GrupoForm create mode (CM-GRP-1, CM-GRP-6)", () => {
  it.each(["en", "es"] as const)(
    "renders the key fields and the seven days, none checked, in %s",
    async (locale) => {
      const t = TEXT[locale];
      renderForm({}, locale);

      const asignatura = await combo(t.asignatura);
      expect(asignatura).toHaveValue("");
      expect(await combo(t.docente)).toHaveValue("");
      expect(await text(t.periodo)).toHaveAttribute("name", "periodo");
      expect(await text(t.numero)).toHaveAttribute("name", "numeroGrupo");
      expect(await screen.findByText(t.periodoHint)).toBeTruthy();
      expect(document.querySelector('input[name="id"]')).toBeNull();
      expect(screen.queryByText(t.keyHint)).toBeNull();
      expect(
        await screen.findByRole("button", { name: t.create }),
      ).toBeTruthy();

      const group = await screen.findByRole("group", { name: t.dias });
      expect(group.tagName).toBe("FIELDSET");
      expect(await screen.findByText(t.diasHint)).toBeTruthy();
      const boxes = (await screen.findAllByRole(
        "checkbox",
      )) as HTMLInputElement[];
      expect(boxes.map((box) => box.value)).toEqual([...DIAS_SEMANA]);
      expect(boxes.every((box) => box.name === "dias" && !box.checked)).toBe(
        true,
      );
      expect(
        await Promise.all(DIAS_SEMANA.map((d) => day(dayName(locale, d)))),
      ).toEqual(boxes);
      expect(document.querySelector('label[for="dias"]')).toBeNull();
    },
  );

  it("offers exactly the options it was given", async () => {
    renderForm();
    const user = userEvent.setup();

    const docente = await combo(TEXT.en.docente);
    await user.click(await combo(TEXT.en.asignatura));
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["MAT101 - Algebra", "FIS200 - Fisica"]);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryAllByRole("option")).toHaveLength(0),
    );

    await user.click(docente);
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["Ana Ruiz", "Luis Mora"]);
  });

  it("shows the cap note only for a list that was cut", async () => {
    renderForm({ docentesTruncated: true });

    expect(await screen.findAllByText(TEXT.en.truncated)).toHaveLength(1);
    expect(await combo(TEXT.en.docente)).toHaveAccessibleDescription(
      TEXT.en.truncated,
    );
    expect(await combo(TEXT.en.asignatura)).not.toHaveAccessibleDescription(
      TEXT.en.truncated,
    );
  });

  it("submits ids, the typed values and the checked day codes", async () => {
    const { action } = renderForm();
    await fillAll();
    await submit(TEXT.en.create);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [previous, formData] = action.mock.calls[0];
    expect(previous).toEqual(IDLE);
    expect(formData.get("asignaturaId")).toBe("2");
    expect(formData.get("docenteId")).toBe("7");
    expect(formData.get("periodo")).toBe("2026-S2");
    expect(formData.get("numeroGrupo")).toBe("B");
    expect(formData.getAll("dias")).toEqual(["lunes", "miercoles"]);
    expect(formData.has("id")).toBe(false);
    const form = document.querySelector("form") as HTMLFormElement;
    expect(form.hasAttribute("action")).toBe(false);
    expect(form.getAttribute("method")).toBe("post");
  });
});

describe("GrupoForm preselected Asignatura (CM-GRP-8, A-GRP8-OPTIONS)", () => {
  const invalidAction = () =>
    vi.fn<GrupoFormAction>(async () => ({
      kind: "invalid",
      fieldErrors: { periodo: "The period must use the format YYYY-S1" },
    }));

  it.each(["en", "es"] as const)(
    "shows the option selected and submits its id, in %s",
    async (locale) => {
      const { action } = renderForm({ defaultAsignaturaId: 2 }, locale);

      expect(await combo(TEXT[locale].asignatura)).toHaveValue(
        "FIS200 - Fisica",
      );
      await submit(TEXT[locale].create);
      await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
      expect(action.mock.calls[0][1].get("asignaturaId")).toBe("2");
    },
  );

  it("is ignored when the id is not among the options", async () => {
    const { action } = renderForm({ defaultAsignaturaId: 99 });

    expect(await combo(TEXT.en.asignatura)).toHaveValue("");
    await submit(TEXT.en.create);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].get("asignaturaId")).toBe("");
  });

  it("leaves the field enabled and editable", async () => {
    const { action } = renderForm({ defaultAsignaturaId: 2 });
    const user = userEvent.setup();

    const asignatura = await combo(TEXT.en.asignatura);
    expect(asignatura).toBeEnabled();
    await choose(user, asignatura, "MAT101 - Algebra");
    expect(await combo(TEXT.en.asignatura)).toHaveValue("MAT101 - Algebra");
    await submit(TEXT.en.create);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].get("asignaturaId")).toBe("1");
  });

  it("keeps an untouched preselection after an invalid answer and resubmits it", async () => {
    const { action } = renderForm(
      { defaultAsignaturaId: 2 },
      "en",
      invalidAction(),
    );
    await submit(TEXT.en.create);
    await screen.findByText("The period must use the format YYYY-S1");

    expect(await combo(TEXT.en.asignatura)).toHaveValue("FIS200 - Fisica");
    await submit(TEXT.en.create);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1][1].get("asignaturaId")).toBe("2");
  });

  it("keeps a changed selection after an invalid answer, not the preselection", async () => {
    const { action } = renderForm(
      { defaultAsignaturaId: 2 },
      "en",
      invalidAction(),
    );
    const user = userEvent.setup();
    await choose(user, await combo(TEXT.en.asignatura), "MAT101 - Algebra");
    await submit(TEXT.en.create);
    await screen.findByText("The period must use the format YYYY-S1");

    expect(await combo(TEXT.en.asignatura)).toHaveValue("MAT101 - Algebra");
    await submit(TEXT.en.create);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1][1].get("asignaturaId")).toBe("1");
  });

  it("is ignored in edit mode", async () => {
    const { action } = renderForm({
      record: RECORD,
      defaultAsignaturaId: 2,
    });

    expect(await screen.findByText("MAT101 - Algebra")).toBeTruthy();
    expect(
      screen.queryByRole("combobox", { name: TEXT.en.asignatura }),
    ).toBeNull();
    await submit(TEXT.en.save);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].has("asignaturaId")).toBe(false);
  });
});

describe("GrupoForm edit mode (CM-GRP-2, CEI-PREC)", () => {
  it.each(["en", "es"] as const)(
    "shows the key as text, prefills the docente and the days, in %s",
    async (locale) => {
      const t = TEXT[locale];
      renderForm({ record: RECORD }, locale);

      expect(await screen.findByText("MAT101 - Algebra")).toBeTruthy();
      expect(await screen.findByText("2026-S1")).toBeTruthy();
      expect(await screen.findByText("A")).toBeTruthy();
      expect(await screen.findByText(t.keyHint)).toBeTruthy();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByRole("combobox", { name: t.asignatura })).toBeNull();
      for (const name of ["asignaturaId", "periodo", "numeroGrupo"]) {
        expect(document.querySelector(`[name="${name}"]`)).toBeNull();
      }
      const hidden = document.querySelector('input[name="id"]');
      expect(hidden).toHaveAttribute("type", "hidden");
      expect(hidden).toHaveValue("3");
      expect(await combo(t.docente)).toHaveValue("Luis Mora");
      expect(await checkedDays()).toEqual(["lunes", "jueves"]);
      expect(
        await screen.findByText(MESSAGES[locale].catalog.shared.importWins),
      ).toBeTruthy();
      expect(await screen.findByRole("button", { name: t.save })).toBeTruthy();
    },
  );

  it("submits the id, the docente and the days, and no key field", async () => {
    const { action } = renderForm({ record: RECORD });
    const user = userEvent.setup();
    await choose(user, await combo(TEXT.en.docente), "Ana Ruiz");
    await user.click(await day("Monday"));
    await user.click(await day("Tuesday"));
    await submit(TEXT.en.save);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("id")).toBe("3");
    expect(formData.get("docenteId")).toBe("7");
    expect(formData.getAll("dias")).toEqual(["martes", "jueves"]);
    for (const name of ["asignaturaId", "periodo", "numeroGrupo"]) {
      expect(formData.has(name)).toBe(false);
    }
  });

  it("opens a group stored without days with none checked and no error", async () => {
    renderForm({ record: { ...RECORD, dias: [] } });

    expect(await combo(TEXT.en.docente)).toHaveValue("Luis Mora");
    expect(await checkedDays()).toEqual([]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refuses to save it without a day and says so under the group", async () => {
    const message =
      "Select at least one day of the week on which the group meets";
    renderForm(
      { record: { ...RECORD, dias: [] } },
      "en",
      vi.fn<GrupoFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: { dias: message },
      })),
    );
    await submit(TEXT.en.save);

    const alert = await screen.findByText(message);
    const group = await screen.findByRole("group", { name: TEXT.en.dias });
    expect(alert).toHaveAttribute("role", "alert");
    expect(group).toContainElement(alert);
    expect(group.getAttribute("aria-describedby")).toContain(alert.id);
    expect(group).toHaveAccessibleDescription(`${TEXT.en.diasHint} ${message}`);
  });
});

describe("GrupoForm current docente missing from the options (CM-GRP-2)", () => {
  const ABSENT = {
    ...RECORD,
    docenteId: 99,
    docenteNombre: "Rosa Vega",
  };

  it("prefills the stored name and offers it as an extra option", async () => {
    renderForm({ record: ABSENT });
    const user = userEvent.setup();

    const docente = await combo(TEXT.en.docente);
    expect(docente).toHaveValue("Rosa Vega");
    await user.click(docente);
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["Ana Ruiz", "Luis Mora", "Rosa Vega"]);
  });

  it("submits the original docenteId when only the days change", async () => {
    const { action } = renderForm({ record: ABSENT });
    const user = userEvent.setup();
    await user.click(await day("Tuesday"));
    await submit(TEXT.en.save);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("docenteId")).toBe("99");
    expect(formData.getAll("dias")).toEqual(["lunes", "martes", "jueves"]);
  });

  it("adds no extra option when the docente is already listed", async () => {
    renderForm({ record: RECORD });
    const user = userEvent.setup();

    await user.click(await combo(TEXT.en.docente));
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["Ana Ruiz", "Luis Mora"]);
  });
});

describe("GrupoForm keeps the user's values after an invalid answer", () => {
  async function submitInvalid() {
    const { action } = renderForm(
      {},
      "en",
      vi.fn<GrupoFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: { periodo: "The period must use the format YYYY-S1" },
      })),
    );
    await fillAll();
    await submit(TEXT.en.create);
    await screen.findByText("The period must use the format YYYY-S1");
    return action;
  }

  it("keeps the typed text", async () => {
    await submitInvalid();

    expect(await text(TEXT.en.periodo)).toHaveValue("2026-S2");
    expect(await text(TEXT.en.numero)).toHaveValue("B");
  });

  it("keeps both combobox selections", async () => {
    const action = await submitInvalid();

    expect(await combo(TEXT.en.asignatura)).toHaveValue("FIS200 - Fisica");
    expect(await combo(TEXT.en.docente)).toHaveValue("Ana Ruiz");
    await submit(TEXT.en.create);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    const formData = action.mock.calls[1][1];
    expect(formData.get("asignaturaId")).toBe("2");
    expect(formData.get("docenteId")).toBe("7");
  });

  it("keeps the checked days", async () => {
    await submitInvalid();

    expect(await checkedDays()).toEqual(["lunes", "miercoles"]);
  });
});

describe("GrupoForm field errors (CM-NFR-3)", () => {
  const FIELD_ERRORS = {
    asignaturaId: "Select a subject",
    periodo: "The period is required",
    numeroGrupo: "The group number is required",
    docenteId: "Select a teacher",
    dias: "Select at least one day of the week on which the group meets",
  };

  it("shows each error under its control, announced and linked", async () => {
    renderForm(
      {},
      "en",
      vi.fn<GrupoFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: FIELD_ERRORS,
      })),
    );
    await submit(TEXT.en.create);

    const controls: [string, HTMLElement][] = [
      [FIELD_ERRORS.asignaturaId, await combo(TEXT.en.asignatura)],
      [FIELD_ERRORS.periodo, await text(TEXT.en.periodo)],
      [FIELD_ERRORS.numeroGrupo, await text(TEXT.en.numero)],
      [FIELD_ERRORS.docenteId, await combo(TEXT.en.docente)],
    ];
    for (const [message, control] of controls) {
      const alert = await screen.findByText(message);
      expect(alert).toHaveAttribute("role", "alert");
      expect(control).toHaveAttribute("aria-invalid", "true");
      expect(control.getAttribute("aria-describedby")).toContain(alert.id);
    }
    expect(await screen.findByText(FIELD_ERRORS.dias)).toHaveAttribute(
      "role",
      "alert",
    );
  });

  it("shows an error for a field it does not draw, as text", async () => {
    renderForm(
      { record: RECORD },
      "en",
      vi.fn<GrupoFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: { asignaturaId: FIELD_ERRORS.asignaturaId },
      })),
    );
    await submit(TEXT.en.save);

    const region = await screen.findByRole("status");
    await waitFor(() =>
      expect(region).toHaveTextContent(FIELD_ERRORS.asignaturaId),
    );
  });
});

describe("GrupoForm answers (CM-GRP-2, CM-NFR-3, CM-NFR-4)", () => {
  const ANSWERS: {
    name: string;
    state: CatalogFormState;
    text: (locale: Locale) => string;
    canSubmit: boolean;
    locked: boolean;
  }[] = [
    {
      name: "unchanged",
      state: { kind: "unchanged" },
      text: (l) => MESSAGES[l].catalog.shared.refusals.unchanged,
      canSubmit: true,
      locked: false,
    },
    {
      name: "error",
      state: { kind: "error", message: "Group already exists" },
      text: () => "Group already exists",
      canSubmit: true,
      locked: false,
    },
    {
      name: "busy",
      state: { kind: "busy" },
      text: (l) => MESSAGES[l].catalog.shared.busy,
      canSubmit: true,
      locked: false,
    },
    {
      name: "gone",
      state: { kind: "gone" },
      text: (l) => MESSAGES[l].catalog.shared.notFound.title,
      canSubmit: false,
      locked: false,
    },
    {
      name: "inactive",
      state: { kind: "inactive" },
      text: (l) => MESSAGES[l].catalog.shared.refusals.inactive,
      canSubmit: false,
      locked: true,
    },
  ];

  it.each(
    (["en", "es"] as const).flatMap((locale) =>
      ANSWERS.map((answer) => [locale, answer.name, answer] as const),
    ),
  )("renders the %s %s answer as text", async (locale, _name, answer) => {
    const t = TEXT[locale];
    renderForm(
      { record: RECORD },
      locale,
      vi.fn<GrupoFormAction>(async () => answer.state),
    );
    await submit(t.save);

    const region = await screen.findByRole("status");
    await waitFor(() =>
      expect(region).toHaveTextContent(answer.text(locale), {
        normalizeWhitespace: true,
      }),
    );
    expect(region).toHaveAttribute("aria-live", "polite");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: t.save }) !== null).toBe(
        answer.canSubmit,
      ),
    );
    if (answer.locked) {
      expect(await combo(t.docente)).toBeDisabled();
      for (const box of await screen.findAllByRole("checkbox")) {
        expect(box).toBeDisabled();
      }
    }
  });

  it("keeps the submit control available for a retry after busy", async () => {
    const action = vi
      .fn<GrupoFormAction>()
      .mockResolvedValueOnce({ kind: "busy" })
      .mockResolvedValueOnce(IDLE);
    renderForm({ record: RECORD }, "en", action);

    await submit(TEXT.en.save);
    await screen.findByText(enMessages.catalog.shared.busy);
    await submit(TEXT.en.save);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText(enMessages.catalog.shared.busy)).toBeNull(),
    );
  });

  it("disables the submit control while the action is pending", async () => {
    let release: () => void = () => {};
    const action = vi.fn<GrupoFormAction>(
      () =>
        new Promise<CatalogFormState>((resolve) => {
          release = () => resolve(IDLE);
        }),
    );
    renderForm({ record: RECORD }, "en", action);
    await submit(TEXT.en.save);

    expect(
      await screen.findByRole("button", { name: TEXT.en.saving }),
    ).toBeDisabled();

    await act(async () => {
      release();
    });
    expect(
      await screen.findByRole("button", { name: TEXT.en.save }),
    ).toBeEnabled();
  });
});

describe("GrupoForm inactive record (CM-GRP-2)", () => {
  it("is locked, offers no submit and shows the reactivate control", async () => {
    renderForm({
      record: { ...RECORD, activo: false },
      reactivate: <button type="button">Reactivate stub</button>,
    });

    expect(
      await screen.findByText(enMessages.catalog.shared.refusals.inactive),
    ).toBeTruthy();
    expect(await combo(TEXT.en.docente)).toBeDisabled();
    for (const box of await screen.findAllByRole("checkbox")) {
      expect(box).toBeDisabled();
    }
    expect(await checkedDays()).toEqual(["lunes", "jueves"]);
    expect(screen.queryByRole("button", { name: TEXT.en.save })).toBeNull();
    expect(
      await screen.findByRole("button", { name: "Reactivate stub" }),
    ).toBeTruthy();
  });

  it("does not render the reactivate control for an active record", async () => {
    renderForm({
      record: RECORD,
      reactivate: <button type="button">Reactivate stub</button>,
    });

    await screen.findByRole("button", { name: TEXT.en.save });
    expect(
      screen.queryByRole("button", { name: "Reactivate stub" }),
    ).toBeNull();
  });
});

describe("GrupoForm days by keyboard (CM-GRP-6)", () => {
  it("reaches the seven days in order and checks and clears each with Space", async () => {
    renderForm({ record: { ...RECORD, dias: [] } });
    const user = userEvent.setup();
    (await combo(TEXT.en.docente)).focus();

    for (const dia of DIAS_SEMANA) {
      await user.tab();
      const box = await day(dayName("en", dia));
      expect(box).toHaveFocus();
      expect(box).not.toBeChecked();
      await user.keyboard(" ");
      expect(box).toBeChecked();
    }
    expect(await checkedDays()).toEqual([...DIAS_SEMANA]);

    for (const dia of [...DIAS_SEMANA].reverse()) {
      const box = await day(dayName("en", dia));
      box.focus();
      await user.keyboard(" ");
      expect(box).not.toBeChecked();
    }
    expect(await checkedDays()).toEqual([]);
  });
});
