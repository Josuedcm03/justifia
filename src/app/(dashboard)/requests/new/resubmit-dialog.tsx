"use client";

import { useTranslations } from "next-intl";

import type { ActionResult } from "@/app/(dashboard)/requests/new/actions";
import { ConfirmDialog } from "@/app/(dashboard)/requests/new/confirm-dialog";
import { FileOriginMark } from "@/app/(dashboard)/requests/new/file-origin-mark";
import type { FieldError } from "@/lib/validations/solicitud";

type ResubmitDocument = { id: number; nombreOriginal: string };

/**
 * Confirmation before a corrected request goes back to review (RNF-12). It
 * names the files the resubmission will carry, each with where it comes from
 * (FE-16); confirming still resubmits the same request, with no extra step.
 */
export function ResubmitDialog({
  action,
  onErrors,
  documents = [],
  previousDocumentIds,
}: {
  action: () => Promise<ActionResult>;
  onErrors: (errors: FieldError[]) => void;
  /** The current documents, retired ones already left out; none lists nothing. */
  documents?: readonly ResubmitDocument[];
  /** The ids of the returned version; null when it could not be read. */
  previousDocumentIds?: readonly number[] | null;
}) {
  const t = useTranslations("intake");

  return (
    <ConfirmDialog
      texts={{
        trigger: t("correction.resubmit.button"),
        title: t("correction.resubmit.title"),
        description: t("correction.resubmit.description"),
        confirm: t("correction.resubmit.confirm"),
        pending: t("correction.resubmit.pending"),
        cancel: t("review.cancel"),
      }}
      action={action}
      onErrors={onErrors}
    >
      {documents.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {t("correction.resubmit.filesTitle")}
          </p>
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 text-sm break-words">
                  {doc.nombreOriginal}
                </span>
                <FileOriginMark
                  documentId={doc.id}
                  previousIds={previousDocumentIds}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </ConfirmDialog>
  );
}
