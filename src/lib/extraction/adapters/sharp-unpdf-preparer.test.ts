// @vitest-environment node
import sharp from "sharp";
import { renderPageAsImage } from "unpdf";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IMAGE_MAX_WIDTH,
  MAX_IMAGE_TOKENS,
  MAX_PDF_PAGES,
  imageTokenCost,
  widthWithinImageTokens,
} from "../limits";
import { createSharpUnpdfPreparer } from "./sharp-unpdf-preparer";
import { buildPdf } from "./test-support/pdf";

// The real render function, wrapped in a spy: the page-size guard tests assert
// it is never reached for a page that is too tall.
vi.mock("unpdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("unpdf")>();
  return { ...actual, renderPageAsImage: vi.fn(actual.renderPageAsImage) };
});

const renderSpy = vi.mocked(renderPageAsImage);

beforeEach(() => {
  renderSpy.mockClear();
});

// Every fixture is generated here: no real document is read (RNF-04).

const RED = { r: 255, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };

/**
 * A landscape JPEG whose left half is red and whose right half is blue. With
 * EXIF orientation 6 a viewer turns it a quarter turn clockwise, so the red half
 * ends up on top: that is how the tests tell "upright" from "as stored".
 */
async function twoToneJpeg(
  width: number,
  height: number,
  orientation?: number,
): Promise<Uint8Array> {
  const leftHalf = await sharp({
    create: { width: width / 2, height, channels: 3, background: RED },
  })
    .png()
    .toBuffer();
  const image = sharp({
    create: { width, height, channels: 3, background: BLUE },
  })
    .composite([{ input: leftHalf, left: 0, top: 0 }])
    .jpeg({ quality: 95 });
  return new Uint8Array(
    await (
      orientation ? image.withMetadata({ orientation }) : image
    ).toBuffer(),
  );
}

async function pixelAt(
  jpeg: Uint8Array,
  xFraction: number,
  yFraction: number,
): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(jpeg)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const x = Math.floor(info.width * xFraction);
  const y = Math.floor(info.height * yFraction);
  const offset = (y * info.width + x) * info.channels;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
}

type Prepared = Awaited<
  ReturnType<ReturnType<typeof createSharpUnpdfPreparer>["prepare"]>
>;

function imagesOf(result: Prepared): readonly Uint8Array[] {
  if (!result.ok)
    throw new Error(`expected a prepared document: ${result.code}`);
  expect(result.prepared.kind).toBe("images");
  return result.prepared.images;
}

async function onlyImage(result: Prepared): Promise<Uint8Array> {
  const images = imagesOf(result);
  expect(images).toHaveLength(1);
  return images[0];
}

/** Darkest and mean level of the first channel, 0..255. */
async function lumaOf(
  jpeg: Uint8Array,
): Promise<{ min: number; mean: number; width: number }> {
  const meta = await sharp(jpeg).metadata();
  const stats = await sharp(jpeg).stats();
  return {
    min: stats.channels[0].min,
    mean: stats.channels[0].mean,
    width: meta.width ?? 0,
  };
}

