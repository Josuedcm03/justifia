"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import {
  escalateRequestAction,
  type EscalationActionFailure,
} from "@/app/(dashboard)/review/[id]/escalation-actions";
import {
  DIALOG_ALERT,
  DIALOG_TEXTAREA,
  FieldMessages,
} from "@/app/(dashboard)/review/[id]/escalation-dialog-parts";
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
import { Label } from "@/components/ui/label";
import { ESCALATION_NOTE_MAX } from "@/lib/intake/escalation";

/**
 * "Escalar a coordinación" (RF-10 a, RN-20, RNF-12). Nothing is sent until the
 * secretary confirms; cancelling or Escape changes nothing and discards the
 * draft. The note is required, the reason is fixed by the server and never sent.
 * When the student's career has no coordination account the action is not
 * offered and the text names the career (E17); the server refuses the same way.
 * A success redirects, so this component only ever receives refusals.
 */
export function EscalateDialog({
  solicitudId,
  unavailableCareer,
}: {
  solicitudId: number;
  /** The career name when it has no active coordination account, else null. */
  unavailableCareer: string | null;
}) {
  const t = useTranslations("review.escalation");

  if (unavailableCareer !== null) {
    return (
      <p role="note" className="text-muted-foreground max-w-prose text-sm">
        {t("errors.sin_coordinacion", { carrera: unavailableCareer })}
      </p>
    );
  }
  return <EscalateForm solicitudId={solicitudId} />;
}

function EscalateForm({ solicitudId }: { solicitudId: number }) {
  const t = useTranslations("review.escalation");
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [nota, setNota] = useState("");
  const [failure, setFailure] = useState<EscalationActionFailure | null>(null);
  const [pending, startTransition] = useTransition();

  const noteMessages =
    failure?.reason === "invalid"
      ? failure.errors
          .filter((error) => error.field === "nota")
          .map((error) => t(`errors.${error.code as "nota_required"}`))
      : [];
  // A refusal that names no field of this form is shown as a banner.
  const banner =
    failure === null
      ? null
      : failure.reason === "sin_coordinacion"
        ? t("errors.sin_coordinacion", { carrera: failure.carreraNombre })
        : failure.reason === "invalid"
          ? noteMessages.length === 0
            ? t("errors.motivo_invalid")
            : null
          : t(`errors.${failure.reason}`);
  const backToQueue =
    failure?.reason === "conflict" || failure?.reason === "not_found";

  function confirm() {
    setFailure(null);
    startTransition(async () => {
      const result = await escalateRequestAction({ solicitudId, nota });
      // A success never resolves here: the action redirects.
      if (result) setFailure(result);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) {
          setNota("");
          setFailure(null);
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
          />
        }
      >
        {t("dialog.trigger")}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("dialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {banner ? (
          <div role="alert" className={DIALOG_ALERT}>
            <p>{banner}</p>
            {backToQueue ? (
              <Link
                href="/review"
                prefetch={false}
                className="text-primary w-fit font-medium underline underline-offset-4"
              >
                {t("dialog.backToQueue")}
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-note`}>{t("dialog.noteLabel")}</Label>
          <textarea
            id={`${ids}-note`}
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            aria-invalid={noteMessages.length > 0 || undefined}
            aria-describedby={
              noteMessages.length > 0 ? `${ids}-note-error` : `${ids}-note-hint`
            }
            className={DIALOG_TEXTAREA}
          />
          <div className="flex items-start justify-between gap-3">
            <p
              id={`${ids}-note-hint`}
              className="text-muted-foreground text-xs"
            >
              {t("dialog.noteHint")}
            </p>
            <p
              className={
                nota.length > ESCALATION_NOTE_MAX
                  ? "text-destructive-ink text-xs tabular-nums"
                  : "text-muted-foreground text-xs tabular-nums"
              }
            >
              {t("dialog.counter", { count: nota.length })}
            </p>
          </div>
          <FieldMessages id={`${ids}-note-error`} messages={noteMessages} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            render={<Button variant="ghost" size="lg" />}
          >
            {t("dialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction size="lg" disabled={pending} onClick={confirm}>
            {pending ? t("dialog.pending") : t("dialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
