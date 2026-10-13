import type { TipoDetectado } from "./signature";

// Blob pathnames (design: Limits). `intake/{solicitudId}/{uuid}.{ext}`: the
// original file name is stored only in the database (C28), never in the path.

export const INTAKE_ROOT_PREFIX = "intake/";

export function draftPrefix(solicitudId: number): string {
  return `${INTAKE_ROOT_PREFIX}${solicitudId}/`;
}

export function buildPathname(
  solicitudId: number,
  uuid: string,
  tipo: TipoDetectado,
): string {
  return `${draftPrefix(solicitudId)}${uuid}.${tipo}`;
}

/** The request id a pathname claims (`intake/{id}/{file}`), or null if malformed. */
export function solicitudIdOf(pathname: string): number | null {
  if (!pathname.startsWith(INTAKE_ROOT_PREFIX)) return null;
  const [id, name, ...rest] = pathname
    .slice(INTAKE_ROOT_PREFIX.length)
    .split("/");
  if (rest.length > 0 || !name || !/^[1-9]\d*$/.test(id)) return null;
  const value = Number(id);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Ownership check for finalize and the token route: the pathname must be a
 * single file name directly under the caller's own draft prefix. Rejects other
 * drafts (including numeric prefix collisions such as 42 vs 420), traversal and
 * nesting.
 */
export function isUnderDraftPrefix(
  pathname: string,
  solicitudId: number,
): boolean {
  const prefix = draftPrefix(solicitudId);
  if (!pathname.startsWith(prefix)) return false;
  const name = pathname.slice(prefix.length);
  return (
    name.length > 0 && name !== "." && name !== ".." && !name.includes("/")
  );
}
