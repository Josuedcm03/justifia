import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import {
  DecisionSection,
  DocumentsSection,
  HistorySection,
  RequestSection,
  SubjectsSection,
} from "@/app/(dashboard)/requests/[id]/detail-sections";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { getOwnRequestDetail } from "@/lib/data/student-requests";

const POSITIVE_INTEGER = /^[1-9]\d*$/;

/**
 * The student's own request (RF-07 c, RF-08 b, RNF-01). The owner comes from
 * the session; another student's id, a draft and an unknown id are the same
 * `notFound()`. Own reads are not audited, and no deadline is shown: the RN-08
 * clock is the secretary's concern. A returned request offers the correction.
 */
export default async function OwnRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(...rolesSolicitantes);
  const { id: rawId } = await params;
  if (!POSITIVE_INTEGER.test(rawId) || !Number.isSafeInteger(Number(rawId))) {
    notFound();
  }

  const detail = await getOwnRequestDetail(Number(user.sub), Number(rawId));
  if (!detail) notFound();

  const t = await getTranslations("requests");
  const format = await getFormatter();
  const presented = detail.presentadaEn
    ? format.dateTime(detail.presentadaEn, {
        dateStyle: "medium",
        timeZone: "America/Managua",
      })
    : t("notSet");
  const correctHref =
    detail.estado === "devuelta" ? `/requests/${detail.id}/correct` : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("detail.title", { id: detail.id })}
        description={t("detail.description", { date: presented })}
        action={
          <Link
            href="/requests"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t("detail.back")}
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {detail.decision || correctHref ? (
          <DecisionSection
            decision={detail.decision}
            correctHref={correctHref}
          />
        ) : null}
        <RequestSection detail={detail} />
        <SubjectsSection classes={detail.clases} />
        <DocumentsSection documents={detail.documentos} />
        {detail.historial.length > 0 || detail.revisiones.length > 0 ? (
          <HistorySection
            decisions={detail.historial}
            revisions={detail.revisiones}
          />
        ) : null}
      </div>
    </div>
  );
}
