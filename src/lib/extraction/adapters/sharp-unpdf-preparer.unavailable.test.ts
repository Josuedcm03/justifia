// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { createSharpUnpdfPreparer } from "./sharp-unpdf-preparer";
import { buildPdf } from "./test-support/pdf";

// Its own file on purpose: unpdf keeps a successfully imported canvas module
// for the life of the module instance, so `render_unavailable` can only be seen
// before any page has been rendered. Test files get a fresh instance each; no
// test here ever renders successfully.

const BLANK_PDF = buildPdf([{}]);

describe("sharp-unpdf preparer, canvas addon unavailable (DE-9)", () => {
  it("answers render_unavailable when the canvas addon cannot be imported", async () => {
    const preparer = createSharpUnpdfPreparer({
      canvasImport: () => Promise.reject(new Error("addon not installed")),
    });

    const result = await preparer.prepare(BLANK_PDF, "pdf");

    expect(result).toEqual({ ok: false, code: "render_unavailable" });
  });

  it("answers render_unavailable when the import throws synchronously", async () => {
    const preparer = createSharpUnpdfPreparer({
      canvasImport: () => {
        throw new Error("addon not installed");
      },
    });

    const result = await preparer.prepare(BLANK_PDF, "pdf");

    expect(result).toEqual({ ok: false, code: "render_unavailable" });
  });

  it("still prepares images, which never need the canvas addon", async () => {
    const preparer = createSharpUnpdfPreparer({
      canvasImport: () => Promise.reject(new Error("addon not installed")),
    });
    const photo = new Uint8Array(
      await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 10, g: 120, b: 200 },
        },
      })
        .jpeg()
        .toBuffer(),
    );

    const result = await preparer.prepare(photo, "jpeg");

    expect(result.ok).toBe(true);
  });

  it("refuses an extreme page as unreadable_document before the canvas addon is needed", async () => {
    let imports = 0;
    const preparer = createSharpUnpdfPreparer({
      canvasImport: () => {
        imports++;
        return Promise.reject(new Error("addon not installed"));
      },
    });

    const result = await preparer.prepare(
      buildPdf([{ width: 1, height: 14_400 }]),
      "pdf",
    );

    expect(result).toEqual({ ok: false, code: "unreadable_document" });
    expect(imports).toBe(0);
  });

  it("keeps a bad PDF unreadable even when the canvas addon is also missing", async () => {
    const preparer = createSharpUnpdfPreparer({
      canvasImport: () => Promise.reject(new Error("addon not installed")),
    });

    const result = await preparer.prepare(
      new Uint8Array(256).map((_, i) => (i * 13 + 5) % 251),
      "pdf",
    );

    expect(result).toEqual({ ok: false, code: "unreadable_document" });
  });
});
