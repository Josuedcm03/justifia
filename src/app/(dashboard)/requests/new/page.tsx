import { getTranslations } from "next-intl/server";

import { EnrollmentNotice } from "@/app/(dashboard)/requests/new/enrollment-notice";
import { FlowSteps } from "@/app/(dashboard)/requests/new/flow-steps";
import {
  defaultStep,
  draftRange,
  parseFromReview,
  parseStep,
} from "@/app/(dashboard)/requests/new/steps";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import {
  hasActiveEnrollmentFailSoft,
  listEnrollmentFailSoft,
} from "@/lib/data/enrollment";
import { type Draft, openDraft } from "@/lib/data/solicitudes";
import { getIntakeDeps } from "@/lib/intake/deps";

// Applies to every Server Action used on this page. The submit hands the
// request to document extraction, which keeps running after the response (DE-5,
// N2, N3). Next reads segment config statically, so this must be a literal, not
// an import; `max-duration.test.ts` pins it to EXTRACTION_MAX_DURATION_S.
export const maxDuration = 300;

/**
 * Fail-soft draft read (A7): a database or storage-wiring failure becomes an
 * in-page message, never an error screen. Resuming or creating the draft is the
 * only write a visit makes, and it is the student's own (D8).
 */
async function loadDraft(userId: number): Promise<Draft | null> {
  try {
    return await openDraft(userId, new Date(), getIntakeDeps().store);
  } catch {
    return null;
  }
}

/**
 * Container of the intake flow. The page guard is only the first line: every
 * action and route re-checks role and ownership itself (RNF-01). The step lives
 * in `?step=` and the draft on the server, so refresh and back are safe (A7).
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(...rolesSolicitantes);
  const userId = Number(session.sub);
  const t = await getTranslations("intake");

  const draft = await loadDraft(userId);
  const header = <PageHeader title={t("title")} description={t("subtitle")} />;

  if (!draft) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <p
          role="status"
          className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
        >
          {t("degraded")}
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const step = parseStep(params.step) ?? defaultStep(draft);
  const fromReview = parseFromReview(params.from);
  const range = draftRange(draft);
  // Enrollment is read only by the steps that list it (subjects, review), and
  // only with dates.
  const enrollment =
    (step === 2 || step === 4) && range
      ? await listEnrollmentFailSoft(userId, range, getIntakeDeps().schedule)
      : { data: [], degraded: false, enrolled: true };
  // Only an answered "no enrollment" nudges: a failed read says nothing.
  const hasEnrollment = await hasActiveEnrollmentFailSoft(userId);

  return (
    <div className="flex flex-col gap-8">
      {header}
      {hasEnrollment === false ? (
        <EnrollmentNotice
          message={t("enrollmentNotice.text")}
          linkLabel={t("enrollmentNotice.link")}
        />
      ) : null}
      <FlowSteps
        step={step}
        draft={draft}
        enrollment={enrollment}
        fromReview={fromReview}
      />
    </div>
  );
}
