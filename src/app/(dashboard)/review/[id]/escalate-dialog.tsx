"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
  EscalationFormDialog,
  NoteField,
  useEscalationAction,
} from "@/app/(dashboard)/review/[id]/dialog-parts";
import { escalateRequestAction } from "@/app/(dashboard)/review/[id]/escalation-actions";

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
  const [nota, setNota] = useState("");
  const { failure, setFailure, pending, run } = useEscalationAction();

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

  return (
    <EscalationFormDialog
      copy={t}
      failure={failure}
      banner={banner}
      pending={pending}
      onConfirm={() => run(() => escalateRequestAction({ solicitudId, nota }))}
      onDiscard={() => {
        setNota("");
        setFailure(null);
      }}
    >
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
