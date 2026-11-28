"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * The one confirmation of the page (NP-8, RNF-12): a save that deactivates a
 * cause asks first, naming the cause. It is open while `names` is not empty.
 * Built like the dialog mode of `ActiveToggle`: the popup is portalled out of
 * the form, so confirming calls back instead of being a submit button.
 */
export function DeactivateCauseDialog({
  names,
  onConfirm,
  onCancel,
}: {
  names: readonly string[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("parameters.causes.deactivate");
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      open={names.length > 0}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent initialFocus={confirmRef}>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">
            {t("title", { count: names.length, causes: names.join(", ") })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="ghost" size="lg" />}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button
            ref={confirmRef}
            type="button"
            variant="destructive"
            size="lg"
            onClick={onConfirm}
          >
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
