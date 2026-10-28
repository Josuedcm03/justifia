"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
  EscalationFormDialog,
  FieldMessages,
  NoteField,
  useEscalationAction,
} from "@/app/(dashboard)/review/[id]/dialog-parts";
import { recordExcessReportAction } from "@/app/(dashboard)/review/[id]/escalation-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EscalationError } from "@/lib/intake/escalation";

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
 * success redirects to this same route, so this component only receives
 * refusals; the section keys it on the recorded reports, which remounts it
 * closed and empty once the new report is shown.
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
  const [remisionId, setRemisionId] = useState("");
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const { failure, setFailure, pending, run } = useEscalationAction();

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
  const banner =
    failure === null || failure.reason === "invalid"
      ? null
      : failure.reason === "sin_coordinacion"
        ? t("errors.unexpected")
        : t(`errors.${failure.reason}`);

  return (
    <EscalationFormDialog
      copy={t}
      failure={failure}
      banner={banner}
      pending={pending}
      onConfirm={() =>
        run(() =>
          recordExcessReportAction({
            solicitudId,
            remisionId: remisionId === "" ? null : Number(remisionId),
            comunicadoEl: fecha,
            nota,
          }),
        )
      }
      onDiscard={() => {
        setRemisionId("");
        setFecha("");
        setNota("");
        setFailure(null);
      }}
    >
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
        <FieldMessages id={`${ids}-teacher-error`} messages={teacherMessages} />
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

      <NoteField
        id={`${ids}-note`}
        copy={t}
        value={nota}
        onChange={setNota}
        messages={messagesFor("nota")}
      />
    </EscalationFormDialog>
  );
}
