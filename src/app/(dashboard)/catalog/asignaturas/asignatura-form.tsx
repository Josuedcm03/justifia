"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, startTransition, useActionState, useId } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogFormState } from "@/lib/catalog/types";

export type AsignaturaFormAction = (
  previous: CatalogFormState,
  formData: FormData,
) => Promise<CatalogFormState>;

/** The record being edited; its absence means create mode. */
export type AsignaturaFormRecord = {
  id: number;
  codigo: string;
  nombre: string;
  horasTotales: number;
  carreraId: number;
  activo: boolean;
};

/** A scoped actor sees their own Carrera, fixed; the server decides it
 *  (CM-SCOPE-3). An unscoped actor chooses among the options given. */
export type AsignaturaFormCarrera =
  | { kind: "fixed"; nombre: string }
  | { kind: "choose"; options: readonly { id: number; nombre: string }[] };

const IDLE: CatalogFormState = { kind: "idle" };
const ERROR_PANEL =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

/** A value shown as text: the immutable Codigo and a scoped actor's Carrera. */
function FixedField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-label text-foreground">
        {label}
      </span>
      <p aria-labelledby={labelId} className="py-2 text-base md:text-sm">
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

/**
 * One form for creating and editing an Asignatura. It receives its Server
 * Action, so the page picks create or update, and it imports nothing from the
 * data layer. Submitted through `onSubmit` with a hand dispatch: React resets
 * the fields of a form `action` once it settles, which would discard what the
 * user typed after a validation error.
 */
export function AsignaturaForm({
  action,
  record,
  carrera,
  reactivate,
}: {
  action: AsignaturaFormAction;
  record?: AsignaturaFormRecord;
  carrera: AsignaturaFormCarrera;
  /** Rendered in place of the submit control while the record is inactive. */
  reactivate?: ReactNode;
}) {
  const t = useTranslations("catalog.asignaturas.form");
  const ts = useTranslations("catalog.shared");
  const [state, dispatch, isPending] = useActionState(action, IDLE);

  const editing = record !== undefined;
  // An inactive record is read-only, whether it was loaded that way or the
  // server just refused the edit (CM-ASG-3).
  const locked = editing && (!record.activo || state.kind === "inactive");
  const canSubmit = !locked && state.kind !== "gone";
  const errors = state.kind === "invalid" ? state.fieldErrors : {};

  // Errors for a field this form does not draw are still shown, as text.
  const drawn = ["nombre", "horasTotales"];
  if (!editing) drawn.push("codigo");
  if (carrera.kind === "choose") drawn.push("carreraId");
  const stray = Object.entries(errors).filter(([key]) => !drawn.includes(key));

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
      className="flex flex-col gap-5"
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending || !canSubmit) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      {editing ? <input type="hidden" name="id" value={record.id} /> : null}

      {editing ? (
        <FixedField
          label={t("codigoLabel")}
          value={record.codigo}
          hint={t("codigoHint")}
        />
      ) : (
        <FormField
          id="codigo"
          label={t("codigoLabel")}
          hint={t("codigoHint")}
          error={errors.codigo}
        >
          {(control) => <Input {...control} name="codigo" autoComplete="off" />}
        </FormField>
      )}

      <FormField id="nombre" label={t("nombreLabel")} error={errors.nombre}>
        {(control) => (
          <Input
            {...control}
            name="nombre"
            autoComplete="off"
            defaultValue={record?.nombre}
            readOnly={locked}
          />
        )}
      </FormField>

      <FormField
        id="horasTotales"
        label={t("horasLabel")}
        error={errors.horasTotales}
      >
        {(control) => (
          <Input
            {...control}
            name="horasTotales"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={record?.horasTotales}
            readOnly={locked}
          />
        )}
      </FormField>

      {carrera.kind === "fixed" ? (
        <FixedField
          label={t("carreraLabel")}
          value={carrera.nombre}
          hint={t("carreraFixedHint")}
        />
      ) : (
        <FormField
          id="carreraId"
          label={t("carreraLabel")}
          error={errors.carreraId}
        >
          {(control) => (
            <Select
              name="carreraId"
              disabled={locked}
              defaultValue={record ? String(record.carreraId) : undefined}
              items={carrera.options.map((c) => ({
                value: String(c.id),
                label: c.nombre,
              }))}
            >
              <SelectTrigger {...control} className="w-full">
                <SelectValue placeholder={t("carreraPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {carrera.options.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      )}

      {editing ? (
        <p className="text-muted-foreground text-xs">{ts("importWins")}</p>
      ) : null}

      {/* Mounted from the start so a screen reader announces what changes. */}
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {notice ? (
          <p className={notice.failed ? ERROR_PANEL : "text-sm"}>
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
        <div>
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending
              ? t("submitting")
              : t(editing ? "submitSave" : "submitCreate")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
