import {
  BRAND,
  BRAND_LOGO_ALT,
  BRAND_LOGO_CONTENT_ID,
} from "@/lib/escalation/brand";

// The HTML part of the coordination notice (E6, E18): one template for the
// escalation and for the informational excess notice. Email-safe, which means a
// table layout, inline styles only, a 600 px column, a system font stack and a
// "bulletproof" button (the colored cell carries the padding, because Outlook
// ignores the padding of a link). It loads nothing but the inline brand image
// (`cid:`): no script, no stylesheet, no remote image, no tracking pixel. Every
// value that comes from data is escaped here; the caller passes plain text.

const FONT = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
const WIDTH = 600;
const SIDE = 32;

export type EscalationHtmlInput = {
  /** Title bar, e.g. "Solicitud escalada a coordinación". */
  title: string;
  intro: string;
  rows: readonly { label: string; value: string }[];
  /** Label of the button, e.g. "Revisar solicitud". */
  buttonLabel: string;
  link: string;
};

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function summaryRow(label: string, value: string): string {
  return (
    `<tr>` +
    `<td valign="top" width="120" style="padding:8px 12px 8px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT};font-size:14px;line-height:20px;color:${BRAND.muted};">${escapeHtml(label)}</td>` +
    `<td valign="top" style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT};font-size:14px;line-height:20px;color:${BRAND.text};">${escapeHtml(value)}</td>` +
    `</tr>`
  );
}

export function renderEscalationHtml(input: EscalationHtmlInput): string {
  const link = escapeHtml(input.link);
  const title = escapeHtml(input.title);

  return [
    `<!DOCTYPE html>`,
    `<html lang="es" xmlns="http://www.w3.org/1999/xhtml">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta name="x-apple-disable-message-reformatting">`,
    `<meta name="color-scheme" content="light">`,
    `<title>${title}</title>`,
    `</head>`,
    `<body style="margin:0;padding:0;background-color:${BRAND.page};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.page};">`,
    `<tr><td align="center" style="padding:24px 12px;">`,
    `<table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${WIDTH}px;background-color:${BRAND.surface};">`,
    // Header with the lockup.
    `<tr><td align="left" style="padding:24px ${SIDE}px 20px ${SIDE}px;">` +
      `<img src="cid:${BRAND_LOGO_CONTENT_ID}" width="240" alt="${escapeHtml(BRAND_LOGO_ALT)}" style="display:block;border:0;outline:none;text-decoration:none;width:240px;max-width:100%;height:auto;">` +
      `</td></tr>`,
    // Title bar: the teal of the UAM, with the orange of the FIA as an accent.
    `<tr><td bgcolor="${BRAND.teal}" style="background-color:${BRAND.teal};padding:16px ${SIDE}px;font-family:${FONT};font-size:20px;line-height:26px;font-weight:bold;color:${BRAND.onTeal};">${title}</td></tr>`,
    `<tr><td height="4" bgcolor="${BRAND.orange}" style="background-color:${BRAND.orange};font-size:0;line-height:4px;">&nbsp;</td></tr>`,
    // Greeting and introduction.
    `<tr><td style="padding:24px ${SIDE}px 8px ${SIDE}px;font-family:${FONT};font-size:15px;line-height:22px;color:${BRAND.text};">` +
      `<p style="margin:0 0 12px 0;">Estimada coordinación:</p>` +
      `<p style="margin:0;">${escapeHtml(input.intro)}</p>` +
      `</td></tr>`,
    // Summary.
    `<tr><td style="padding:12px ${SIDE}px 8px ${SIDE}px;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND.line};">` +
      input.rows.map((r) => summaryRow(r.label, r.value)).join("") +
      `</table></td></tr>`,
    // Button.
    `<tr><td align="left" style="padding:16px ${SIDE}px 8px ${SIDE}px;">` +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td align="center" bgcolor="${BRAND.orange}" style="background-color:${BRAND.orange};border-radius:4px;padding:12px 28px;">` +
      `<a href="${link}" target="_blank" style="font-family:${FONT};font-size:16px;line-height:20px;font-weight:bold;color:${BRAND.onOrange};text-decoration:none;display:inline-block;">${escapeHtml(input.buttonLabel)}</a>` +
      `</td></tr></table></td></tr>`,
    // The same link as plain text.
    `<tr><td style="padding:12px ${SIDE}px 24px ${SIDE}px;font-family:${FONT};font-size:13px;line-height:20px;color:${BRAND.muted};">` +
      `Debe iniciar sesión en el sistema para ver la solicitud. Si el botón no funciona, copie este enlace en su navegador:<br>` +
      `<a href="${link}" target="_blank" style="color:${BRAND.text};word-break:break-all;">${link}</a>` +
      `</td></tr>`,
    // Footer.
    `<tr><td style="padding:16px ${SIDE}px 24px ${SIDE}px;border-top:1px solid ${BRAND.line};font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};">` +
      `Secretaría Académica · Facultad de Ingeniería y Arquitectura · Universidad Americana (UAM)<br>` +
      `Este es un aviso automático de Justifia; no responda a este correo.` +
      `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</body>`,
    `</html>`,
  ].join("\n");
}
