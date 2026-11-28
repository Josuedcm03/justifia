"use client";

import { cn } from "cn";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { IntakeLimits } from "@/lib/parameters/derive";
import type { FieldError } from "@/lib/validations/solicitud";

// Shared pieces of the intake steps. Errors come from the server actions as
// `intake.errors.<code>` keys (RF-03); here they are only translated and tied to
// their field: the message sits directly under it with `role="alert"` and the
// control points at it (docs/design-system.md: Form).

export function errorsOf(
  errors: readonly FieldError[],
  field: string,
): FieldError[] {
  return errors.filter((error) => error.field === field);
}

/** `aria-*` for a control whose messages `FieldErrors` renders under `id`. */
export function invalidProps(id: string, errors: readonly FieldError[]) {
  return errors.length > 0
    ? ({ "aria-invalid": true, "aria-describedby": `${id}-error` } as const)
    : {};
}

/**
 * The values a message may state (NP-17, A13): the filing window in days and
 * the size limit in MB. Error keys stay parameterless on the wire; the server
 * hands the values in force down as props and a message uses the ones it names.
 */
export type ErrorValues = { days: number; size: number };

/** The values of the limits in force; absent where there is nothing to state. */
export function errorValuesOf(limits?: IntakeLimits): ErrorValues | undefined {
  return limits
    ? { days: limits.filingWindowDays, size: limits.maxDocumentMib }
    : undefined;
}

export function FieldErrors({
  id,
  errors,
  values,
}: {
  id: string;
  errors: readonly FieldError[];
  values?: ErrorValues;
}) {
  const t = useTranslations();
  if (errors.length === 0) return null;

  return (
    <div
      id={`${id}-error`}
      role="alert"
      className="text-destructive-ink flex flex-col gap-1 text-sm"
    >
      {errors.map((error, index) => (
        <p key={`${error.key}-${index}`}>{t(error.key, values)}</p>
      ))}
    </div>
  );
}

/** Label above the control, messages below it. */
export function Field({
  id,
  label,
  errors,
  values,
  htmlFor,
  children,
}: {
  id: string;
  label: string;
  errors: readonly FieldError[];
  /** The values the field's messages may state. */
  values?: ErrorValues;
  /** Omitted for a group of controls, which `aria-labelledby` the label. */
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label id={`${id}-label`} htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      <FieldErrors id={id} errors={errors} values={values} />
    </div>
  );
}

/** Frame of one step: title and lead, the body, then the navigation row. */
export function StepShell({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="w-full max-w-2xl [--card-spacing:--spacing(6)]">
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-headline">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {children}
      </CardContent>
      <CardFooter className="border-border flex flex-col-reverse gap-3 border-t py-4 sm:flex-row sm:justify-between">
        {footer}
      </CardFooter>
    </Card>
  );
}

/** Back to an earlier step: navigation, so a link, not a button. */
export function BackLink({ href }: { href: string }) {
  const t = useTranslations("intake.actions");
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "lg" }),
        "w-full sm:w-auto",
      )}
    >
      {t("back")}
    </Link>
  );
}

/** Forward to the next step without saving: a link, as its target saves nothing. */
export function ContinueLink({ href }: { href: string }) {
  const t = useTranslations("intake.actions");
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
    >
      {t("next")}
    </Link>
  );
}
