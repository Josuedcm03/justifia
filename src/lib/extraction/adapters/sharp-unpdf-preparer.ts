import sharp from "sharp";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

import { IMAGE_MAX_WIDTH, MAX_PDF_PAGES, fitsRenderCap } from "../limits";
import type { DocumentKind, DocumentPreparer, PrepareResult } from "../ports";

// Document preparer (DE-9): turns stored bytes into the JPEG pages the model
// reads. Native addons (sharp, @napi-rs/canvas) make this server-only; the use
// case reaches it through the `DocumentPreparer` port, never by import.
//
// Every PDF takes the render path, text layer or not: the text-mode
// measurement failed its gate (DE-14), so there is no text variant.

const JPEG_QUALITY = 85;
const BACKGROUND = "#ffffff";

const UNREADABLE: PrepareResult = { ok: false, code: "unreadable_document" };
const RENDER_UNAVAILABLE: PrepareResult = {
  ok: false,
  code: "render_unavailable",
};

type CanvasImport = () => Promise<typeof import("@napi-rs/canvas")>;

export interface SharpUnpdfPreparerOptions {
  /**
   * How the canvas addon is loaded. Lazy by default, so a deployment where the
   * addon cannot load still prepares images and reports PDFs as
   * `render_unavailable` instead of failing at import time.
   */
  canvasImport?: CanvasImport;
}

const importCanvas: CanvasImport = () => import("@napi-rs/canvas");

/**
 * The sharp step shared by both paths: apply the EXIF orientation to the
 * pixels, flatten transparency onto white (JPEG has no alpha, and dark ink on
 * a black background is unreadable), cap the width without enlarging, encode.
 */
async function toModelJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  const jpeg = await sharp(bytes)
    .rotate()
    .flatten({ background: BACKGROUND })
    .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return new Uint8Array(jpeg);
}

function prepared(images: readonly Uint8Array[]): PrepareResult {
  return { ok: true, prepared: { kind: "images", images } };
}

async function prepareImage(bytes: Uint8Array): Promise<PrepareResult> {
  try {
    return prepared([await toModelJpeg(bytes)]);
  } catch {
    return UNREADABLE;
  }
}

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * Reads each page's box as a viewer shows it (rotation applied) at scale 1 and
 * checks that drawing it at the image width stays under the height cap. Reading
 * a viewport allocates no canvas.
 */
async function pagesFitRenderCap(
  document: PdfDocument,
  pages: number,
): Promise<boolean> {
  for (let number = 1; number <= pages; number++) {
    const { width, height } = (await document.getPage(number)).getViewport({
      scale: 1,
    });
    if (!fitsRenderCap(width, height)) return false;
  }
  return true;
}

async function preparePdf(
  bytes: Uint8Array,
  canvasImport: CanvasImport,
): Promise<PrepareResult> {
  // pdf.js detaches the buffer it is given. `new Uint8Array(bytes)` always
  // copies (`Buffer#slice` would only return a view), so the caller's bytes
  // survive and the same document can be prepared again.
  let document: PdfDocument;
  try {
    document = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    return UNREADABLE;
  }

  // A failing import must be told apart from a page that cannot be drawn.
  let canvasFailed = false;
  const guardedImport: CanvasImport = async () => {
    try {
      return await canvasImport();
    } catch (error) {
      canvasFailed = true;
      throw error;
    }
  };

  try {
    const images: Uint8Array[] = [];
    const pages = Math.min(document.numPages, MAX_PDF_PAGES);
    // Every page that would be drawn is measured first, so an oversized one
    // refuses the whole document before any canvas is allocated.
    if (!(await pagesFitRenderCap(document, pages))) return UNREADABLE;
    for (let page = 1; page <= pages; page++) {
      const png = await renderPageAsImage(document, page, {
        canvasImport: guardedImport,
        width: IMAGE_MAX_WIDTH,
      });
      images.push(await toModelJpeg(new Uint8Array(png)));
    }
    return images.length > 0 ? prepared(images) : UNREADABLE;
  } catch {
    return canvasFailed ? RENDER_UNAVAILABLE : UNREADABLE;
  } finally {
    // Releases the parser and its worker; a failure here must not hide the
    // outcome of the preparation.
    await document.loadingTask.destroy().catch(() => undefined);
  }
}

export function createSharpUnpdfPreparer(
  options: SharpUnpdfPreparerOptions = {},
): DocumentPreparer {
  const canvasImport = options.canvasImport ?? importCanvas;
  return {
    async prepare(bytes: Uint8Array, kind: DocumentKind) {
      return kind === "pdf"
        ? preparePdf(bytes, canvasImport)
        : prepareImage(bytes);
    },
  };
}
