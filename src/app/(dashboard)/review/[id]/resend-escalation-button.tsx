"use client";

import { resendEscalationNoticeAction } from "@/app/(dashboard)/review/[id]/escalation-actions";
import { ResendButton } from "@/app/(dashboard)/review/[id]/resend-button";

/**
 * "Reenviar" for the notice to coordination of one escalation or absence report
 * (RF-10 b). Offered by the sections for any notice that is not `enviada`;
 * `label` tells the notices of a request apart for assistive technology.
 */
export function ResendEscalationButton({
  escalamientoId,
  label,
}: {
  escalamientoId: number;
  label: string;
}) {
  return (
    <ResendButton
      namespace="review.escalation.resend"
      name={label}
      resend={() => resendEscalationNoticeAction(escalamientoId)}
    />
  );
}
