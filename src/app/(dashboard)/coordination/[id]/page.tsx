import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AnswerForm } from "@/app/(dashboard)/coordination/[id]/answer-form";
import {
  CoordinationEscalationSection,
  CoordinationNoticeSection,
  CoordinationRequestSection,
  CoordinationStudentSection,
} from "@/app/(dashboard)/coordination/[id]/coordination-sections";
import {
  DocumentsSection,
  Section,
  SubjectsSection,
} from "@/app/(dashboard)/review/[id]/request-sections";
import { SignalsSection } from "@/app/(dashboard)/review/[id]/signals-section";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesCoordinadores, signalsAccess } from "@/lib/auth/permissions";
import { getCoordinationDetail } from "@/lib/data/coordination-queue";
import { resolveCoordinationScope } from "@/lib/data/coordination-scope";
import { recordRequestRead } from "@/lib/data/request-reads";
import { loadSignals } from "@/lib/data/signals";
import { isVisibleState } from "@/lib/intake/states";
import { toCoordinationView } from "@/lib/signals/coordination-view";
import type { SignalView } from "@/lib/signals/types";

const POSITIVE_INTEGER = /^[1-9]\d*$/;

/**
 * The validation signals of the escalated request, as the coordinator may see
 * them (RF-05 a, RN-26, RNF-01): outcomes, reason labels and the verdict, never
 * an RN-26 reference, so the scope is `none`. The read is fail-soft; only the
 * error name is logged (RNF-04). It writes nothing and adds no audit row.
 */
async function loadCoordinationSignals(
  solicitudId: number,
): Promise<{ data: SignalView | null; degraded: boolean }> {
  try {
    const read = await loadSignals({
      solicitudId,
      referenceScope: { kind: "none" },
    });
    return {
      degraded: read.degraded,
      data: read.data ? toCoordinationView(read.data) : null,
    };
  } catch (error) {
    console.error("signals_read_failed", {
      solicitudId,
      code: error instanceof Error ? error.name : "unknown",
    });
    return { data: null, degraded: true };
  }
}

/**
 * The coordinator detail of one escalation record (RF-10, E1, E10, RNF-01),
 * keyed by the escalation id, not the request. The audited read is written
 * here, in the page body, after authorisation and after the data loaded, before
 * the JSX is returned (SR-11). An id of another career, an answered
 * suspicion, a draft and an unknown id are the same `notFound()`.
 */
export default async function CoordinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(...rolesCoordinadores);
  const actorId = Number(user.sub);
  const { id: rawId } = await params;
  if (!POSITIVE_INTEGER.test(rawId) || !Number.isSafeInteger(Number(rawId))) {
    notFound();
  }

  const scope = await resolveCoordinationScope(actorId, user.rol);
  if (scope.kind === "none") notFound();
  const detail = await getCoordinationDetail(scope, Number(rawId));
  if (!detail || !isVisibleState(detail.estado)) notFound();

  const t = await getTranslations("coordination.detail");

  // Only an open escalation has documents to check; a notice has none. Read
  // with the rest, before the single audited read (RNF-06).
  const signals =
    detail.kind === "escalation" && signalsAccess(user.rol) === "outcomes"
      ? await loadCoordinationSignals(detail.solicitudId)
      : null;

  await recordRequestRead(actorId, detail.solicitudId, detail.estado);

  const name = detail.estudiante.nombre ?? t("unnamed");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title", { name })}
        description={
          detail.kind === "escalation"
            ? t("description")
            : t("noticeDescription")
        }
        action={
          <Link
            href="/coordination"
            prefetch={false}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t("back")}
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <CoordinationStudentSection student={detail.estudiante} />
        {detail.kind === "escalation" ? (
          <>
            <CoordinationRequestSection detail={detail} />
            <CoordinationEscalationSection detail={detail} />
            <SubjectsSection classes={detail.clases} />
            <DocumentsSection documents={detail.documentos} />
            {signals ? (
              <SignalsSection signals={signals} audience="coordination" />
            ) : null}
            <Section id="answer" title={t("sections.answer")}>
              <AnswerForm escalamientoId={detail.id} />
            </Section>
          </>
        ) : (
          <CoordinationNoticeSection detail={detail} />
        )}
      </div>
    </div>
  );
}
