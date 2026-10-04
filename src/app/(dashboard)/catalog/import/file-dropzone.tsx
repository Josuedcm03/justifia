"use client";

import { cn } from "cn";
import { useLocale, useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { MAX_FILE_BYTES } from "@/lib/import/limits";

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

/** Human size with one decimal: KB below one MB, MB from there on. */
export function formatFileSize(bytes: number, locale: string): string {
  const inMb = bytes >= BYTES_PER_MB;
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bytes / (inMb ? BYTES_PER_MB : BYTES_PER_KB));
  return `${amount} ${inMb ? "MB" : "KB"}`;
}

export type DropzonePhase = "idle" | "analysing" | "loaded";

/**
 * The drop target and the file picker in one. Purely presentational: it hands
 * the first file it receives to `onFile` and holds no file of its own. Every
 * state is said in words (title, status line, button label), never by colour
 * alone.
 */
export function FileDropzone({
  phase,
  file,
  error,
  disabled = false,
  onFile,
}: {
  phase: DropzonePhase;
  /** The file being analysed or already previewed; only its name and size are
   *  shown. */
  file: File | null;
  error: string | null;
  /** No file is taken while one is being analysed or the import is running. */
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const t = useTranslations("catalog.import.upload");
  const locale = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const analysing = phase === "analysing";
  const busy = analysing || disabled;
  const describedBy = error
    ? "import-file-hint import-error"
    : "import-file-hint";

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Without this the browser never fires `drop` and opens the file instead.
    event.preventDefault();
    if (!busy) setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Moving onto a child also fires dragleave on the zone.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    // Several files dropped at once: the first one, the rest are ignored.
    const dropped = event.dataTransfer.files?.[0];
    if (dropped && !busy) onFile(dropped);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    // Reset so that choosing the same file again fires `change` again.
    event.target.value = "";
    if (chosen && !busy) onFile(chosen);
  }

  function handleZoneClick(event: MouseEvent<HTMLDivElement>) {
    // The label and the button open the picker themselves, and the picker's
    // own click bubbles back up here.
    if ((event.target as HTMLElement).closest("label, button, input")) return;
    if (!busy) input.current?.click();
  }

  let status: string | null = null;
  if (file && analysing) status = t("analysing", { name: file.name });
  else if (file && phase === "loaded") {
    status = t("selected", {
      name: file.name,
      size: formatFileSize(file.size, locale),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        data-testid="import-dropzone"
        onClick={handleZoneClick}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "ease-ui flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center transition-colors duration-150",
          busy ? "cursor-default" : "cursor-pointer",
          // The page surface, not the card's: inside a card the zone reads as
          // an inset area rather than as a second white box.
          dragging ? "border-primary bg-accent" : "border-border bg-background",
        )}
      >
        <label
          htmlFor="import-file"
          className={cn("text-h4", busy ? "cursor-default" : "cursor-pointer")}
        >
          {dragging ? t("dropActive") : t("dropTitle")}
        </label>
        <div className="max-w-full">
          <p id="import-file-hint" className="text-muted-foreground text-sm">
            {t("fileHint", { size: MAX_FILE_BYTES / BYTES_PER_MB })}
          </p>
          {/* Always mounted, so a screen reader hears the text arrive. */}
          <p role="status" className="text-sm font-medium break-words">
            {status}
          </p>
        </div>
        {/* The button is the keyboard path; the input stays out of the tab
            order because, hidden, it could not show a focus ring. */}
        <input
          ref={input}
          id="import-file"
          name="file"
          type="file"
          accept=".xlsx"
          tabIndex={-1}
          disabled={busy}
          onChange={handleChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="sr-only"
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          aria-describedby={describedBy}
          onClick={() => input.current?.click()}
        >
          {phase === "loaded" ? t("change") : t("choose")}
        </Button>
      </div>

      {error ? (
        <p
          id="import-error"
          role="alert"
          className="border-destructive/30 bg-destructive/8 text-destructive max-w-prose rounded-lg border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
