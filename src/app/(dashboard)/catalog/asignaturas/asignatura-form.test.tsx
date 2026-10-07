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
  AsignaturaForm,
  type AsignaturaFormAction,
} from "@/app/(dashboard)/catalog/asignaturas/asignatura-form";
import type { CatalogFormState } from "@/lib/catalog/types";

const TEXT = {
  en: {
    codigo: "Code",
    nombre: "Name",
    horas: "Total hours",
    carrera: "Carrera",
    create: "Create subject",
    save: "Save changes",
    saving: "Saving…",
    codigoHint: "The code cannot be changed after the subject is created.",
    fixedHint:
      "Your Carrera is used automatically. You do not need to choose one.",
    importWins: "The next catalog import can replace these values.",
    unchanged: "There are no changes to save.",
    busy: "The catalog is busy with another change. Nothing was saved. Wait a moment and try again.",
    inactive:
      "This record is inactive and cannot be edited. Reactivate it first.",
    gone: "This record is not available",
  },
  es: {
    codigo: "Código",
    nombre: "Nombre",
    horas: "Horas totales",
    carrera: "Carrera",
    create: "Crear asignatura",
    save: "Guardar cambios",
    saving: "Guardando…",
    codigoHint: "El código no se puede cambiar después de crear la asignatura.",
    fixedHint: "Se usa tu Carrera. No necesitas elegirla.",
    importWins:
      "La próxima importación del catálogo puede reemplazar estos valores.",
    unchanged: "No hay cambios que guardar.",
    busy: "El catálogo está ocupado con otro cambio. No se guardó nada. Espera un momento e inténtalo de nuevo.",
    inactive:
      "Este registro está inactivo y no se puede editar. Reactívalo primero.",
    gone: "Este registro no está disponible",
  },
} as const;

type Locale = keyof typeof TEXT;
type FormProps = ComponentProps<typeof AsignaturaForm>;

const CARRERAS = [
  { id: 1, nombre: "Ingeniería de Sistemas" },
  { id: 2, nombre: "Derecho" },
];

const RECORD = {
  id: 12,
  codigo: "MAT101",
  nombre: "Algebra",
  horasTotales: 64,
  carreraId: 2,
  activo: true,
};

const IDLE: CatalogFormState = { kind: "idle" };

function renderForm(
  props: Partial<FormProps> = {},
  locale: Locale = "en",
  action: AsignaturaFormAction = vi.fn<AsignaturaFormAction>(async () => IDLE),
) {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <AsignaturaForm
        action={action}
        carrera={{ kind: "choose", options: CARRERAS }}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { action: action as ReturnType<typeof vi.fn<AsignaturaFormAction>> };
}

const field = (name: string) =>
  screen.findByRole(
    name === "Total hours" || name === "Horas totales"
      ? "spinbutton"
      : "textbox",
    { name },
  );

async function fillRequired(locale: Locale = "en") {
  const t = TEXT[locale];
  fireEvent.change(await field(t.codigo), { target: { value: "FIS200" } });
  fireEvent.change(await field(t.nombre), { target: { value: "Fisica" } });
  fireEvent.change(await field(t.horas), { target: { value: "48" } });
}

async function pickCarrera(nombre: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: nombre }));
  return user;
}

async function submit(label: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: label }));
}

