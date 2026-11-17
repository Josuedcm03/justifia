"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
  answerEscalationAction,
  type AnswerActionFailure,
} from "@/app/(dashboard)/coordination/[id]/actions";
import {
  EscalationFormDialog,
  NoteField,
  useEscalationAction,
} from "@/app/(dashboard)/review/[id]/dialog-parts";

/**
 * "Responder a la secretaría" (RF-10, E3, RNF-12). Nothing is sent until the
 * coordinator confirms; cancelling or Escape changes nothing and discards the
 * draft. The answer is required, 1 to 1000 characters; the server validates it
 * again. A success redirects to the list, so this component only ever receives
 * refusals. It reuses the staff dialog frame, pointed back at the coordinator
 * list.
 */
export function AnswerForm({ escalamientoId }: { escalamientoId: number }) {
  const t = useTranslations("coordination.answer");
  const ids = useId();
  const [texto, setTexto] = useState("");
  const { failure, setFailure, pending, run } =
    useEscalationAction<AnswerActionFailure>();

  const messages =
    failure?.reason === "invalid"
      ? failure.errors
          .filter((error) => error.field === "texto")
          .map((error) => t(`errors.${error.code as "texto_required"}`))
      : [];
  // A refusal that names no field of this form is shown as a banner.
  const banner =
    failure === null
      ? null
      : failure.reason === "invalid"
        ? messages.length === 0
          ? t("errors.unexpected")
          : null
        : t(`errors.${failure.reason}`);

  return (
    <EscalationFormDialog
      copy={t}
      failure={failure}
      banner={banner}
      pending={pending}
      backHref="/coordination"
      onConfirm={() =>
        run(() => answerEscalationAction({ escalamientoId, texto }))
      }
      onDiscard={() => {
        setTexto("");
        setFailure(null);
      }}
    >
      <NoteField
        id={`${ids}-answer`}
        copy={t}
        value={texto}
        onChange={setTexto}
        messages={messages}
      />
    </EscalationFormDialog>
  );
}
