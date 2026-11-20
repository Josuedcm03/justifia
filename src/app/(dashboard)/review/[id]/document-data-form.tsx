"use client";

import { useFormatter, useTranslations } from "next-intl";
import { startTransition, useActionState, useId, type ReactNode } from "react";

import {
  saveDocumentDataAction,
  type DocumentDataActionFailure,
} from "@/app/(dashboard)/review/[id]/document-data-actions";
import { FormField } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TIPOS_DOCUMENTO,
  type DocumentMarks,
  type ManualFields,
} from "@/lib/document-data/types";
import {
  ISSUER_MAX_LENGTH,
  NAME_MAX_LENGTH,
  type DocumentDataErrors,
} from "@/lib/document-data/validation";
import type { ExtractionRowView } from "@/lib/extraction/display";

// The manual data form of one document (RF-14 a-d, MD-23, MD-24, MD-25). It
// opens from a button, holds the four data, the type and the firma and the
// sello, and sends them as one FormData to `saveDocumentDataAction`. It is
// prefilled only with the manual values: the extracted value is a reference
// beside the field, never a default, so saving without typing leaves the datum
// without a manual value (D8). Saving needs no confirmation because it is
// reversible. A success redirects, so this component only ever receives
// refusals; it keeps what was typed because it submits by hand (React resets the
// fields of a form `action` once it settles). The page is never revalidated
// (SR-11); its parent keys it on the stored values so it remounts closed.

// The radio and select value of "Sin registrar"; the action reads it as null.
const UNREGISTERED = "unregistered";

const FAILURE =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

type MarkValue = "yes" | "no" | typeof UNREGISTERED;

function markValue(mark: boolean | null): MarkValue {
  return mark === null ? UNREGISTERED : mark ? "yes" : "no";
}

/** The action of the form: the server answers only with a refusal. */
async function submitForm(
  _previous: DocumentDataActionFailure | null,
  formData: FormData,
): Promise<DocumentDataActionFailure | null> {
  return saveDocumentDataAction(formData);
}

/** A calendar date as text, without a time-zone shift. */
function useDay() {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
}

/** The values read from the document, as text; only a completed row has any. */
function useReference(extracted: ExtractionRowView | null) {
  const t = useTranslations("review.extraction");
  const day = useDay();
  const row = extracted?.state === "completada" ? extracted : null;

  let rest: string | null = null;
  if (row !== null && row.restDays !== null) {
    const days = t("restDays", { count: row.restDays });
    rest =
      row.restFrom === null || row.restTo === null
        ? days
        : row.restFrom === row.restTo
          ? t("restSingleDay", { date: day(row.restFrom), days })
          : t("restRange", {
              from: day(row.restFrom),
              to: day(row.restTo),
              days,
            });
  }
  return {
    studentName: row?.studentName ?? null,
    issuer: row?.issuer ?? null,
    issueDate: row?.issueDate ? day(row.issueDate) : null,
    rest,
  };
}

