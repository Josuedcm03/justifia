"use client";

import { useTranslations } from "next-intl";

import { CheckboxGroup } from "@/components/checkbox-group";
import { Button } from "@/components/ui/button";
import { TIPOS_DOCUMENTO } from "@/lib/document-data/types";
import { CAUSAS } from "@/lib/intake/causes";
import type { DocumentTypeCauses } from "@/lib/signals/document-marks";

import {
  ParameterSection,
  SaveOutcome,
  useParameterForm,
  type ParameterFormAction,
} from "./parameter-form";

const KEY = "tipo_documento_causa";

/**
 * The type-to-cause map of RN-13 (NP-12): a group of checkboxes per document
 * type, one cell per cause, editable whatever the cause's active flag. `otro`
 * corresponds to no cause, so it has no cell. The whole table is read from the
 * form at submit and sent as the one field the action reads.
 */
export function TypeCausesSection({
  action,
  map,
}: {
  action: ParameterFormAction;
  map: DocumentTypeCauses;
}) {
  const t = useTranslations("parameters.map");
  const ts = useTranslations("parameters.actions");
  const causes = useTranslations("intake.causes");
  const { state, pending, fieldErrors, submit } = useParameterForm(action);

  return (
    <ParameterSection title={t("title")} description={t("description")}>
      <form
        method="post"
        noValidate
        className="flex flex-col gap-5"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const table = Object.fromEntries(
            TIPOS_DOCUMENTO.map((type) => [
              type,
              type === "otro" ? [] : form.getAll(type),
            ]),
          );
          const payload = new FormData();
          payload.set(KEY, JSON.stringify(table));
          submit(payload);
        }}
      >
        {TIPOS_DOCUMENTO.map((type) =>
          type === "otro" ? (
            <fieldset key={type} className="flex min-w-0 flex-col gap-2">
              <legend className="text-label text-foreground mb-2">
                {t(`types.${type}`)}
              </legend>
              <p className="text-muted-foreground text-sm">{t("otroNote")}</p>
            </fieldset>
          ) : (
            <CheckboxGroup
              key={type}
              id={`map-${type}`}
              legend={t(`types.${type}`)}
              name={type}
              options={CAUSAS.map((cause) => ({
                value: cause,
                label: causes(cause),
              }))}
              defaultValues={map[type]}
            />
          ),
        )}

        {fieldErrors[KEY] ? (
          <p role="alert" className="text-destructive-ink text-sm">
            {fieldErrors[KEY]}
          </p>
        ) : null}
        <SaveOutcome state={state} pending={pending} />
        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? ts("saving") : ts("save")}
          </Button>
        </div>
      </form>
    </ParameterSection>
  );
}
