// One line of plain text for a mail body: control characters and runs of
// spaces collapse, so a name or a note can never add lines or headers.

export function oneLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
}
