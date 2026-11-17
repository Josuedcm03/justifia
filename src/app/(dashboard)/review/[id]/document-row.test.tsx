import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  DocumentRow,
  viewerKind,
} from "@/app/(dashboard)/review/[id]/document-row";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

// UX-16: the inline viewer of a supporting document. Every GET of the document
// route is an audited view, so nothing that loads it may exist before the click.

const en = messages.en.review.detail.documents;
const es = messages.es.review.detail.documents;

function show(
  doc: { id: number; nombreOriginal: string; tipoDetectado: string | null },
  locale: "en" | "es" = "en",
) {
  return renderIntl(
    <ul>
      <DocumentRow doc={doc} />
    </ul>,
    locale,
  );
}

const PDF = { id: 31, nombreOriginal: "constancia.pdf", tipoDetectado: "pdf" };
const JPEG = { id: 30, nombreOriginal: "foto.jpg", tipoDetectado: "jpeg" };

/** Anything in the document that would request the audited route. */
function loaders() {
  return document.querySelectorAll(
    "img, iframe, object, embed, link[rel='prefetch'], link[rel='preload']",
  );
}

describe("viewerKind", () => {
  it.each([
    [{ tipoDetectado: "pdf", nombreOriginal: "a.bin" }, "pdf"],
    [{ tipoDetectado: "application/pdf", nombreOriginal: "a" }, "pdf"],
    [{ tipoDetectado: "png", nombreOriginal: "a" }, "image"],
    [{ tipoDetectado: "jpeg", nombreOriginal: "a" }, "image"],
    [{ tipoDetectado: "image/webp", nombreOriginal: "a" }, "image"],
    [{ tipoDetectado: null, nombreOriginal: "scan.JPG" }, "image"],
    [{ tipoDetectado: null, nombreOriginal: "nota.pdf" }, "pdf"],
    [{ tipoDetectado: null, nombreOriginal: "nota.docx" }, null],
  ] as const)("classifies %o as %s", (doc, kind) => {
    expect(viewerKind(doc)).toBe(kind);
  });
});

describe("DocumentRow inline viewer (UX-16)", () => {
  it("renders nothing that loads the document before the click", () => {
    show(PDF);

    const toggle = screen.getByRole("button", {
      name: "View constancia.pdf here",
    });
    expect(toggle).toHaveTextContent(en.viewHere);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(loaders()).toHaveLength(0);
    expect(document.querySelector("a[href$='?modo=ver']")).toBeNull();
  });

  it("opens a PDF in an iframe on the audited view route, and hides it again", async () => {
    show(PDF);
    const toggle = screen.getByRole("button", {
      name: "View constancia.pdf here",
    });

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent(en.hide);
    const panel = screen.getByRole("region", {
      name: "Preview of constancia.pdf",
    });
    expect(toggle).toHaveAttribute("aria-controls", panel.id);
    const frame = panel.querySelector("iframe");
    expect(frame).toHaveAttribute("src", "/api/intake/documents/31?modo=ver");
    expect(frame).toHaveAttribute("title", "Document constancia.pdf");
    expect(panel.querySelector("img")).toBeNull();
    const tab = within(panel).getByRole("link", { name: en.openNewTab });
    expect(tab).toHaveAttribute("href", "/api/intake/documents/31?modo=ver");
    expect(tab).toHaveAttribute("target", "_blank");
    expect(tab).toHaveAttribute("rel", "noopener noreferrer");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(loaders()).toHaveLength(0);
  });

  it("opens an image as a plain img that toggles between fit and full size", async () => {
    show(JPEG);

    await userEvent.click(
      screen.getByRole("button", { name: "View foto.jpg here" }),
    );

    const panel = screen.getByRole("region", { name: "Preview of foto.jpg" });
    expect(panel.querySelector("iframe")).toBeNull();
    const img = within(panel).getByRole("img", { name: "Document foto.jpg" });
    expect(img).toHaveAttribute("src", "/api/intake/documents/30?modo=ver");
    expect(img).toHaveClass("max-h-[70vh]", "object-contain");

    const zoom = within(panel).getByRole("button", { name: en.zoomIn });
    await userEvent.click(zoom);
    expect(zoom).toHaveAttribute("aria-pressed", "true");
    expect(zoom).toHaveAccessibleName(en.zoomOut);
    expect(img).toHaveClass("max-w-none");
    expect(img).not.toHaveClass("max-h-[70vh]");
  });

  it("keeps the download link", () => {
    show(PDF);

    expect(
      screen.getByRole("link", { name: "Download constancia.pdf" }),
    ).toHaveAttribute("href", "/api/intake/documents/31?modo=descarga");
  });

  it("falls back to the new-tab link for a type it cannot show inline", () => {
    show({ id: 9, nombreOriginal: "nota.docx", tipoDetectado: null });

    expect(screen.queryByRole("button")).toBeNull();
    const view = screen.getByRole("link", { name: "View nota.docx" });
    expect(view).toHaveAttribute("href", "/api/intake/documents/9?modo=ver");
    expect(view).toHaveAttribute("target", "_blank");
  });

  it("is worded in Spanish", async () => {
    show(PDF, "es");

    const toggle = screen.getByRole("button", {
      name: "Ver aquí constancia.pdf",
    });
    expect(toggle).toHaveTextContent(es.viewHere);
    await userEvent.click(toggle);
    expect(toggle).toHaveTextContent(es.hide);
    expect(
      screen.getByRole("link", { name: "Abrir en otra pestaña" }),
    ).toBeInTheDocument();
  });
});
