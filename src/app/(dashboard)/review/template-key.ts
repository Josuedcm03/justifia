/**
 * i18n key of a decision template. next-intl reads a dot as a path separator,
 * so the code `rechazo.general` is labelled under `rechazo_general`.
 */
export function templateKey(codigo: string): string {
  return codigo.replaceAll(".", "_");
}
