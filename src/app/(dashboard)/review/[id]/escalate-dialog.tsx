"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
  EscalationFormDialog,
  FieldMessages,
  NoteField,
  useEscalationAction,
  withoutFieldErrors,
  type DialogCopy,
} from "@/app/(dashboard)/review/[id]/dialog-parts";
import { escalateRequestAction } from "@/app/(dashboard)/review/[id]/escalation-actions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ESCALATION_REASONS } from "@/lib/intake/escalation";

/** The motive whose note is the description of the reason (FE-9, FE-10). */
const DESCRIBED_MOTIVE = "otro";

/** The earlier coordination answer the dialog quotes (FE-12). */
export type PreviousAnswer = { text: string; byline: string };

/**
 * "Escalar a coordinación" (RF-10 a, RN-20, RNF-12, E18). Nothing is sent until
 * the secretary confirms; cancelling or Escape changes nothing and discards the
 * draft. The motive (a suspicion about a document, a special case outside the
 * regulation, or another reason) and the note are both required, and no motive
 * is preselected; the server validates the motive against the same closed set.
 * Choosing "otro" swaps the note hint, because there the note is the
 * description of the reason (FE-9, FE-10). When the student's
 * career has no coordination account the action is not offered and the text
 * names the career (E17); the server refuses the same way. A success redirects,
 * so this component only ever receives refusals. When coordination already
 * answered, a soft notice above the motive quotes that answer (FE-12); it is
 * informational, so escalating again stays one confirmation away.
 */
export function EscalateDialog({
  solicitudId,
  unavailableCareer,
  previousAnswer = null,
}: {
  solicitudId: number;
  /** The career name when it has no active coordination account, else null. */
  unavailableCareer: string | null;
  /** The answer that returned the request, quoted for the secretary. */
  previousAnswer?: PreviousAnswer | null;
}) {
  const t = useTranslations("review.escalation");

  if (unavailableCareer !== null) {
    return (
      <p role="note" className="text-muted-foreground max-w-prose text-sm">
        {t("errors.sin_coordinacion", { carrera: unavailableCareer })}
      </p>
    );
  }
  return (
    <EscalateForm solicitudId={solicitudId} previousAnswer={previousAnswer} />
  );
}

function EscalateForm({
  solicitudId,
  previousAnswer,
}: {
  solicitudId: number;
  previousAnswer: PreviousAnswer | null;
}) {
  const t = useTranslations("review.escalation");
  const ids = useId();
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const { failure, setFailure, pending, run } = useEscalationAction();

  const fieldMessages = (field: "motivo" | "nota") =>
    failure?.reason === "invalid"
      ? failure.errors
          .filter((error) => error.field === field)
          .map((error) =>
            t(`errors.${error.code as "nota_required" | "motivo_invalid"}`),
          )
      : [];
  const motivoMessages = fieldMessages("motivo");
  const noteMessages = fieldMessages("nota");

  // A refusal that names no field of this form is shown as a banner.
  const banner =
    failure === null
      ? null
      : failure.reason === "sin_coordinacion"
        ? t("errors.sin_coordinacion", { carrera: failure.carreraNombre })
        : failure.reason === "invalid"
          ? motivoMessages.length + noteMessages.length === 0
            ? t("errors.unexpected")
            : null
          : t(`errors.${failure.reason}`);

  // The note's hint follows the motive: for "otro" the note is the description.
  const noteCopy: DialogCopy = (key, values) =>
    key === "dialog.noteHint" && motivo === DESCRIBED_MOTIVE
      ? t("dialog.noteHintOtro")
      : t(key, values);

  const motivoErrorId = `${ids}-motivo-error`;
  const motivoLabelId = `${ids}-motivo-label`;

  return (
    <EscalationFormDialog
      copy={t}
      failure={failure}
      banner={banner}
      pending={pending}
      onConfirm={() =>
        run(() => escalateRequestAction({ solicitudId, motivo, nota }))
      }
      onDiscard={() => {
        setMotivo("");
        setNota("");
        setFailure(null);
      }}
    >
      {previousAnswer ? (
        <div
          role="note"
          className="border-border bg-muted flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <p className="text-foreground font-medium">
            {t("dialog.previousAnswer.title", {
              byline: previousAnswer.byline,
            })}
          </p>
          <p
            tabIndex={0}
            className="max-h-32 overflow-y-auto break-words whitespace-pre-wrap"
          >
            {previousAnswer.text}
          </p>
          <p className="text-muted-foreground text-xs">
            {t("dialog.previousAnswer.hint")}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <span id={motivoLabelId} className="text-label text-foreground">
          {t("dialog.motivoLabel")}
        </span>
        <RadioGroup
          value={motivo}
          onValueChange={(value) => {
            setMotivo(String(value));
            setFailure((current) => withoutFieldErrors(current, "motivo"));
          }}
          aria-labelledby={motivoLabelId}
          aria-invalid={motivoMessages.length > 0 || undefined}
          aria-describedby={
            motivoMessages.length > 0 ? motivoErrorId : undefined
          }
        >
          {ESCALATION_REASONS.map((reason) => (
            <label
              key={reason}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <RadioGroupItem value={reason} />
              {t(`dialog.motivo.${reason}`)}
            </label>
          ))}
        </RadioGroup>
        <FieldMessages id={motivoErrorId} messages={motivoMessages} />
      </div>
      <NoteField
        id={`${ids}-note`}
        copy={noteCopy}
        value={nota}
        onChange={(value) => {
          setNota(value);
          setFailure((current) => withoutFieldErrors(current, "nota"));
        }}
        messages={noteMessages}
        required
      />
    </EscalationFormDialog>
  );
}
