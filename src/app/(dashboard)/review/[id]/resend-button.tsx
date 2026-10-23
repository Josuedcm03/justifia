"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

// The "Reenviar" control the teacher remission and the coordination notice
// share (RF-09 c, RF-10 b). Each wrapper supplies its action and its text
// namespace. The action never revalidates the page (SR-11), so the outcome is
// written here as text in a live region and the stored state shows on the next
// load. A sent notice takes the control away: it cannot be sent twice.

export type ResendOutcome =
  | {
      ok: true;
      estado: "pendiente" | "enviada" | "bloqueada";
      motivo: string | null;
    }
  | { ok: false; reason: "not_found" | "unexpected" };

export function ResendButton({
  namespace,
  name,
  resend,
}: {
  /** Catalog scope with `action`, `actionNamed`, `pending`, `result`, `errors`. */
  namespace: "review.remission.resend" | "review.escalation.resend";
  /** What the control resends, for its accessible name. */
  name: string;
  resend: () => Promise<ResendOutcome>;
}) {
  const t = useTranslations(namespace);
  const [result, setResult] = useState<ResendOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const sent = result?.ok === true && result.estado === "enviada";

  function run() {
    setResult(null);
    startTransition(async () => {
      setResult(await resend());
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
          aria-label={t("actionNamed", { name })}
          onClick={run}
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
