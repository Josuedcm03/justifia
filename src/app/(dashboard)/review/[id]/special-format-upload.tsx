"use client";

import { upload } from "@vercel/blob/client";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useRef, useState } from "react";

import { attachSpecialFormatAction } from "@/app/(dashboard)/review/[id]/remission-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { ALLOWED_CONTENT_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/intake/limits";
import { buildPathname } from "@/lib/intake/pathnames";
import type { TipoDetectado } from "@/lib/intake/signature";

// The signed special format of RN-19 (teacher-remission, TR-14, TR-15). The
// file goes from the browser straight to the private store with a short-lived
// token (a function body is capped well below 10 MiB); the server action then
// reads the stored bytes. The action never revalidates the page (SR-11), so
// the result is written here as text and the stored state shows on reload.
// There is no replace or remove control: one format per request.

const TOKEN_URL = "/api/review/special-format-token";
const BYTES_PER_MB = 1024 * 1024;

// Extension of the pathname, from the type the browser reports. Only a hint:
// the server reads the stored bytes and decides the real format.
const EXTENSIONS: Record<string, TipoDetectado> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpeg",
};

const ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

/** Cheap checks that spare a doomed upload; the server repeats them all. */
function precheck(file: File): string | null {
  if (!Object.hasOwn(EXTENSIONS, file.type)) return "unsupported_format";
  if (file.size === 0) return "empty_file";
  if (file.size > MAX_DOCUMENT_BYTES) return "too_large";
  return null;
}

type AttachedFormat = { id: number; nombreOriginal: string };

export function SpecialFormatUpload({
  solicitudId,
  attached,
}: {
  solicitudId: number;
  /** The format already stored for the request, if any. */
  attached: AttachedFormat | null;
}) {
  const t = useTranslations("review.remission.upload");
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AttachedFormat | null>(null);
  const current = attached ?? done;

  async function attach(file: File) {
    setError(null);
    const refused = precheck(file);
    if (refused) return setError(refused);

    setUploading(file.name);
    try {
      const pathname = buildPathname(
        solicitudId,
        crypto.randomUUID(),
        EXTENSIONS[file.type],
      );
      await upload(pathname, file, {
        access: "private",
        handleUploadUrl: TOKEN_URL,
        contentType: file.type,
      });
      const result = await attachSpecialFormatAction(solicitudId, {
        pathname,
        nombreOriginal: file.name,
      });
      if (result.ok)
        setDone({ id: result.documentId, nombreOriginal: file.name });
      else setError(result.reason);
    } catch {
      // The SDK hides why the token route refused, so the message is generic.
      setError("upload_failed");
    } finally {
      setUploading(null);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    // Reset so that choosing the same file again fires `change` again.
    event.target.value = "";
    if (chosen && uploading === null) void attach(chosen);
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">{t("title")}</h3>
      {current ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{t("attached")}</span>
          <a
            href={`/api/intake/documents/${current.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full justify-start break-all sm:w-auto sm:self-start`}
          >
            {current.nombreOriginal}
          </a>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("hint", { size: MAX_DOCUMENT_BYTES / BYTES_PER_MB })}
          </p>
          <input
            ref={picker}
            type="file"
            accept={ALLOWED_CONTENT_TYPES.join(",")}
            tabIndex={-1}
            aria-label={t("action")}
            className="sr-only"
            onChange={handleChange}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto sm:self-start"
            disabled={uploading !== null}
            onClick={() => picker.current?.click()}
          >
            {t("action")}
          </Button>
        </>
      )}
      {/* Always mounted, so a screen reader hears the text arrive. */}
      <p role="status" className="text-sm break-words">
        {done
          ? t("sending")
          : uploading
            ? t("uploading", { name: uploading })
            : null}
      </p>
      {error ? (
        <p role="alert" className={ALERT}>
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </div>
  );
}
