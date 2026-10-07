"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";

import { saveDetailsAction } from "@/app/(dashboard)/requests/new/actions";
import {
  Field,
  FieldErrors,
  StepShell,
  errorsOf,
  invalidProps,
} from "@/app/(dashboard)/requests/new/form-field";
import { stepHref } from "@/app/(dashboard)/requests/new/steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CAUSAS } from "@/lib/intake/causes";
import type { FieldError } from "@/lib/validations/solicitud";

type Initial = {
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
};

/**
 * Step 1: cause and dates (RF-01 b, RN-01, RN-05, RN-23). Nothing is validated
 * here: the action is the authority and answers with every invalid field at
 * once (RF-03), so the form never disagrees with the server.
 */
export function CauseDatesStep({ initial }: { initial: Initial }) {
  const t = useTranslations("intake");
  const router = useRouter();
  const [causa, setCausa] = useState(initial.causa ?? "");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const details = {
      causa,
      fechaInicio: String(form.get("fechaInicio") ?? ""),
      fechaFin: String(form.get("fechaFin") ?? ""),
    };

    startTransition(async () => {
      const result = await saveDetailsAction(details);
      if (result.ok) {
        setErrors([]);
        router.push(stepHref(2));
      } else {
        setErrors(result.errors);
      }
    });
  }

  const causaErrors = errorsOf(errors, "causa");
  const startErrors = errorsOf(errors, "fechaInicio");
  const endErrors = errorsOf(errors, "fechaFin");

  return (
    <form onSubmit={handleSubmit} noValidate>
      <StepShell
        title={t("details.title")}
        description={t("details.description")}
        footer={
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="w-full sm:ml-auto sm:w-auto"
          >
            {pending ? t("actions.saving") : t("actions.next")}
          </Button>
        }
      >
        <Field id="causa" label={t("details.causeLabel")} errors={causaErrors}>
          <RadioGroup
            value={causa}
            onValueChange={(value) => setCausa(String(value))}
            aria-labelledby="causa-label"
            {...invalidProps("causa", causaErrors)}
          >
            {CAUSAS.map((code) => (
              <label key={code} className="flex items-start gap-3 text-sm">
                <RadioGroupItem value={code} className="mt-0.5" />
                {t(`causes.${code}`)}
              </label>
            ))}
          </RadioGroup>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="fechaInicio"
            htmlFor="fechaInicio"
            label={t("details.startLabel")}
            errors={startErrors}
          >
            <Input
              id="fechaInicio"
              name="fechaInicio"
              type="date"
              defaultValue={initial.fechaInicio ?? ""}
              {...invalidProps("fechaInicio", startErrors)}
            />
          </Field>
          <Field
            id="fechaFin"
            htmlFor="fechaFin"
            label={t("details.endLabel")}
            errors={endErrors}
          >
            <Input
              id="fechaFin"
              name="fechaFin"
              type="date"
              defaultValue={initial.fechaFin ?? ""}
              {...invalidProps("fechaFin", endErrors)}
            />
          </Field>
        </div>

        <FieldErrors id="form" errors={errorsOf(errors, "form")} />
      </StepShell>
    </form>
  );
}