function Choice({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string | null;
  children: (control: {
    "aria-labelledby": string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => ReactNode;
}) {
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-label text-foreground">
        {label}
      </span>
      {children({
        "aria-labelledby": labelId,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-destructive-ink text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MarkField({
  name,
  label,
  defaultValue,
  error,
}: {
  name: "hasSignature" | "hasSeal";
  label: string;
  defaultValue: MarkValue;
  error?: string;
}) {
  const t = useTranslations("review.extraction.markValues");
  const id = useId();
  const options: MarkValue[] = ["yes", "no", UNREGISTERED];

  return (
    <Choice id={id} label={label} error={error}>
      {(control) => (
        <RadioGroup
          {...control}
          name={name}
          defaultValue={defaultValue}
          className="flex-row flex-wrap gap-2"
        >
          {options.map((option) => (
            <label
              key={option}
              className="flex min-h-11 items-center gap-2 pr-3 text-sm"
            >
              <RadioGroupItem value={option} />
              {t(option)}
            </label>
          ))}
        </RadioGroup>
      )}
    </Choice>
  );
}

export function DocumentDataForm({
  solicitudId,
  documentoId,
  documentName,
  manual,
  marks,
  extracted,
}: {
  solicitudId: number;
  documentoId: number;
  /** The label the documents section shows, to tell the forms apart. */
  documentName: string;
  /** The manual values stored for the document, or null when it has none. */
  manual: ManualFields | null;
  marks: DocumentMarks;
  /** The extraction row, only for the reference beside each field. */
  extracted: ExtractionRowView | null;
}) {
  const t = useTranslations("review.extraction");
  const [last, dispatch, pending] = useActionState(submitForm, null);
  // The previous refusal stays in the state while the next save runs: hide it.
  const failure = pending ? null : last;
  const reference = useReference(extracted);
  const id = useId();

  const errors: DocumentDataErrors =
    failure?.reason === "invalid" ? failure.errors : {};
  const error = (field: keyof DocumentDataErrors) => {
    const code = errors[field];
    return code ? t(`form.errors.${code}`) : undefined;
  };
  const hint = (value: string | null) =>
    value === null ? undefined : t("form.ocrHint", { value });

  const typeItems = [
    { value: UNREGISTERED, label: t("markValues.unregistered") },
    ...TIPOS_DOCUMENTO.map((type) => ({
      value: type,
      label: t(`types.${type}`),
    })),
  ];
  const restId = `${id}-rest`;
  const restHint = hint(reference.rest);
  const restError = error("rest");
  const restDescribedBy = [
    restHint ? `${restId}-hint` : undefined,
    restError ? `${restId}-error` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Collapsible>
      <CollapsibleTrigger
        className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full sm:w-auto`}
      >
        {t("form.open")}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form
          method="post"
          noValidate
          aria-label={t("form.formLabel", { name: documentName })}
          aria-busy={pending}
          className="mt-4 flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending) return;
            const formData = new FormData(event.currentTarget);
            startTransition(() => dispatch(formData));
          }}
        >
          <input type="hidden" name="solicitudId" value={solicitudId} />
          <input type="hidden" name="documentoId" value={documentoId} />
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("form.intro")}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`${id}-studentName`}
              label={t("form.fields.studentName")}
              hint={hint(reference.studentName)}
              error={error("studentName")}
            >
              {(control) => (
                <Input
                  {...control}
                  name="studentName"
                  autoComplete="off"
                  maxLength={NAME_MAX_LENGTH}
                  defaultValue={manual?.studentName ?? ""}
                />
              )}
            </FormField>
            <FormField
              id={`${id}-issuer`}
              label={t("fields.issuer")}
              hint={hint(reference.issuer)}
              error={error("issuer")}
            >
              {(control) => (
                <Input
                  {...control}
                  name="issuer"
                  autoComplete="off"
                  maxLength={ISSUER_MAX_LENGTH}
                  defaultValue={manual?.issuer ?? ""}
                />
              )}
            </FormField>
            <FormField
              id={`${id}-issueDate`}
              label={t("fields.issueDate")}
              hint={hint(reference.issueDate)}
              error={error("issueDate")}
            >
              {(control) => (
                <Input
                  {...control}
                  name="issueDate"
                  type="date"
                  defaultValue={manual?.issueDate ?? ""}
                />
              )}
            </FormField>
          </div>

          <div
            role="group"
            aria-labelledby={`${restId}-label`}
            aria-describedby={restDescribedBy || undefined}
            className="flex flex-col gap-2"
          >
            <span id={`${restId}-label`} className="text-label text-foreground">
              {t("fields.restPeriod")}
            </span>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id={`${restId}-from`}
                label={t("form.fields.restFrom")}
              >
                {(control) => (
                  <Input
                    {...control}
                    name="restFrom"
                    type="date"
                    aria-invalid={restError ? true : undefined}
                    defaultValue={manual?.restFrom ?? ""}
                  />
                )}
              </FormField>
              <FormField id={`${restId}-to`} label={t("form.fields.restTo")}>
                {(control) => (
                  <Input
                    {...control}
                    name="restTo"
                    type="date"
                    aria-invalid={restError ? true : undefined}
                    defaultValue={manual?.restTo ?? ""}
                  />
                )}
              </FormField>
            </div>
            {restHint ? (
              <p
                id={`${restId}-hint`}
                className="text-muted-foreground text-xs"
              >
                {restHint}
              </p>
            ) : null}
            {restError ? (
              <p
                id={`${restId}-error`}
                role="alert"
                className="text-destructive-ink text-sm"
              >
                {restError}
              </p>
            ) : null}
          </div>

          <FormField
            id={`${id}-type`}
            label={t("marks.type")}
            error={error("type")}
          >
            {(control) => (
              <Select
                name="type"
                defaultValue={marks.type ?? UNREGISTERED}
                items={typeItems}
              >
                <SelectTrigger {...control} className="w-full sm:w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <MarkField
            name="hasSignature"
            label={t("marks.signature")}
            defaultValue={markValue(marks.hasSignature)}
            error={error("hasSignature")}
          />
          <MarkField
            name="hasSeal"
            label={t("marks.seal")}
            defaultValue={markValue(marks.hasSeal)}
            error={error("hasSeal")}
          />

          {failure && failure.reason !== "invalid" ? (
            <p role="alert" className={FAILURE}>
              {t(`form.failures.${failure.reason}`)}
            </p>
          ) : null}

          <div>
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={pending}
            >
              {pending ? t("form.saving") : t("form.save")}
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