describe("sharp-unpdf preparer, image path (DE-9)", () => {
  const preparer = createSharpUnpdfPreparer();

  it("turns a large photo with EXIF orientation 6 upright at width 1600", async () => {
    const stored = await twoToneJpeg(3200, 2000, 6);

    const image = await onlyImage(await preparer.prepare(stored, "jpeg"));

    const meta = await sharp(image).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1600);
    // 2000 x 3200 once upright, scaled to width 1600.
    expect(meta.height).toBe(2560);
    // Red half of the stored image is on top after the quarter turn.
    const top = await pixelAt(image, 0.5, 0.1);
    const bottom = await pixelAt(image, 0.5, 0.9);
    expect(top.r).toBeGreaterThan(200);
    expect(top.b).toBeLessThan(60);
    expect(bottom.b).toBeGreaterThan(200);
    expect(bottom.r).toBeLessThan(60);
    // The orientation is applied to the pixels, so no tag is left to apply twice.
    expect(meta.orientation).toBeUndefined();
  });

  it("keeps a photo without an orientation tag as stored, only reduced", async () => {
    const stored = await twoToneJpeg(3200, 2000);

    const image = await onlyImage(await preparer.prepare(stored, "jpeg"));

    const meta = await sharp(image).metadata();
    expect([meta.width, meta.height]).toEqual([1600, 1000]);
    const left = await pixelAt(image, 0.1, 0.5);
    const right = await pixelAt(image, 0.9, 0.5);
    expect(left.r).toBeGreaterThan(200);
    expect(right.b).toBeGreaterThan(200);
  });

  it("does not enlarge an image narrower than 1600 px", async () => {
    const stored = await twoToneJpeg(800, 600);

    const image = await onlyImage(await preparer.prepare(stored, "jpeg"));

    const meta = await sharp(image).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
  });

  it("re-encodes a PNG as JPEG quality 85", async () => {
    const png = new Uint8Array(
      await sharp({
        create: { width: 2400, height: 1200, channels: 3, background: BLUE },
      })
        .composite([
          {
            input: await sharp({
              create: { width: 900, height: 700, channels: 3, background: RED },
            })
              .png()
              .toBuffer(),
            left: 300,
            top: 200,
          },
        ])
        .png()
        .toBuffer(),
    );

    const image = await onlyImage(await preparer.prepare(png, "png"));

    const meta = await sharp(image).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1600);
    const reference = await sharp(png)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    expect(Buffer.from(image).equals(reference)).toBe(true);
  });

  it("paints a transparent PNG on white, not on black", async () => {
    const transparent = new Uint8Array(
      await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toBuffer(),
    );

    const image = await onlyImage(await preparer.prepare(transparent, "png"));

    const pixel = await pixelAt(image, 0.5, 0.5);
    expect(pixel.r).toBeGreaterThan(245);
    expect(pixel.g).toBeGreaterThan(245);
    expect(pixel.b).toBeGreaterThan(245);
  });

  it.each([["jpeg"], ["png"]] as const)(
    "fails bytes that are not a %s as unreadable_document",
    async (kind) => {
      const garbage = new Uint8Array(512).map((_, i) => (i * 31 + 7) % 251);

      const result = await preparer.prepare(garbage, kind);

      expect(result).toEqual({ ok: false, code: "unreadable_document" });
    },
  );

  it("fails a truncated JPEG as unreadable_document", async () => {
    const stored = await twoToneJpeg(1200, 800);

    const result = await preparer.prepare(
      stored.slice(0, Math.floor(stored.length / 3)),
      "jpeg",
    );

    expect(result).toEqual({ ok: false, code: "unreadable_document" });
  });
});

