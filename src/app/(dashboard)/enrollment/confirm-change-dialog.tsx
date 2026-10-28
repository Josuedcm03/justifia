"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type {
  EnrollmentActionResult,
  EnrollmentErrorCode,
} from "@/lib/enrollment/types";

export type ConfirmChangeTexts = {
  title: string;
  description: string;
  /** Present only when a draft or returned request uses the group (D5). It
   *  informs; it never blocks the confirmation. */
  warning?: string;
  confirm: string;
  pending: string;
};

/**
 * Confirmation before an enrollment change that deactivates a group: a drop or
 * a replace (RNF-12). The parent mounts it while a change is awaiting an answer
 * and supplies the texts, so one frame serves both. Nothing runs until the
 * student confirms; cancel and Escape only close. The dialog stays open while
 * the action works, and a refusal shows its error inside it and leaves the
 * dialog usable (the data is unchanged).
 */
export function ConfirmChangeDialog({
  texts,
  action,
  onClose,
}: {
  texts: ConfirmChangeTexts;
  action: () => Promise<EnrollmentActionResult>;
  onClose: () => void;
}) {
  const t = useTranslations("enrollment");
  const [error, setError] = useState<EnrollmentErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">
            {texts.title}
          </AlertDialogTitle>
          <AlertDialogDescription>{texts.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {texts.warning ? (
          <p className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm">
            {texts.warning}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
          >
            {t(`errors.${error}`)}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            render={<Button variant="ghost" size="lg" />}
          >
            {t("dialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            size="lg"
            variant="destructive"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? texts.pending : texts.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
