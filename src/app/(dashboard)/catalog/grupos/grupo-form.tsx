"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, startTransition, useActionState, useId } from "react";

import { CheckboxGroup } from "@/components/checkbox-group";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { DIAS_SEMANA, type DiaSemana } from "@/lib/catalog/dias";
import type { CatalogFormState } from "@/lib/catalog/types";

export type GrupoFormAction = (
  previous: CatalogFormState,
  formData: FormData,
) => Promise<CatalogFormState>;

/** The record being edited; its absence means create mode. The Asignatura,
 *  period and group number are shown but never editable (CM-GRP-2). */
export type GrupoFormRecord = {
  id: number;
  asignaturaCodigo: string;
  asignaturaNombre: string;
  periodo: string;
  numeroGrupo: string;
  docenteId: number;
  /** Stored name, shown when the docente is not among the options. */
  docenteNombre: string;
  activo: boolean;
  dias: readonly DiaSemana[];
};

const IDLE: CatalogFormState = { kind: "idle" };
const ERROR_PANEL =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

/** A value shown as text: the natural key of an existing group, or the
 *  Asignatura a new group is being created under. */
function FixedField({ label, value }: { label: string; value: string }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-label text-foreground">
        {label}
      </span>
      <p aria-labelledby={labelId} className="py-2 text-base md:text-sm">
        {value}
      </p>
    </div>
  );
}

/**
 * One form for creating and editing a Grupo. It receives its Server Action and
 * its docente options, so the page decides them and the form imports nothing
 * from the data layer. Submitted through `onSubmit` with a hand dispatch: React
 * resets the fields of a form `action` once it settles, which would discard what
 * the user typed, chose and checked after a validation error.
 */
export function GrupoForm({
  action,
  docentes,
  docentesTruncated = false,
  record,
  asignatura,
  reactivate,
}: {
  action: GrupoFormAction;
  docentes: readonly { id: number; nombreCompleto: string }[];
  docentesTruncated?: boolean;
  record?: GrupoFormRecord;
  /** Create mode only: the Asignatura named by the route. It is shown as text
   *  and posted in a hidden field; the action still validates it. Ignored in
   *  edit mode, where the record carries its own. */
  asignatura?: { id: number; codigo: string; nombre: string };
  /** Rendered in place of the submit control while the record is inactive. */
  reactivate?: ReactNode;
}) {
  const t = useTranslations("catalog.grupos.form");
  const ts = useTranslations("catalog.shared");
  const [state, dispatch, isPending] = useActionState(action, IDLE);

  const editing = record !== undefined;
  // An inactive record is read-only, whether it was loaded that way or the
  // server just refused the edit (CM-GRP-2).
  const locked = editing && (!record.activo || state.kind === "inactive");
  const canSubmit = !locked && state.kind !== "gone";
  const errors = state.kind === "invalid" ? state.fieldErrors : {};

  // Errors for a field this form does not draw are still shown, as text. The
  // Asignatura is never a control, so its error is always one of them.
  const drawn = ["docenteId", "dias"];
  if (!editing) drawn.push("periodo", "numeroGrupo");
  const stray = Object.entries(errors).filter(([key]) => !drawn.includes(key));

  const docenteItems = docentes.map((d) => ({
    value: String(d.id),
    label: d.nombreCompleto,
  }));
  // The current docente may be gone from the options (deactivated, role lost,
  // beyond the cap); keep it selectable so a days-only edit still sends it.
  if (editing && !docentes.some((d) => d.id === record.docenteId)) {
    docenteItems.push({
      value: String(record.docenteId),
      label: record.docenteNombre,
    });
  }

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
        <>
          <FixedField
            label={t("asignaturaLabel")}
            value={`${record.asignaturaCodigo} - ${record.asignaturaNombre}`}
          />
          <FixedField label={t("periodoLabel")} value={record.periodo} />
          <FixedField
            label={t("numeroGrupoLabel")}
            value={record.numeroGrupo}
          />
          <p className="text-muted-foreground text-xs">{t("naturalKeyHint")}</p>
        </>
      ) : (
        <>
          {asignatura ? (
            <>
              <input type="hidden" name="asignaturaId" value={asignatura.id} />
              <FixedField
                label={t("asignaturaLabel")}
                value={`${asignatura.codigo} - ${asignatura.nombre}`}
              />
            </>
          ) : null}
          <FormField
            id="periodo"
            label={t("periodoLabel")}
            hint={t("periodoHint")}
            error={errors.periodo}
          >
            {(control) => (
              <Input {...control} name="periodo" autoComplete="off" />
            )}
          </FormField>
          <FormField
            id="numeroGrupo"
            label={t("numeroGrupoLabel")}
            error={errors.numeroGrupo}
          >
            {(control) => (
              <Input {...control} name="numeroGrupo" autoComplete="off" />
            )}
          </FormField>
        </>
      )}

      <FormField
        id="docenteId"
        label={t("docenteLabel")}
        error={errors.docenteId}
      >
        {(control) => (
          <Combobox
            {...control}
            name="docenteId"
            items={docenteItems}
            emptyText={t("noMatches")}
            placeholder={t("searchPlaceholder")}
            truncated={docentesTruncated}
            truncatedText={t("truncated")}
            defaultValue={record ? String(record.docenteId) : undefined}
            disabled={locked}
          />
        )}
      </FormField>

      <CheckboxGroup
        id="dias"
        legend={t("diasLabel")}
        name="dias"
        options={DIAS_SEMANA.map((dia) => ({
          value: dia,
          label: ts(`dias.long.${dia}`),
        }))}
        defaultValues={record?.dias}
        hint={t("diasHint")}
        error={errors.dias}
        disabled={locked}
      />

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
