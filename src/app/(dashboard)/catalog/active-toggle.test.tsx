import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../i18n/en.json";
import esMessages from "../../../../i18n/es.json";
import {
  ActiveToggle,
  type ActiveToggleAction,
} from "@/app/(dashboard)/catalog/active-toggle";
import type { ActiveToggleState } from "@/lib/catalog/types";

const LABELS = {
  en: {
    active: "Active",
    inactive: "Inactive",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    title: "Deactivate MAT101 Algebra?",
    nothingDeleted:
      "Nothing is deleted: the record becomes inactive and you can reactivate it whenever you want.",
    confirm: "Yes, deactivate",
    cancel: "Cancel",
    busy: "The catalog is busy with another change. Nothing was saved. Wait a moment and try again.",
    alreadyInactive: "The record was already inactive. No changes were made.",
    unchanged: "There are no changes to save.",
    gone: "This record is not available",
  },
  es: {
    active: "Activo",
    inactive: "Inactivo",
    deactivate: "Desactivar",
    reactivate: "Reactivar",
    title: "¿Desactivar MAT101 Algebra?",
    nothingDeleted:
      "No se elimina nada: el registro queda inactivo y puedes reactivarlo cuando quieras.",
    confirm: "Sí, desactivar",
    cancel: "Cancelar",
    busy: "El catálogo está ocupado con otro cambio. No se guardó nada. Espera un momento e inténtalo de nuevo.",
    alreadyInactive:
      "El registro ya estaba inactivo. No se hizo ningún cambio.",
    unchanged: "No hay cambios que guardar.",
    gone: "Este registro no está disponible",
  },
} as const;

const NOTICE = "This subject has 0 active groups.";
const RECORD = "MAT101 Algebra";

const classTokens = (el: HTMLElement) => el.className.split(/\s+/);

function renderToggle(
  props: {
    activo?: boolean;
    action?: ActiveToggleAction;
    notice?: string;
  } = {},
  locale: "es" | "en" = "en",
) {
  const action: ActiveToggleAction =
    props.action ??
    vi.fn<ActiveToggleAction>(async () => ({ kind: "done", activo: false }));
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <ActiveToggle
        action={action}
        id={12}
        recordLabel={RECORD}
        activo={props.activo ?? true}
        notice={props.notice}
      />
    </NextIntlClientProvider>,
  );
  return { action: action as ReturnType<typeof vi.fn<ActiveToggleAction>> };
}

async function openConfirm(locale: "es" | "en" = "en") {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: LABELS[locale].deactivate }),
  );
  return user;
}

describe("ActiveToggle step one (CM-UX-1, CM-ASG-4)", () => {
  it.each(["en", "es"] as const)(
    "shows the active pill and one secondary button, in %s",
    async (locale) => {
      renderToggle({ activo: true }, locale);

      const labels = LABELS[locale];
      expect(await screen.findByText(labels.active)).toBeTruthy();
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent).toBe(labels.deactivate);
      expect(classTokens(buttons[0])).toContain("bg-secondary");
      expect(classTokens(buttons[0])).not.toContain("text-destructive-ink");
    },
  );

  it("is never a GET link: no anchor or href anywhere in the control", async () => {
    const { action } = renderToggle({ notice: NOTICE });
    await openConfirm();

    await screen.findByRole("button", { name: LABELS.en.confirm });
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(document.body.querySelector("[href]")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });
});

