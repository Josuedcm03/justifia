import type { MailAttachment } from "@/lib/intake/ports";

import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo-data";

// Identity of the coordination notice (E18): the Universidad Americana (UAM) and
// its Facultad de Ingeniería y Arquitectura (FIA). The two accents are sampled
// from the pixels of the official lockup (`public/brand/uam-fia-logo.png`). The
// text colors are chosen for contrast on the surfaces they sit on, not taken
// from the logo: white on the orange accent would be 2.9:1, so the button uses a
// dark text instead. Pure data and one pure function, no I/O.

export const BRAND = {
  /** The teal of the UAM wordmark. */
  teal: "#0098a7",
  /** The orange of the FIA mark. */
  orange: "#ee7601",
  /** Text on the teal title bar (large bold text, 3:1 needed). */
  onTeal: "#ffffff",
  /** Text on the orange button (16 px bold, 4.5:1 needed). */
  onOrange: "#1f2933",
  /** Body text, and the muted text of labels and of the footer. */
  text: "#1f2933",
  muted: "#52606d",
  surface: "#ffffff",
  page: "#f3f5f7",
  line: "#d9dee3",
} as const;

export const BRAND_LOGO_CONTENT_ID = "uam-fia-logo";
export const BRAND_LOGO_FILENAME = "uam-fia-logo.png";

/** Alternative text of the lockup, for clients that block images. */
export const BRAND_LOGO_ALT =
  "Universidad Americana (UAM) · Facultad de Ingeniería y Arquitectura";

let logo: Uint8Array | undefined;

/**
 * The brand image as an inline attachment (referenced as `cid:` from the HTML).
 * It is a brand asset with no personal data, not a request document, so the
 * rule of no document attachments (E6) still holds. Gmail does not load images
 * from a local host and a remote image would be a tracking surface, hence
 * inline.
 */
export function brandLogoAttachment(): MailAttachment {
  logo ??= new Uint8Array(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"));
  return {
    filename: BRAND_LOGO_FILENAME,
    contentType: "image/png",
    content: logo,
    contentId: BRAND_LOGO_CONTENT_ID,
  };
}

function channel(hex: string, from: number): number {
  const value = parseInt(hex.slice(from, from + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return (
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5)
  );
}

/** WCAG 2 contrast ratio of two `#rrggbb` colors. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
