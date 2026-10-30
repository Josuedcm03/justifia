// Informed consent of a first presentation (RF-01 d, RN-25). Pure and free of
// `server-only`: the review step and the action both import it.

/**
 * Version of the consent text and of the privacy notice (RC-3). The ISO date of
 * the owner's approval. A change to the es text or to the notice needs a new
 * version and a new pin in `consent.test.ts`.
 *
 * v2 (escalation, E6): the career coordination becomes a recipient. The owner
 * adopted `2026-10-22` as the final version and the team owns the text; any
 * later wording or date change needs a new version and a new pin. Requests
 * presented under v1 (`2026-10-20`) keep their stored version and are not
 * backfilled.
 */
export const CONSENT_VERSION = "2026-10-22";

/** i18n key of the checkbox label; the text itself lives in i18n/{es,en}.json. */
export const CONSENT_LABEL_KEY = "intake.review.consent.label";
