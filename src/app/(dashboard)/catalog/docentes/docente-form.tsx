"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, startTransition, useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogFormState } from "@/lib/catalog/types";

export type DocenteFormAction = (
  previous: CatalogFormState,
  formData: FormData,
) => Promise<CatalogFormState>;

/** What the edit page hands the form: the record's own fields and nothing
 *  else (DM-2). No login, hash, Cif or role ever reaches this component. */
export type DocenteFormRecord = {
  id: number;
  nombreCompleto: string;
  correo: string | null;
  telefono: string | null;
  activo: boolean;
};

const IDLE: CatalogFormState = { kind: "idle" };
const ERROR_PANEL =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm break-words";

/** The three fields a secretaria may change (DM-3). */
const DRAWN = ["nombreCompleto", "correo", "telefono"];

/**
 * The edit form of a docente. It receives its Server Action, so the page
 * never imports it, and it imports nothing from the data layer. Submitted
 * through `onSubmit` with a hand dispatch: React resets the fields of a form
 * `action` once it settles, which would discard what the user typed after a
 * validation error. An inactive docente is read-only, whether it was loaded
 * that way or the server just refused the edit (DM-6); the reactivate hint
 * takes the place of the submit control.
 */
export function DocenteForm({
  action,
  record,
  reactivate,
}: {
  action: DocenteFormAction;
  record: DocenteFormRecord;
  /** Rendered in place of the submit control while the docente is inactive. */
  reactivate?: ReactNode;
}) {
  const t = useTranslations("catalog.docentes.form");
  const ts = useTranslations("catalog.shared");
  const [state, dispatch, isPending] = useActionState(action, IDLE);

  const locked = !record.activo || state.kind === "inactive";
  const canSubmit = !locked && state.kind !== "gone";
  const errors = state.kind === "invalid" ? state.fieldErrors : {};

  // Errors for a field this form does not draw are still shown, as text.
  const stray = Object.entries(errors).filter(([key]) => !DRAWN.includes(key));

  let notice: { text: string; failed: boolean } | null = null;
  if (locked) {
    notice = {
      text: ts("refusals.inactive"),
      failed: state.kind === "inactive",
    };
  } else if (!isPending) {
    if (state.kind === "unchanged") {
      notice = { text: ts("refusals.unchanged"), failed: false };
    } else if (state.kind === "error") {
      notice = { text: state.message, failed: true };
    } else if (state.kind === "busy") {
      notice = { text: ts("busy"), failed: true };
    } else if (state.kind === "gone") {
      notice = {
        text: `${ts("notFound.title")}. ${ts("notFound.message")}`,
        failed: true,
      };
    }
  }

  return (
    <form
      method="post"
      noValidate
      className="flex w-full max-w-xl flex-col gap-5"
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending || !canSubmit) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <input type="hidden" name="id" value={record.id} />

      <FormField
        id="nombreCompleto"
        label={t("nombreLabel")}
        error={errors.nombreCompleto}
      >
        {(control) => (
          <Input
            {...control}
            name="nombreCompleto"
            type="text"
            autoComplete="off"
            defaultValue={record.nombreCompleto}
            readOnly={locked}
          />
        )}
      </FormField>

      <FormField
        id="correo"
        label={t("correoLabel")}
        hint={t("correoHint")}
        error={errors.correo}
      >
        {(control) => (
          <Input
            {...control}
            name="correo"
            type="email"
            // The browser must not offer the maintainer's own address here.
            autoComplete="off"
            defaultValue={record.correo ?? ""}
            readOnly={locked}
          />
        )}
      </FormField>

      <FormField
        id="telefono"
        label={t("telefonoLabel")}
        error={errors.telefono}
      >
        {(control) => (
          <Input
            {...control}
            name="telefono"
            type="tel"
            autoComplete="off"
            defaultValue={record.telefono ?? ""}
            readOnly={locked}
          />
        )}
      </FormField>

      <p className="text-muted-foreground text-xs">{t("correoNote")}</p>
      <p className="text-muted-foreground text-xs">{ts("importWins")}</p>

      {/* Mounted from the start so a screen reader announces what changes. */}
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {notice ? (
          <p className={notice.failed ? ERROR_PANEL : "text-sm break-words"}>
            {notice.text}
          </p>
        ) : null}
        {stray.map(([key, message]) => (
          <p key={key} className={ERROR_PANEL}>
            {message}
          </p>
        ))}
      </div>

      {locked ? reactivate : null}
      {canSubmit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? t("submitting") : t("submitSave")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