describe("AsignaturaForm create mode (CM-ASG-1, CM-SCOPE-3)", () => {
  it.each(["en", "es"] as const)(
    "renders the three inputs and a Carrera select, in %s",
    async (locale) => {
      const t = TEXT[locale];
      renderForm({}, locale);

      expect(
        ((await field(t.codigo)) as HTMLInputElement).getAttribute("name"),
      ).toBe("codigo");
      expect((await field(t.nombre)).getAttribute("name")).toBe("nombre");
      const horas = await field(t.horas);
      expect(horas.getAttribute("name")).toBe("horasTotales");
      expect(horas.getAttribute("type")).toBe("number");
      expect(await screen.findByText(t.codigoHint)).toBeTruthy();
      expect(
        await screen.findByRole("button", { name: t.create }),
      ).toBeTruthy();
      expect(document.querySelector('input[name="id"]')).toBeNull();
      expect(screen.queryByText(t.importWins)).toBeNull();
    },
  );

  it("offers exactly the Carrera options it was given", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("combobox"));

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(
      CARRERAS.map((c) => c.nombre),
    );
  });

  it("shows a scoped actor's own Carrera as text, with no select and none submitted", async () => {
    const { action } = renderForm({
      carrera: { kind: "fixed", nombre: "Derecho" },
    });

    expect(await screen.findByText("Derecho")).toBeTruthy();
    expect(await screen.findByText(TEXT.en.fixedHint)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();

    await fillRequired();
    await submit(TEXT.en.create);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.has("carreraId")).toBe(false);
  });

  it("submits through onSubmit with the typed values and the chosen Carrera", async () => {
    const { action } = renderForm();
    await fillRequired();
    await pickCarrera("Derecho");
    await submit(TEXT.en.create);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [previous, formData] = action.mock.calls[0];
    expect(previous).toEqual(IDLE);
    expect(formData.get("codigo")).toBe("FIS200");
    expect(formData.get("nombre")).toBe("Fisica");
    expect(formData.get("horasTotales")).toBe("48");
    expect(formData.get("carreraId")).toBe("2");
    expect(formData.has("id")).toBe(false);

    const form = document.querySelector("form") as HTMLFormElement;
    expect(form.hasAttribute("action")).toBe(false);
    expect(form.getAttribute("method")).toBe("post");
  });
});

describe("AsignaturaForm edit mode (CM-ASG-2, CM-ASG-3, CEI-PREC)", () => {
  it.each(["en", "es"] as const)(
    "shows Codigo as text, carries the id hidden and prefills, in %s",
    async (locale) => {
      const t = TEXT[locale];
      renderForm({ record: RECORD }, locale);

      expect(await screen.findByText("MAT101")).toBeTruthy();
      expect(screen.queryByRole("textbox", { name: t.codigo })).toBeNull();
      expect(document.querySelector('[name="codigo"]')).toBeNull();
      expect(await screen.findByText(t.codigoHint)).toBeTruthy();
      expect(
        (document.querySelector('input[name="id"]') as HTMLInputElement).value,
      ).toBe("12");
      expect(
        document.querySelector('input[name="id"]')?.getAttribute("type"),
      ).toBe("hidden");
      expect(((await field(t.nombre)) as HTMLInputElement).value).toBe(
        "Algebra",
      );
      expect(((await field(t.horas)) as HTMLInputElement).value).toBe("64");
      expect((await screen.findByRole("combobox")).textContent).toContain(
        "Derecho",
      );
      expect(await screen.findByRole("button", { name: t.save })).toBeTruthy();
      expect(await screen.findByText(t.importWins)).toBeTruthy();
    },
  );

  it("submits the id, the edited values and never a codigo", async () => {
    const { action } = renderForm({ record: RECORD });
    fireEvent.change(await field(TEXT.en.nombre), {
      target: { value: "Algebra II" },
    });
    await submit(TEXT.en.save);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("id")).toBe("12");
    expect(formData.get("nombre")).toBe("Algebra II");
    expect(formData.get("horasTotales")).toBe("64");
    expect(formData.get("carreraId")).toBe("2");
    expect(formData.has("codigo")).toBe(false);
  });

  it("keeps a scoped actor's Carrera fixed in edit as well", async () => {
    const { action } = renderForm({
      record: RECORD,
      carrera: { kind: "fixed", nombre: "Derecho" },
    });

    expect(await screen.findByText("Derecho")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    await submit(TEXT.en.save);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].has("carreraId")).toBe(false);
  });
});

