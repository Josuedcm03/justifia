"use client";

import { upload } from "@vercel/blob/client";
import { Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";

import {
  finalizeDocumentAction,
  removeDocumentAction,
} from "@/app/(dashboard)/requests/new/actions";
import { formatFileSize } from "@/app/(dashboard)/catalog/import/file-dropzone";
import {
  BackLink,
  ContinueLink,
  FieldErrors,
  StepShell,
} from "@/app/(dashboard)/requests/new/form-field";
import { stepHref } from "@/app/(dashboard)/requests/new/steps";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_DRAFT,
} from "@/lib/intake/limits";
import { buildPathname } from "@/lib/intake/pathnames";
import type { TipoDetectado } from "@/lib/intake/signature";

const UPLOAD_TOKEN_URL = "/api/intake/upload-token";
const BYTES_PER_MB = 1024 * 1024;

// Extension of the pathname, from the type the browser reports. Only a hint:
// finalize reads the stored bytes and decides the real format (D3).
const EXTENSIONS: Record<string, TipoDetectado> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpeg",
};

// Same `intake.errors.<code>` keys the actions return; built here instead of
// importing `errorKey` so the zod schemas stay out of the client bundle.
const errorKey = (code: string) => `intake.errors.${code}`;

/** Cheap checks that spare a doomed upload; the server repeats them all. */
function precheck(file: File): string | null {
  if (!Object.hasOwn(EXTENSIONS, file.type)) return "unsupported_format";
  if (file.size === 0) return "empty_file";
  if (file.size > MAX_DOCUMENT_BYTES) return "too_large";
  return null;
}

type AttachedDocument = {
  id: number;
  nombreOriginal: string;
  tamanoBytes: number;
};

/**
 * Step 3: supporting documents (RF-02, RN-03, RN-04, D12). The file goes from
 * the browser straight to the private store with a short-lived token and never
 * crosses a Next function (D2); then the server finalizes it by reading the
 * stored bytes. The list comes from the draft, so after every change the page
 * is re-read instead of keeping a second copy here.
 */
export function DocumentsStep({
  draftId,
  documents,
  fromReview = false,
}: {
  draftId: number;
  documents: readonly AttachedDocument[];
  fromReview?: boolean;
}) {
  const t = useTranslations("intake");
  const tErrors = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = documents.length >= MAX_DOCUMENTS_PER_DRAFT;
  const busy = uploading !== null || removing;

  async function attach(file: File) {
    setError(null);
    const refused = precheck(file);
    if (refused) return setError(errorKey(refused));

    setUploading(file.name);
    try {
      const pathname = buildPathname(
        draftId,
        crypto.randomUUID(),
        EXTENSIONS[file.type],
      );
      await upload(pathname, file, {
        access: "private",
        handleUploadUrl: UPLOAD_TOKEN_URL,
        contentType: file.type,
      });
      const result = await finalizeDocumentAction({
        pathname,
        nombreOriginal: file.name,
      });
      if (!result.ok) {
        setError(result.errors[0]?.key ?? errorKey("upload_failed"));
      }
    } catch {
      // The SDK hides why the token route refused (it throws a generic error),
      // so the message is generic; the refresh below shows the real state.
      setError(errorKey("upload_failed"));
    } finally {
      setUploading(null);
      router.refresh();
    }
  }

  async function remove(documentId: number) {
    setError(null);
    setRemoving(true);
    try {
      const result = await removeDocumentAction(documentId);
      if (!result.ok) setError(result.errors[0].key);
    } finally {
      setRemoving(false);
      router.refresh();
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    // Reset so that choosing the same file again fires `change` again.
    event.target.value = "";
    if (chosen && !busy) void attach(chosen);
  }

  return (
    <StepShell
      title={t("documents.title")}
      description={t("documents.description")}
      footer={
        <>
          <BackLink href={stepHref(fromReview ? 4 : 2)} />
          <ContinueLink href={stepHref(4)} />
        </>
      }
    >
      <p className="text-muted-foreground text-sm">
        {t("documents.hint", {
          size: MAX_DOCUMENT_BYTES / BYTES_PER_MB,
          max: MAX_DOCUMENTS_PER_DRAFT,
        })}
      </p>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          {t("documents.count", {
            count: documents.length,
            max: MAX_DOCUMENTS_PER_DRAFT,
          })}
        </p>
        {documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("documents.empty")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="border-border flex items-center gap-3 border-b py-2 last:border-b-0"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm" title={doc.nombreOriginal}>
                    {doc.nombreOriginal}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatFileSize(doc.tamanoBytes, locale)}
                  </span>
                </span>
                <a
                  href={`/api/intake/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("documents.viewNamed", {
                    name: doc.nombreOriginal,
                  })}
                  className={`${buttonVariants({ variant: "ghost", size: "sm" })} shrink-0`}
                >
                  {t("documents.view")}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  disabled={busy}
                  aria-label={t("documents.remove", {
                    name: doc.nombreOriginal,
                  })}
                  onClick={() => void remove(doc.id)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        ref={picker}
        type="file"
        accept={ALLOWED_CONTENT_TYPES.join(",")}
        tabIndex={-1}
        aria-label={t("documents.add")}
        className="sr-only"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full sm:w-auto sm:self-start"
        disabled={busy || full}
        onClick={() => picker.current?.click()}
      >
        {t("documents.add")}
      </Button>

      {/* Always mounted, so a screen reader hears the text arrive. */}
      <p role="status" className="text-sm break-words">
        {uploading
          ? t("documents.uploading", { name: uploading })
          : full
            ? tErrors(errorKey("too_many_documents"))
            : null}
      </p>
      <FieldErrors
        id="documents"
        errors={error ? [{ field: "documents", key: error }] : []}
      />
    </StepShell>
  );
}
