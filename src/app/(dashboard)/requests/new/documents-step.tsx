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
import { DatesRecap } from "@/app/(dashboard)/requests/new/dates-recap";
import {
  BackLink,
  ContinueLink,
  FieldErrors,
  StepShell,
} from "@/app/(dashboard)/requests/new/form-field";
import { FileOriginMark } from "@/app/(dashboard)/requests/new/file-origin-mark";
import type { StepFlow } from "@/app/(dashboard)/requests/new/flow";
import { LocalPreview } from "@/app/(dashboard)/requests/new/local-preview";
import { FLOW_PATH, stepHref } from "@/app/(dashboard)/requests/new/steps";
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

// State is never mutated: each update works on a copy.
function droppedFile(held: ReadonlyMap<number, File>, id: number) {
  const next = new Map(held);
  next.delete(id);
  return next;
}

function droppedId(held: ReadonlySet<number>, id: number) {
  const next = new Set(held);
  next.delete(id);
  return next;
}

type DocumentsFlow = StepFlow<"finalizeDocument" | "removeDocument">;

const NEW_FLOW: DocumentsFlow = {
  basePath: FLOW_PATH,
  actions: {
    finalizeDocument: finalizeDocumentAction,
    removeDocument: removeDocumentAction,
  },
};

/**
 * Step 3: supporting documents (RF-02, RN-03, RN-04, D12). The file goes from
 * the browser straight to the private store with a short-lived token and never
 * crosses a Next function (D2); then the server finalizes it by reading the
 * stored bytes. The list comes from the draft, so after every change the page
 * is re-read instead of keeping a second copy here. With valid dates it opens
 * with a read-only recap of them (FE-18).
 */
export function DocumentsStep({
  draftId,
  documents,
  fromReview = false,
  flow = NEW_FLOW,
  previousDocumentIds,
  range = null,
  today,
}: {
  /** The id the files are stored under: the draft's, or the returned request's. */
  draftId: number;
  documents: readonly AttachedDocument[];
  fromReview?: boolean;
  flow?: DocumentsFlow;
  /**
   * In a correction, the ids of the returned version, so each file is marked
   * "Anterior" or "Nuevo" (FE-16); null when it could not be read, and absent
   * for a new request. Either way no mark is shown.
   */
  previousDocumentIds?: readonly number[] | null;
  /** The draft's valid dates, for the recap; null or absent shows none. */
  range?: { from: string; to: string } | null;
  /** The Managua calendar day from the server; absent means no notice. */
  today?: string;
}) {
  const t = useTranslations("intake");
  const tErrors = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The files attached during this visit, by the id finalize returned (D8). A
  // document stored before the visit is not here and keeps its audited "Ver".
  const [localFiles, setLocalFiles] = useState<ReadonlyMap<number, File>>(
    () => new Map(),
  );
  const [previewing, setPreviewing] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

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
      const result = await flow.actions.finalizeDocument({
        pathname,
        nombreOriginal: file.name,
      });
      if (!result.ok) {
        setError(result.errors[0]?.key ?? errorKey("upload_failed"));
      } else if (result.documentId !== undefined) {
        const documentId = result.documentId;
        setLocalFiles((held) => new Map(held).set(documentId, file));
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
      const result = await flow.actions.removeDocument(documentId);
      if (!result.ok) {
        setError(result.errors[0].key);
      } else {
        // Dropping the entry unmounts its preview, whose cleanup revokes the URL.
        setLocalFiles((held) => droppedFile(held, documentId));
        setPreviewing((open) => droppedId(open, documentId));
      }
    } finally {
      setRemoving(false);
      router.refresh();
    }
  }

  function togglePreview(documentId: number) {
    setPreviewing((open) =>
      open.has(documentId)
        ? droppedId(open, documentId)
        : new Set(open).add(documentId),
    );
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
          <BackLink href={stepHref(fromReview ? 4 : 2, flow.basePath)} />
          <ContinueLink href={stepHref(4, flow.basePath)} />
        </>
      }
    >
      {range ? (
        <DatesRecap
          range={range}
          today={today}
          editHref={stepHref(1, flow.basePath)}
        />
      ) : null}

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
            {documents.map((doc) => {
              const local = localFiles.get(doc.id);
              const open = local !== undefined && previewing.has(doc.id);
              const panelId = `documents-preview-${doc.id}`;
              return (
                <li
                  key={doc.id}
                  className="border-border flex flex-col border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className="truncate text-sm"
                        title={doc.nombreOriginal}
                      >
                        {doc.nombreOriginal}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          {formatFileSize(doc.tamanoBytes, locale)}
                        </span>
                        <FileOriginMark
                          documentId={doc.id}
                          previousIds={previousDocumentIds}
                        />
                      </span>
                    </span>
                    {local ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        className="shrink-0"
                        aria-expanded={open}
                        aria-controls={open ? panelId : undefined}
                        aria-label={t(
                          open
                            ? "documents.hidePreviewNamed"
                            : "documents.previewNamed",
                          { name: doc.nombreOriginal },
                        )}
                        onClick={() => togglePreview(doc.id)}
                      >
                        {t(
                          open ? "documents.hidePreview" : "documents.preview",
                        )}
                      </Button>
                    ) : (
                      <a
                        href={`/api/intake/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("documents.viewNamed", {
                          name: doc.nombreOriginal,
                        })}
                        className={`${buttonVariants({ variant: "ghost", size: "lg" })} shrink-0`}
                      >
                        {t("documents.view")}
                      </a>
                    )}
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
                  </div>
                  {open ? (
                    <div id={panelId} className="flex flex-col gap-2 pb-3">
                      <p className="text-muted-foreground text-sm">
                        {t("documents.previewHint")}
                      </p>
                      <LocalPreview file={local} name={doc.nombreOriginal} />
                    </div>
                  ) : null}
                </li>
              );
            })}
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
