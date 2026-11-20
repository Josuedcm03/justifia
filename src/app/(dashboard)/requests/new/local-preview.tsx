"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

import { formatFileSize } from "@/app/(dashboard)/catalog/import/file-dropzone";

export type PreviewKind = "pdf" | "image";

/** What the browser can draw from a chosen file, or null when it cannot. */
export function previewKind(file: { type: string }): PreviewKind | null {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png" || file.type === "image/jpeg") return "image";
  return null;
}

/**
 * A preview of the file the student chose, made in the browser (RF-08 a, FE-17).
 * The bytes come from the `File` in memory behind an object URL: nothing is
 * requested from the document route or any other server read, so the preview
 * writes no audit row. The URL is assigned to the element in an effect and the
 * cleanup revokes it, so each effect run owns exactly one URL and StrictMode's
 * double run leaks nothing (the pattern of `credentials-download.tsx`).
 */
export function LocalPreview({ file, name }: { file: File; name: string }) {
  const locale = useLocale();
  const kind = previewKind(file);
  const frame = useRef<HTMLImageElement & HTMLIFrameElement>(null);

  useEffect(() => {
    const element = frame.current;
    if (kind === null || !element) return;
    const url = URL.createObjectURL(file);
    element.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {kind === "image" ? (
        <div className="border-border bg-muted max-h-[70vh] overflow-auto rounded-lg border">
          {/* A plain <img>: the source is an object URL, which the image
              optimizer cannot reach. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={frame}
            alt={name}
            className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
          />
        </div>
      ) : null}
      {kind === "pdf" ? (
        <iframe
          ref={frame}
          title={name}
          className="border-border h-[75vh] w-full rounded-lg border"
        />
      ) : null}
      <p className="text-muted-foreground text-xs break-words">
        {name} · {formatFileSize(file.size, locale)}
      </p>
    </div>
  );
}
