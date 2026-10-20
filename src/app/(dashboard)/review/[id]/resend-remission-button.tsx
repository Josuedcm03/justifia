"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  resendRemissionAction,
  type ResendResult,
} from "@/app/(dashboard)/review/[id]/remission-actions";
import { Button } from "@/components/ui/button";

/**
 * "Reenviar" for one teacher's remission (RF-09 c). The action never
 * revalidates the page (SR-11), so the outcome is written here as text in a
 * live region and the stored state shows on the next load. A sent notice takes
 * the control away: it cannot be sent twice.
 */
export function ResendRemissionButton({
  remisionId,
  teacherName,
}: {
  remisionId: number;
  teacherName: string;
}) {
  const t = useTranslations("review.remission.resend");
  const [result, setResult] = useState<ResendResult | null>(null);
  const [pending, startTransition] = useTransition();
  const sent = result?.ok === true && result.estado === "enviada";

  function resend() {
    setResult(null);
    startTransition(async () => {
      setResult(await resendRemissionAction(remisionId));
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {sent ? null : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          aria-label={t("actionNamed", { name: teacherName })}
          onClick={resend}
        >
          {pending ? t("pending") : t("action")}
        </Button>
      )}
      <p role="status" className="text-sm">
        {result?.ok ? t(`result.${result.estado}`) : null}
      </p>
      {result && !result.ok ? (
        <p role="alert" className="text-destructive-ink text-sm">
          {t(`errors.${result.reason}`)}
        </p>
      ) : null}
    </div>
  );
}