describe("AsignaturaForm field errors (CM-ASG-1, CM-NFR-3)", () => {
  const FIELD_ERRORS = {
    codigo: "The code is required",
    nombre: "The name is required",
    horasTotales: "Total hours are required",
    carreraId: "Select a Carrera from the list",
  };

  it("keeps every typed value after an invalid answer", async () => {
    renderForm(
      {},
      "en",
      vi.fn<AsignaturaFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: { nombre: FIELD_ERRORS.nombre },
      })),
    );
    await fillRequired();
    await pickCarrera("Derecho");
    await submit(TEXT.en.create);

    await screen.findByText(FIELD_ERRORS.nombre);
    expect(((await field(TEXT.en.codigo)) as HTMLInputElement).value).toBe(
      "FIS200",
    );
    expect(((await field(TEXT.en.nombre)) as HTMLInputElement).value).toBe(
      "Fisica",
    );
    expect(((await field(TEXT.en.horas)) as HTMLInputElement).value).toBe("48");
    expect((await screen.findByRole("combobox")).textContent).toContain(
      "Derecho",
    );
  });

  it("shows each error under its field, announced and linked to the input", async () => {
    renderForm(
      {},
      "en",
      vi.fn<AsignaturaFormAction>(async () => ({
        kind: "invalid",
        fieldErrors: FIELD_ERRORS,
      })),
    );
    await submit(TEXT.en.create);

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toEqual(
      expect.arrayContaining(Object.values(FIELD_ERRORS)),
    );
    const controls: [string, HTMLElement][] = [
      [FIELD_ERRORS.codigo, await field(TEXT.en.codigo)],
      [FIELD_ERRORS.nombre, await field(TEXT.en.nombre)],
      [FIELD_ERRORS.horasTotales, await field(TEXT.en.horas)],
      [FIELD_ERRORS.carreraId, await screen.findByRole("combobox")],
    ];
    for (const [message, control] of controls) {
      const alert = screen.getByText(message);
      expect(alert.getAttribute("role")).toBe("alert");
      expect(control.getAttribute("aria-invalid")).toBe("true");
      expect(control.getAttribute("aria-describedby")).toContain(alert.id);
    }
  });
});

describe("AsignaturaForm answers (CM-ASG-3, CM-NFR-3, CM-NFR-4)", () => {
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
      text: (l) => TEXT[l].unchanged,
      canSubmit: true,
      locked: false,
    },
    {
      name: "error",
      state: { kind: "error", message: "Duplicate code" },
      text: () => "Duplicate code",
      canSubmit: true,
      locked: false,
    },
    {
      name: "busy",
      state: { kind: "busy" },
      text: (l) => TEXT[l].busy,
      canSubmit: true,
      locked: false,
    },
    {
      name: "gone",
      state: { kind: "gone" },
      text: (l) => TEXT[l].gone,
      canSubmit: false,
      locked: false,
    },
    {
      name: "inactive",
      state: { kind: "inactive" },
      text: (l) => TEXT[l].inactive,
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
      vi.fn<AsignaturaFormAction>(async () => answer.state),
    );
    await submit(t.save);

    const region = await screen.findByRole("status");
    await waitFor(() =>
      expect(region.textContent).toContain(answer.text(locale)),
    );
    expect(region.getAttribute("aria-live")).toBe("polite");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: t.save }) !== null).toBe(
        answer.canSubmit,
      ),
    );
    expect(((await field(t.nombre)) as HTMLInputElement).readOnly).toBe(
      answer.locked,
    );
  });

  it("keeps the submit control available for a retry after busy", async () => {
    const action = vi
      .fn<AsignaturaFormAction>()
      .mockResolvedValueOnce({ kind: "busy" })
      .mockResolvedValueOnce(IDLE);
    renderForm({ record: RECORD }, "en", action);

    await submit(TEXT.en.save);
    await screen.findByText(TEXT.en.busy);
    await submit(TEXT.en.save);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(TEXT.en.busy)).toBeNull());
  });

  it("disables the submit control while the action is pending", async () => {
    let release: () => void = () => {};
    const action = vi.fn<AsignaturaFormAction>(
      () =>
        new Promise<CatalogFormState>((resolve) => {
          release = () => resolve(IDLE);
        }),
    );
    renderForm({ record: RECORD }, "en", action);
    await submit(TEXT.en.save);

    const pending = await screen.findByRole("button", { name: TEXT.en.saving });
    expect((pending as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      release();
    });
    const idle = await screen.findByRole("button", { name: TEXT.en.save });
    expect((idle as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("AsignaturaForm inactive record (CM-ASG-3)", () => {
  it("is read-only, offers no submit and shows the reactivate control", async () => {
    renderForm({
      record: { ...RECORD, activo: false },
      reactivate: <button type="button">Reactivate stub</button>,
    });

    expect(await screen.findByText(TEXT.en.inactive)).toBeTruthy();
    expect(((await field(TEXT.en.nombre)) as HTMLInputElement).readOnly).toBe(
      true,
    );
    expect(((await field(TEXT.en.horas)) as HTMLInputElement).readOnly).toBe(
      true,
    );
    expect(
      (await screen.findByRole("combobox")).hasAttribute("disabled") ||
        (await screen.findByRole("combobox")).getAttribute("aria-disabled") ===
          "true",
    ).toBe(true);
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
