"use client";

import { useTranslations } from "next-intl";

import { submitRequestAction } from "@/app/(dashboard)/requests/new/actions";
import { ConfirmDialog } from "@/app/(dashboard)/requests/new/confirm-dialog";
import type { FieldError } from "@/lib/validations/solicitud";

/**
 * Confirmation before the draft becomes a request (RNF-12). `consentVersion` is
 * the version of the text the student showed consent to: the current one while
 * the box is checked, `null` otherwise. The server decides from it alone (RC-5).
 */
export function SubmitDialog({
  consentVersion,
  onErrors,
}: {
  consentVersion: string | null;
  onErrors: (errors: FieldError[]) => void;
}) {
  const t = useTranslations("intake.review");

  return (
    <ConfirmDialog
      texts={{
        trigger: t("submit.button"),
        title: t("submit.title"),
        description: t("submit.description"),
        confirm: t("submit.confirm"),
        pending: t("submit.pending"),
        cancel: t("cancel"),
      }}
      action={() => submitRequestAction({ consentVersion })}
      onErrors={onErrors}
    />
  );
}
