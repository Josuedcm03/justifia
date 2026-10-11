"use client";

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/app/(dashboard)/requests/new/actions";
import type { FieldError } from "@/lib/validations/solicitud";

export type ConfirmTexts = {
  trigger: string;
  title: string;
  description: string;
  confirm: string;
  pending: string;
  cancel: string;
};

/**
 * Shared frame of the submit and discard dialogs (RNF-12): nothing happens until
 * the student confirms, and cancelling or Escape changes nothing. The dialog
 * stays open while the action runs (no double run); a success redirects away,
 * a refusal closes it and hands the errors to the page.
 */
export function ConfirmDialog({
  texts,
  destructive = false,
  action,
  onErrors,
}: {
  texts: ConfirmTexts;
  destructive?: boolean;
  action: () => Promise<ActionResult>;
  onErrors: (errors: FieldError[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setOpen(false);
        onErrors(result.errors);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            size="lg"
            variant={destructive ? "secondary" : "default"}
            className="w-full sm:w-auto"
          />
        }
      >
        {texts.trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{texts.title}</AlertDialogTitle>
          <AlertDialogDescription>{texts.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            render={<Button variant="ghost" size="lg" />}
          >
            {texts.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            size="lg"
            variant={destructive ? "destructive" : "default"}
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
