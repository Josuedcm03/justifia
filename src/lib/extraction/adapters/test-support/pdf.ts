// Test support: builds minimal, valid PDFs by hand so the preparer tests need
// no real document (RNF-04). Not used by production code.

export interface PdfPage {
  /** Page size in points; defaults to US Letter. */
  width?: number;
  height?: number;
  /** Fills the whole page with this gray (0 black .. 1 white); default white. */
  gray?: number;
  /** Printed in black Helvetica near the top of the page (ASCII, no parens). */
  text?: string;
}

const FONT_ID = 3;

/** One content stream per page, a proper cross-reference table. */
export function buildPdf(pages: readonly PdfPage[]): Uint8Array {
  const firstPageId = FONT_ID + 1;
  const pageIds = pages.map((_, i) => firstPageId + i * 2);
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] ` +
    `/Count ${pages.length} >>`;
  objects[FONT_ID] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  pages.forEach((page, i) => {
    const width = page.width ?? 612;
    const height = page.height ?? 792;
    const stream = [
      `q ${page.gray ?? 1} g 0 0 ${width} ${height} re f Q`,
      page.text
        ? `BT /F1 36 Tf 0 g 40 ${height - 80} Td (${page.text}) Tj ET`
        : "",
    ].join("\n");
    const pageId = pageIds[i];
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
      `/Resources << /Font << /F1 ${FONT_ID} 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  body +=
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, "latin1"));
}
