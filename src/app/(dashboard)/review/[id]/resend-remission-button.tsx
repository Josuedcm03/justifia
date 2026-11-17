"use client";

import { resendRemissionAction } from "@/app/(dashboard)/review/[id]/remission-actions";
import { ResendButton } from "@/app/(dashboard)/review/[id]/resend-button";

/** "Reenviar" for one teacher's remission (RF-09 c). */
export function ResendRemissionButton({
  remisionId,
  teacherName,
}: {
  remisionId: number;
  teacherName: string;
}) {
  return (
    <ResendButton
      namespace="review.remission.resend"
      name={teacherName}
      resend={() => resendRemissionAction(remisionId)}
    />
  );
}
