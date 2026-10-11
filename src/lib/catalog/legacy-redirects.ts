// Redirects for the retired standalone Grupos catalog (CM-RTE-1, design UG-4).
// Plain data read by `next.config.ts`, so it imports nothing from the app: the
// config is loaded before any alias exists. Every rule is temporary (307) and
// reads no data; whether an id names a usable Asignatura is decided by the
// destination page.

type QueryMatch = { type: "query"; key: string; value: string };

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: false;
  has?: QueryMatch[];
  missing?: QueryMatch[];
};

/**
 * What `parseRecordId` accepts: a positive integer of 1 to 15 digits with no
 * leading zero. Next anchors a `has`/`missing` value as `^value$`, so the
 * pattern carries no anchors of its own.
 */
const RECORD_ID = "[1-9][0-9]{0,14}";

export const LEGACY_GRUPOS_REDIRECTS: LegacyRedirect[] = [
  // The retired list. Next carries the request query to the destination, so
  // `q` survives; a key written in the destination takes the place of the
  // request's, which pins `status` and `page` to their defaults. The old
  // values belonged to groups and must not filter or page Asignaturas.
  {
    source: "/catalog/grupos",
    destination: "/catalog/asignaturas?status=active&page=1",
    permanent: false,
  },
  // A usable-looking Asignatura id goes to that Asignatura's new-group page.
  {
    source: "/catalog/grupos/new",
    has: [
      {
        type: "query",
        key: "asignaturaId",
        value: `(?<asignaturaId>${RECORD_ID})`,
      },
    ],
    destination: "/catalog/asignaturas/:asignaturaId/grupos/new",
    permanent: false,
  },
  // The complement: absent, empty or invalid id. The two rules never both
  // match, so their order does not matter.
  {
    source: "/catalog/grupos/new",
    missing: [{ type: "query", key: "asignaturaId", value: RECORD_ID }],
    destination: "/catalog/asignaturas",
    permanent: false,
  },
];
