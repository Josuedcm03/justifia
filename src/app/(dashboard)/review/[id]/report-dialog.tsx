"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import {
  recordExcessReportAction,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ESCALATION_NOTE_MAX,
  type EscalationError,
} from "@/lib/intake/escalation";

const SELECT =
  "border-input bg-card text-foreground focus-visible:border-primary focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/30 min-h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-3 aria-invalid:ring-3 md:text-sm";

export type ReportTeacher = {
  /** The request's own remission row that names the teacher. */
  remisionId: number;
  nombre: string;
};

/**
 * "Registrar reporte de inasistencias" (RF-15, RNF-12). The teacher is one of
 * the request's remitted teachers, the date cannot be later than today (the
 * input's `max`; the server validates it again) and the note is optional.
 * There is no percentage or count of absences to enter. Nothing is recorded
 * until the secretary confirms; cancelling or Escape discards the draft. A
 * success redirects to the detail, so this component only receives refusals.
 */
export function ReportDialog({
  solicitudId,
  teachers,
  maxDate,
}: {
  solicitudId: number;
  teachers: readonly ReportTeacher[];
  /** Today in Managua, `YYYY-MM-DD`, resolved by the page. */
  maxDate: string;
}) {
  const t = useTranslations("review.report");
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [remisionId, setRemisionId] = useState("");
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const [failure, setFailure] = useState<EscalationActionFailure | null>(null);
  const [pending, startTransition] = useTransition();

  if (teachers.length === 0) {
    return (
      <p role="note" className="text-muted-foreground max-w-prose text-sm">
        {t("section.noTeachers")}
      </p>
    );
  }

  const messagesFor = (field: EscalationError["field"]) =>
    failure?.reason === "invalid"
      ? failure.errors
          .filter((error) => error.field === field)
          .map((error) => t(`errors.${error.code as "date_invalid"}`))
      : [];
  const teacherMessages = messagesFor("docente");
  const dateMessages = messagesFor("comunicadoEl");
  const noteMessages = messagesFor("nota");
  const banner =
    failure === null || failure.reason === "invalid"
      ? null
      : failure.reason === "sin_coordinacion"
        ? t("errors.unexpected")
        : t(`errors.${failure.reason}`);
  const backToQueue =
    failure?.reason === "conflict" || failure?.reason === "not_found";

  function reset() {
    setRemisionId("");
    setFecha("");
    setNota("");
    setFailure(null);
  }

  function confirm() {
    setFailure(null);
    startTransition(async () => {
      const result = await recordExcessReportAction({
        solicitudId,
        remisionId: remisionId === "" ? null : Number(remisionId),
        comunicadoEl: fecha,
        nota,
      });
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
        if (!next) reset();
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
          <Label htmlFor={`${ids}-teacher`}>{t("dialog.teacherLabel")}</Label>
          <select
            id={`${ids}-teacher`}
            value={remisionId}
            onChange={(event) => setRemisionId(event.target.value)}
            aria-invalid={teacherMessages.length > 0 || undefined}
            aria-describedby={
              teacherMessages.length > 0 ? `${ids}-teacher-error` : undefined
            }
            className={SELECT}
          >
            <option value="">{t("dialog.teacherPlaceholder")}</option>
            {teachers.map((teacher) => (
              <option key={teacher.remisionId} value={teacher.remisionId}>
                {teacher.nombre}
              </option>
            ))}
          </select>
          <FieldMessages
            id={`${ids}-teacher-error`}
            messages={teacherMessages}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-date`}>{t("dialog.dateLabel")}</Label>
          <Input
            id={`${ids}-date`}
            type="date"
            max={maxDate}
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            aria-invalid={dateMessages.length > 0 || undefined}
            aria-describedby={
              dateMessages.length > 0 ? `${ids}-date-error` : undefined
            }
            className="min-h-11"
          />
          <FieldMessages id={`${ids}-date-error`} messages={dateMessages} />
        </div>

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
