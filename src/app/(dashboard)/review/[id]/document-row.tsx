"use client";

import { cn } from "cn";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { buttonVariants } from "@/components/ui/button";

// One supporting document of the staff detail (UX-16). "View here" expands an
// inline viewer under the row. Every GET of the document route is audited as a
// view (`documento.descargado`, mode `ver`), so nothing is requested before the
// click: while collapsed the panel holds no <img> or <iframe> at all, and
// collapsing it unmounts them. Download keeps going through the same route.

export type ViewerKind = "image" | "pdf";

const IMAGE_TYPES = new Set(["png", "jpeg", "jpg", "webp", "gif"]);

/**
 * Image or PDF from the stored type (`pdf`, `png`, `jpeg`, or a MIME type),
 * falling back to the file extension; `null` when it cannot be shown inline.
 */
export function viewerKind(doc: {
  tipoDetectado: string | null;
  nombreOriginal: string;
}): ViewerKind | null {
  const tipo = (doc.tipoDetectado ?? "").toLowerCase();
  const subtype = tipo.includes("/") ? tipo.split("/")[1]! : tipo;
  const extension = doc.nombreOriginal.toLowerCase().split(".").pop() ?? "";
  for (const candidate of [subtype, extension]) {
    if (candidate === "pdf") return "pdf";
    if (IMAGE_TYPES.has(candidate)) return "image";
  }
  return null;
}

function InlineViewer({
  kind,
  src,
  name,
}: {
  kind: ViewerKind;
  src: string;
  name: string;
}) {
  const t = useTranslations("review.detail.documents");
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {kind === "image" ? (
        <>
          <p className="text-muted-foreground text-xs">{t("zoomHint")}</p>
          <div className="border-border bg-muted max-h-[70vh] overflow-auto rounded-lg border">
            <button
              type="button"
              aria-pressed={zoomed}
              aria-label={t(zoomed ? "zoomOut" : "zoomIn")}
              onClick={() => setZoomed((value) => !value)}
              className={cn(
                "focus-visible:ring-ring block w-full outline-none focus-visible:ring-2",
                zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
              )}
            >
              {/* A plain <img>: the authenticated, audited route must be hit
                  once by the browser, never by the image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={t("imageAlt", { name })}
                className={cn(
                  "mx-auto",
                  zoomed
                    ? "max-w-none"
                    : "max-h-[70vh] w-auto max-w-full object-contain",
                )}
              />
            </button>
          </div>
        </>
      ) : (
        <iframe
          src={src}
          title={t("pdfTitle", { name })}
          className="border-border h-[75vh] w-full rounded-lg border"
        />
      )}
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary inline-flex w-fit items-center gap-1 text-sm underline underline-offset-2"
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        {t("openNewTab")}
      </a>
    </div>
  );
}

/** View and download go through the authenticated route, which audits both. */
export function DocumentRow({
  doc,
  note,
}: {
  doc: { id: number; nombreOriginal: string; tipoDetectado: string | null };
  note?: string;
}) {
  const t = useTranslations("review.detail.documents");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const href = `/api/intake/documents/${doc.id}`;
  const viewHref = `${href}?modo=ver`;
  const kind = viewerKind(doc);
  const name = doc.nombreOriginal;

  return (
    <li className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium break-all">{name}</span>
          {note ? (
            <span className="text-muted-foreground text-xs">{note}</span>
          ) : null}
        </span>
        <span className="flex flex-col gap-2 sm:flex-row">
          {kind ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={t(open ? "hideNamed" : "viewHereNamed", { name })}
              onClick={() => setOpen((value) => !value)}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t(open ? "hide" : "viewHere")}
            </button>
          ) : (
            <a
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("viewNamed", { name })}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("view")}
            </a>
          )}
          <a
            href={`${href}?modo=descarga`}
            aria-label={t("downloadNamed", { name })}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t("download")}
          </a>
        </span>
      </div>
      {kind ? (
        <div
          id={panelId}
          role="region"
          aria-label={t("viewerNamed", { name })}
          hidden={!open}
        >
          {open ? (
            <InlineViewer kind={kind} src={viewHref} name={name} />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
