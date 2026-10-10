"use client";

import { useTranslations } from "next-intl";

import { discardDraftAction } from "@/app/(dashboard)/requests/new/actions";
import { ConfirmDialog } from "@/app/(dashboard)/requests/new/confirm-dialog";
import type { FieldError } from "@/lib/validations/solicitud";

/** Confirmation before the draft, its subjects and files are deleted (RNF-12). */
export function DiscardDialog({
  onErrors,
}: {
  onErrors: (errors: FieldError[]) => void;
}) {
  const t = useTranslations("intake.review");

  return (
    <ConfirmDialog
      destructive
      texts={{
        trigger: t("discard.button"),
        title: t("discard.title"),
        description: t("discard.description"),
        confirm: t("discard.confirm"),
        pending: t("discard.pending"),
        cancel: t("cancel"),
      }}
      action={discardDraftAction}
      onErrors={onErrors}
    />
  );
}
