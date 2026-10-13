import { useTranslations } from "next-intl";
import { useId } from "react";

/**
 * The reason a request was returned and the secretary's message, above every
 * step of the correction (SR-17). Informative, so `role="status"`, in the alert
 * pattern of the design system. The reason only guides the start; nothing in
 * the flow depends on it.
 */
export function CorrectionReasonBanner({
  motivo,
  texto,
}: {
  motivo: string | null;
  texto: string | null;
}) {
  const t = useTranslations("intake.correction.banner");
  const labels = useTranslations("requests.detail");
  const reasonKey = `reasons.${motivo}`;
  const titleId = useId();

  return (
    <div
      role="status"
      aria-labelledby={titleId}
      className="border-warning/30 border-l-warning bg-warning/8 text-warning-ink flex flex-col gap-1 rounded-lg border border-l-4 px-3 py-2 text-sm"
    >
      <p id={titleId} className="font-medium">
        {t("title")}
      </p>
      {motivo ? (
        <p className="break-words">
          {t("reason", {
            reason: labels.has(reasonKey) ? labels(reasonKey) : motivo,
          })}
        </p>
      ) : null}
      {texto ? (
        <p className="break-words whitespace-pre-wrap">{texto}</p>
      ) : null}
    </div>
  );
}