describe("ActiveToggle step two (CM-UX-1)", () => {
  it.each(["en", "es"] as const)(
    "pressing deactivate only reveals the confirmation, in %s",
    async (locale) => {
      const { action } = renderToggle({ notice: NOTICE }, locale);
      const labels = LABELS[locale];

      await openConfirm(locale);

      const group = await screen.findByRole("group", { name: labels.title });
      expect(within(group).getByText(labels.nothingDeleted)).toBeTruthy();
      expect(within(group).getByText(NOTICE)).toBeTruthy();
      const confirm = within(group).getByRole("button", {
        name: labels.confirm,
      });
      const cancel = within(group).getByRole("button", { name: labels.cancel });
      expect(classTokens(confirm)).toContain("text-destructive-ink");
      expect(classTokens(cancel)).not.toContain("text-destructive-ink");
      expect(
        screen.queryByRole("button", { name: labels.deactivate }),
      ).toBeNull();
      expect(action).not.toHaveBeenCalled();
    },
  );

  it("moves focus to the confirm button", async () => {
    renderToggle();
    await openConfirm();

    const confirm = await screen.findByRole("button", {
      name: LABELS.en.confirm,
    });
    await waitFor(() => expect(document.activeElement).toBe(confirm));
  });

  it("cancel restores step one and its focus without dispatching", async () => {
    const { action } = renderToggle();
    const user = await openConfirm();

    await user.click(
      await screen.findByRole("button", { name: LABELS.en.cancel }),
    );

    const reopen = await screen.findByRole("button", {
      name: LABELS.en.deactivate,
    });
    await waitFor(() => expect(document.activeElement).toBe(reopen));
    expect(screen.queryByRole("group")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("confirm dispatches once with the id and the deactivate intent", async () => {
    const { action } = renderToggle();
    const user = await openConfirm();

    await user.click(
      await screen.findByRole("button", { name: LABELS.en.confirm }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [previous, formData] = action.mock.calls[0];
    expect(previous).toEqual({ kind: "idle" });
    expect(formData.get("id")).toBe("12");
    expect(formData.get("intent")).toBe("deactivate");
    await screen.findByRole("button", { name: LABELS.en.reactivate });
  });
});

describe("ActiveToggle reactivation (CM-ASG-5)", () => {
  it("is a single press that dispatches once with the reactivate intent", async () => {
    const { action } = renderToggle({
      activo: false,
      action: vi.fn<ActiveToggleAction>(async () => ({
        kind: "done",
        activo: true,
      })),
    });
    const user = userEvent.setup();

    expect(await screen.findByText(LABELS.en.inactive)).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: LABELS.en.reactivate }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("id")).toBe("12");
    expect(formData.get("intent")).toBe("reactivate");
    expect(screen.queryByRole("group")).toBeNull();
    await screen.findByRole("button", { name: LABELS.en.deactivate });
  });
});

describe("ActiveToggle outcomes (CM-NFR-3, CM-NFR-4)", () => {
  const live = async () => {
    const region = await screen.findByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    return region;
  };

  async function confirmWith(
    state: ActiveToggleState,
    locale: "es" | "en" = "en",
    activo = true,
  ) {
    const rendered = renderToggle(
      { activo, action: vi.fn<ActiveToggleAction>(async () => state) },
      locale,
    );
    const user = userEvent.setup();
    if (activo) {
      await user.click(
        await screen.findByRole("button", { name: LABELS[locale].deactivate }),
      );
      await user.click(
        await screen.findByRole("button", { name: LABELS[locale].confirm }),
      );
    } else {
      await user.click(
        await screen.findByRole("button", { name: LABELS[locale].reactivate }),
      );
    }
    await waitFor(() => expect(rendered.action).toHaveBeenCalledTimes(1));
    return rendered;
  }

  it.each(["en", "es"] as const)(
    "announces a done deactivation and flips the pill and button, in %s",
    async (locale) => {
      await confirmWith({ kind: "done", activo: false }, locale);

      const region = await live();
      await waitFor(() =>
        expect(region.textContent).toContain(LABELS[locale].inactive),
      );
      await screen.findByRole("button", { name: LABELS[locale].reactivate });
    },
  );

  it("announces a done reactivation", async () => {
    await confirmWith({ kind: "done", activo: true }, "en", false);

    const region = await live();
    await waitFor(() => expect(region.textContent).toContain(LABELS.en.active));
    await screen.findByRole("button", { name: LABELS.en.deactivate });
  });

  it.each(["en", "es"] as const)(
    "tells an already inactive record (unchanged on deactivate), in %s",
    async (locale) => {
      await confirmWith({ kind: "unchanged" }, locale);

      const region = await live();
      await waitFor(() =>
        expect(region.textContent).toContain(LABELS[locale].alreadyInactive),
      );
      await screen.findByRole("button", { name: LABELS[locale].reactivate });
    },
  );

  it("tells a no-op reactivation with the generic unchanged text", async () => {
    await confirmWith({ kind: "unchanged" }, "en", false);

    const region = await live();
    await waitFor(() =>
      expect(region.textContent).toContain(LABELS.en.unchanged),
    );
    await screen.findByRole("button", { name: LABELS.en.deactivate });
  });

  it("shows the server's error message, such as the active-group count", async () => {
    const message =
      "Cannot deactivate: this subject has 3 active groups. Deactivate them first and try again.";
    await confirmWith({ kind: "error", message });

    const region = await live();
    await waitFor(() => expect(region.textContent).toContain(message));
    await screen.findByRole("button", { name: LABELS.en.deactivate });
  });

  it.each(["en", "es"] as const)(
    "tells busy as nothing saved and keeps the control, in %s",
    async (locale) => {
      await confirmWith({ kind: "busy" }, locale);

      const region = await live();
      await waitFor(() =>
        expect(region.textContent).toContain(LABELS[locale].busy),
      );
      await screen.findByRole("button", { name: LABELS[locale].deactivate });
    },
  );

  it.each(["en", "es"] as const)(
    "tells gone as not available and offers no button, in %s",
    async (locale) => {
      await confirmWith({ kind: "gone" }, locale);

      const region = await live();
      await waitFor(() =>
        expect(region.textContent).toContain(LABELS[locale].gone),
      );
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    },
  );

  it("keeps the live region mounted and empty before any outcome", async () => {
    renderToggle();

    const region = await live();
    expect(region.textContent).toBe("");
  });

  it("disables the control while the action is pending", async () => {
    let finish: (state: ActiveToggleState) => void = () => {};
    const pending = new Promise<ActiveToggleState>((resolve) => {
      finish = resolve;
    });
    const { action } = renderToggle({
      action: vi.fn<ActiveToggleAction>(() => pending),
    });
    const user = await openConfirm();

    await user.click(
      await screen.findByRole("button", { name: LABELS.en.confirm }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const button = await screen.findByRole("button", {
      name: LABELS.en.deactivate,
    });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));

    await act(async () => {
      finish({ kind: "done", activo: false });
      await pending;
    });
    await screen.findByRole("button", { name: LABELS.en.reactivate });
  });
});
