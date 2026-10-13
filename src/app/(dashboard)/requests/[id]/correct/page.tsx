import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  finalizeCorrectionDocumentAction,
  removeCorrectionDocumentAction,
  resubmitCorrectionAction,
  saveCorrectionDetailsAction,
  saveCorrectionSubjectsAction,
} from "@/app/(dashboard)/requests/[id]/correct/actions";
import { CorrectionReasonBanner } from "@/app/(dashboard)/requests/[id]/correct/correction-reason-banner";
import type { Flow } from "@/app/(dashboard)/requests/new/flow";
import { FlowSteps } from "@/app/(dashboard)/requests/new/flow-steps";
import {
  correctionStartStep,
  draftRange,
  parseFromReview,
  parseStep,
} from "@/app/(dashboard)/requests/new/steps";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { listEnrollmentFailSoft } from "@/lib/data/enrollment";
import { getLiveDraft } from "@/lib/data/solicitudes";
import { getCorrectionReason } from "@/lib/data/student-requests";
import { getIntakeDeps } from "@/lib/intake/deps";
import { isReturnReason } from "@/lib/intake/return-reasons";

const POSITIVE_INTEGER = /^[1-9]\d*$/;

/**
 * Correction of the student's own returned request (RF-08 a, RNF-01), reusing
 * the four intake steps in place. The owner comes from the session; another
 * student's id, an unknown id and a request that is not `devuelta` are the same
 * `notFound()`. Nothing here creates a draft: the page only reads, and every
 * action re-checks owner and state itself. The step lives in `?step=`; without
 * one the correction opens at the step of the return reason (RN-17, SR-17).
 */
export default async function CorrectRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(...rolesSolicitantes);
  const { id: rawId } = await params;
  if (!POSITIVE_INTEGER.test(rawId) || !Number.isSafeInteger(Number(rawId))) {
    notFound();
  }
  const id = Number(rawId);
  const userId = Number(session.sub);
  const t = await getTranslations("intake");

  // Fail-soft reads (A7): a database failure is an in-page message, and a
  // reason that cannot be read only costs the guided start and the banner.
  const [request, reason] = await Promise.all([
    getLiveDraft(userId, new Date(), {
      kind: "correction",
      solicitudId: id,
    }).catch(() => undefined),
    getCorrectionReason(userId, id).catch(() => null),
  ]);
  if (request === null) notFound();

  const header = (
    <PageHeader
      title={t("correction.title")}
      description={t("correction.subtitle")}
      action={
        <Link
          href={`/requests/${id}`}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {t("correction.back")}
        </Link>
      }
    />
  );
  if (request === undefined) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <p
          role="status"
          className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
        >
          {t("correction.degraded")}
        </p>
      </div>
    );
  }

  const query = await searchParams;
  const step =
    parseStep(query.step) ??
    correctionStartStep(isReturnReason(reason?.motivo) ? reason.motivo : null);
  const range = draftRange(request);
  const enrollment =
    (step === 2 || step === 4) && range
      ? await listEnrollmentFailSoft(userId, range, getIntakeDeps().schedule)
      : { data: [], degraded: false };

  const flow: Flow = {
    basePath: `/requests/${id}/correct`,
    actions: {
      saveDetails: saveCorrectionDetailsAction.bind(null, id),
      saveSubjects: saveCorrectionSubjectsAction.bind(null, id),
      finalizeDocument: finalizeCorrectionDocumentAction.bind(null, id),
      removeDocument: removeCorrectionDocumentAction.bind(null, id),
      resubmit: resubmitCorrectionAction.bind(null, id),
    },
  };

  return (
    <div className="flex flex-col gap-8">
      {header}
      {reason ? (
        <CorrectionReasonBanner motivo={reason.motivo} texto={reason.texto} />
      ) : null}
      <FlowSteps
        step={step}
        draft={request}
        enrollment={enrollment}
        fromReview={parseFromReview(query.from)}
        flow={flow}
      />
    </div>
  );
}
