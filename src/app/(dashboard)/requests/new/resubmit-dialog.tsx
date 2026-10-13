"use client";

import { useTranslations } from "next-intl";

import type { ActionResult } from "@/app/(dashboard)/requests/new/actions";
import { ConfirmDialog } from "@/app/(dashboard)/requests/new/confirm-dialog";
import type { FieldError } from "@/lib/validations/solicitud";

/** Confirmation before a corrected request goes back to review (RNF-12). */
export function ResubmitDialog({
  action,
  onErrors,
}: {
  action: () => Promise<ActionResult>;
  onErrors: (errors: FieldError[]) => void;
}) {
  const t = useTranslations("intake");

  return (
    <ConfirmDialog
      texts={{
        trigger: t("correction.resubmit.button"),
        title: t("correction.resubmit.title"),
        description: t("correction.resubmit.description"),
        confirm: t("correction.resubmit.confirm"),
        pending: t("correction.resubmit.pending"),
        cancel: t("review.cancel"),
      }}
      action={action}
      onErrors={onErrors}
    />
  );
}
