"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
  EscalationFormDialog,
  FieldMessages,
  NoteField,
  useEscalationAction,
} from "@/app/(dashboard)/review/[id]/dialog-parts";
import { escalateRequestAction } from "@/app/(dashboard)/review/[id]/escalation-actions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ESCALATION_REASONS } from "@/lib/intake/escalation";

/**
 * "Escalar a coordinación" (RF-10 a, RN-20, RNF-12, E18). Nothing is sent until
 * the secretary confirms; cancelling or Escape changes nothing and discards the
 * draft. The motive (a suspicion about a document, or a special case outside the
 * regulation) and the note are both required, and no motive is preselected; the
 * server validates the motive against the same closed set. When the student's
 * career has no coordination account the action is not offered and the text
 * names the career (E17); the server refuses the same way. A success redirects,
 * so this component only ever receives refusals.
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
      <div className="flex flex-col gap-2">
        <span id={motivoLabelId} className="text-label text-foreground">
          {t("dialog.motivoLabel")}
        </span>
        <RadioGroup
          value={motivo}
          onValueChange={(value) => setMotivo(String(value))}
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
        copy={t}
        value={nota}
        onChange={setNota}
        messages={noteMessages}
      />
    </EscalationFormDialog>
  );
}
