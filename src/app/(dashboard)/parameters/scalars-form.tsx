"use client";

import { useTranslations } from "next-intl";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  ParameterSection,
  SaveOutcome,
  useParameterForm,
  type ParameterFormAction,
} from "./parameter-form";

/** One scalar key and the value in force, in the order the form lists them. */
export type ScalarField = { key: string; value: number };

/**
 * The six scalar parameters (NP-7): a number input per key showing its value
 * in force and nothing else. One press saves them all; the server states the
 * allowed range of any field it refuses.
 */
export function ScalarsForm({
  action,
  fields,
}: {
  action: ParameterFormAction;
  fields: readonly ScalarField[];
}) {
  const t = useTranslations("parameters");
  const { state, pending, fieldErrors, submit } = useParameterForm(action);

  return (
    <ParameterSection title={t("scalars.title")}>
      <form
        method="post"
        noValidate
        className="flex flex-col gap-5"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map(({ key, value }) => (
            <FormField
              key={key}
              id={key}
              label={t(`scalars.fields.${key}`)}
              error={fieldErrors[key]}
            >
              {(control) => (
                <Input
                  {...control}
                  name={key}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  defaultValue={value}
                />
              )}
            </FormField>
          ))}
        </div>

        <SaveOutcome state={state} pending={pending} />
        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? t("actions.saving") : t("actions.save")}
          </Button>
        </div>
      </form>
    </ParameterSection>
  );
}