// The `render_unavailable` outcome is covered in its own file: unpdf keeps a
// successfully imported canvas module for the life of the module instance, so
// it can only be observed before any page has been rendered.
describe("sharp-unpdf preparer, PDF render path (DE-9)", () => {
  const preparer = createSharpUnpdfPreparer();

  it("renders every page of a mixed PDF as an image, text page included", async () => {
    const pdf = buildPdf([{ text: "Constancia medica" }, {}]);

    const images = imagesOf(await preparer.prepare(pdf, "pdf"));

    expect(images).toHaveLength(2);
    const textPage = await lumaOf(images[0]);
    const blankPage = await lumaOf(images[1]);
    // The printed page shows ink; the blank page is plain white.
    expect(textPage.min).toBeLessThan(100);
    expect(blankPage.min).toBeGreaterThan(250);
  });

  it("renders a PDF whose every page has a text layer as images too, never as text (scenario: Text-layer PDF)", async () => {
    // Text mode measured FAIL (DE-14): a text-layer PDF takes the image path.
    const pdf = buildPdf([
      { text: "Constancia medica" },
      { text: "Reposo relativo" },
    ]);

    const result = await preparer.prepare(pdf, "pdf");
    const images = imagesOf(result);

    expect(result.ok && result.prepared.kind).toBe("images");
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect((await lumaOf(image)).min).toBeLessThan(100);
    }
  });

  it("sends only the first 5 pages of an 8-page scan, in order", async () => {
    // Page n is a flat gray of level n/10: the mean tells which page it was.
    const pdf = buildPdf(
      Array.from({ length: 8 }, (_, i) => ({ gray: (i + 1) / 10 })),
    );

    const images = imagesOf(await preparer.prepare(pdf, "pdf"));

    expect(images).toHaveLength(5);
    const means = await Promise.all(
      images.map(async (i) => (await lumaOf(i)).mean),
    );
    means.forEach((mean, i) => {
      expect(mean).toBeGreaterThan(((i + 1) / 10) * 255 - 8);
      expect(mean).toBeLessThan(((i + 1) / 10) * 255 + 8);
    });
  });

  it("sends a short PDF whole: 3 pages give 3 images", async () => {
    const pdf = buildPdf([{ gray: 0.2 }, { gray: 0.5 }, { gray: 0.8 }]);

    const images = imagesOf(await preparer.prepare(pdf, "pdf"));

    expect(images).toHaveLength(3);
  });

  it("passes each rendered page through the sharp step: JPEG, width <= 1600, within its token share", async () => {
    const pdf = buildPdf([
      {},
      { width: 3000, height: 1000, gray: 0.5 },
      { width: 100, height: 100, gray: 0.5 },
    ]);

    const images = imagesOf(await preparer.prepare(pdf, "pdf"));

    expect(images).toHaveLength(3);
    for (const image of images) {
      const meta = await sharp(image).metadata();
      expect(meta.format).toBe("jpeg");
      expect(meta.width).toBeLessThanOrEqual(1600);
    }
    // Each of the 3 pages gets a third of the budget: a letter page is drawn
    // at the width that share allows, not at the cap. The canvas truncates a
    // fractional viewport (612 * (1261 / 612) is 1260.99...), so the drawn
    // width may be one pixel under the computed one.
    const share = Math.floor(MAX_IMAGE_TOKENS / 3);
    const letter = widthWithinImageTokens(612, 792, share);
    expect(letter).toBeLessThan(IMAGE_MAX_WIDTH);
    const drawn = (await lumaOf(images[0])).width;
    expect(drawn).toBeLessThanOrEqual(letter);
    expect(drawn).toBeGreaterThanOrEqual(letter - 1);
    const wide = await sharp(images[1]).metadata();
    expect(wide.width).toBe(widthWithinImageTokens(3000, 1000, share));
    expect(wide.height).toBe(Math.floor((wide.width * 1000) / 3000));
  });

  it("leaves the caller's bytes intact, so the same bytes can be prepared again", async () => {
    // pdf.js detaches the buffer it is given; the preparer must hand it a copy.
    const pdf = buildPdf([{ gray: 0.4 }]);
    const length = pdf.byteLength;

    const first = imagesOf(await preparer.prepare(pdf, "pdf"));
    const second = imagesOf(await preparer.prepare(pdf, "pdf"));

    expect(pdf.byteLength).toBe(length);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it("fails bytes that are not a PDF as unreadable_document", async () => {
    const garbage = new Uint8Array(512).map((_, i) => (i * 17 + 3) % 251);

    const result = await preparer.prepare(garbage, "pdf");

    expect(result).toEqual({ ok: false, code: "unreadable_document" });
  });

  it("fails a PDF with no pages as unreadable_document", async () => {
    const result = await preparer.prepare(buildPdf([]), "pdf");

    expect(result).toEqual({ ok: false, code: "unreadable_document" });
  });

  it("fails a truncated PDF as unreadable_document", async () => {
    const pdf = buildPdf([{ gray: 0.4 }, { gray: 0.6 }]);

    const result = await preparer.prepare(pdf.slice(0, 40), "pdf");

    expect(result).toEqual({ ok: false, code: "unreadable_document" });
  });
});

// A page is checked before it is drawn: a page box of 1 x 14400 pt at width
// 1600 would be a canvas of 23 million pixels, and memory is spent before the
// draw fails. The whole document is refused, with no partial result.
describe("sharp-unpdf preparer, page-size guard (DE-9)", () => {
  const preparer = createSharpUnpdfPreparer();
  const UNREADABLE = { ok: false, code: "unreadable_document" };

  it("renders ordinary pages: A4 and legal pass through the guard", async () => {
    const pdf = buildPdf([
      { width: 595, height: 842, gray: 0.5 },
      { width: 612, height: 1008, gray: 0.5 },
    ]);

    const images = imagesOf(await preparer.prepare(pdf, "pdf"));

    expect(images).toHaveLength(2);
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it("renders a long receipt (227 x 1134 pt, ratio 5) narrowed to the token budget", async () => {
    const pdf = buildPdf([{ width: 227, height: 1134, gray: 0.5 }]);

    const images = imagesOf(await preparer.prepare(pdf, "pdf"));

    expect(images).toHaveLength(1);
    const meta = await sharp(images[0]).metadata();
    const width = widthWithinImageTokens(227, 1134, MAX_IMAGE_TOKENS);
    expect(width).toBeLessThan(IMAGE_MAX_WIDTH);
    expect([meta.width, meta.height]).toEqual([
      width,
      Math.floor((1134 * width) / 227),
    ]);
  });

  it("refuses a 1 x 14400 pt page without rendering it", async () => {
    const pdf = buildPdf([{ width: 1, height: 14_400, gray: 0.5 }]);

    const result = await preparer.prepare(pdf, "pdf");

    expect(result).toEqual(UNREADABLE);
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it("refuses the whole document when only page 3 is extreme, rendering nothing", async () => {
    const pdf = buildPdf([
      { gray: 0.2 },
      { gray: 0.4 },
      { width: 1, height: 14_400, gray: 0.6 },
      { gray: 0.8 },
    ]);

    const result = await preparer.prepare(pdf, "pdf");

    // Pages 1 and 2 are fine, yet nothing was drawn and nothing is returned.
    expect(result).toEqual(UNREADABLE);
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it("refuses an extreme page that is the last one sent (page 5)", async () => {
    const pdf = buildPdf([
      { gray: 0.2 },
      { gray: 0.2 },
      { gray: 0.2 },
      { gray: 0.2 },
      { width: 100, height: 700, gray: 0.6 },
    ]);

    const result = await preparer.prepare(pdf, "pdf");

    expect(result).toEqual(UNREADABLE);
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it("does not look at pages past the page cap: an extreme page 6 is never sent", async () => {
    const pdf = buildPdf([
      { gray: 0.2 },
      { gray: 0.2 },
      { gray: 0.2 },
      { gray: 0.2 },
      { gray: 0.2 },
      { width: 1, height: 14_400, gray: 0.6 },
    ]);

    const images = imagesOf(await preparer.prepare(pdf, "pdf"));

    expect(images).toHaveLength(5);
    expect(renderSpy).toHaveBeenCalledTimes(5);
  });

  it("judges the page as a viewer shows it: a rotated wide page is tall", async () => {
    const tall = buildPdf([{ width: 1000, height: 100, rotate: 90 }]);
    const wide = buildPdf([{ width: 1000, height: 100, gray: 0.5 }]);

    expect(await preparer.prepare(tall, "pdf")).toEqual(UNREADABLE);
    expect(renderSpy).not.toHaveBeenCalled();

    const images = imagesOf(await preparer.prepare(wide, "pdf"));
    expect(images).toHaveLength(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});

// The model server counts one token per started 32 x 32 block and has an
// 8192-token context: the images of one document must stay under
// `MAX_IMAGE_TOKENS` together, or every request is refused.
describe("sharp-unpdf preparer, image token budget (DE-9)", () => {
  const preparer = createSharpUnpdfPreparer();

  async function sizesOf(
    images: readonly Uint8Array[],
  ): Promise<Array<[number, number]>> {
    return Promise.all(
      images.map(async (image) => {
        const meta = await sharp(image).metadata();
        return [meta.width, meta.height] as [number, number];
      }),
    );
  }

  function tokensOf(sizes: ReadonlyArray<[number, number]>): number {
    return sizes.reduce((sum, [w, h]) => sum + imageTokenCost(w, h), 0);
  }

  it("keeps a 3-page letter PDF under the budget", async () => {
    const pdf = buildPdf([{ text: "Carta" }, { gray: 0.5 }, { gray: 0.8 }]);

    const sizes = await sizesOf(imagesOf(await preparer.prepare(pdf, "pdf")));

    expect(sizes).toHaveLength(3);
    expect(tokensOf(sizes)).toBeLessThanOrEqual(MAX_IMAGE_TOKENS);
  });

  it("keeps a 5-page PDF under the budget", async () => {
    const pdf = buildPdf(
      Array.from({ length: MAX_PDF_PAGES }, () => ({ gray: 0.5 })),
    );

    const sizes = await sizesOf(imagesOf(await preparer.prepare(pdf, "pdf")));

    expect(sizes).toHaveLength(5);
    expect(tokensOf(sizes)).toBeLessThanOrEqual(MAX_IMAGE_TOKENS);
  });

  it("gives a one-page PDF the whole budget, not a page share", async () => {
    const pdf = buildPdf([{ gray: 0.5 }]);

    const sizes = await sizesOf(imagesOf(await preparer.prepare(pdf, "pdf")));

    expect(sizes).toHaveLength(1);
    expect(sizes[0][0]).toBe(
      widthWithinImageTokens(612, 792, MAX_IMAGE_TOKENS),
    );
    expect(tokensOf(sizes)).toBeLessThanOrEqual(MAX_IMAGE_TOKENS);
  });

  it("narrows a very tall image (1600 x 9000) to the budget", async () => {
    const stored = await twoToneJpeg(1600, 9000);

    const sizes = await sizesOf([
      await onlyImage(await preparer.prepare(stored, "jpeg")),
    ]);

    expect(sizes[0][0]).toBeLessThan(1600);
    expect(tokensOf(sizes)).toBeLessThanOrEqual(MAX_IMAGE_TOKENS);
  });

  it("narrows a tall photo by its upright size, EXIF orientation applied", async () => {
    // Stored 9000 x 1600 (fits as stored); upright it is 1600 x 9000.
    const stored = await twoToneJpeg(9000, 1600, 6);

    const sizes = await sizesOf([
      await onlyImage(await preparer.prepare(stored, "jpeg")),
    ]);

    expect(sizes[0][1]).toBeGreaterThan(sizes[0][0]);
    expect(tokensOf(sizes)).toBeLessThanOrEqual(MAX_IMAGE_TOKENS);
  });

  it("leaves a small image (929 x 606) at its own size", async () => {
    const stored = new Uint8Array(
      await sharp({
        create: { width: 929, height: 606, channels: 3, background: BLUE },
      })
        .png()
        .toBuffer(),
    );

    const sizes = await sizesOf([
      await onlyImage(await preparer.prepare(stored, "png")),
    ]);

    expect(sizes).toEqual([[929, 606]]);
  });
});
