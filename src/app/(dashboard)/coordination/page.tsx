import { getTranslations } from "next-intl/server";

import { CoordinationList } from "@/app/(dashboard)/coordination/coordination-list";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { rolesCoordinadores } from "@/lib/auth/permissions";
import { listCoordinationEscalations } from "@/lib/data/coordination-queue";
import { resolveCoordinationScope } from "@/lib/data/coordination-scope";
import { recordEscalationQueueRead } from "@/lib/data/request-reads";

const ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";
const NOTICE =
  "border-success/30 border-l-success bg-success/8 text-success-ink rounded-lg border border-l-4 px-3 py-2 text-sm";
/** The outcomes a redirect back to the list can confirm. */
const RESULT_CODES = ["respondida"] as const;

/**
 * The coordinator's list of escalated requests of the own career (RF-10, E1,
 * RNF-01). The audited read happens here, in the page body, after
 * authorisation and after the data loaded (SR-11): never in a layout or a
 * loading file, and every link to this route opts out of prefetch. A
 * coordinator without a career, or an inactive one, is denied everything and
 * nothing is read or audited; the scope cannot tell the two apart, so the text
 * names both. The cause is health data and is never listed (RNF-06).
 */
export default async function CoordinationListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(...rolesCoordinadores);
  const t = await getTranslations("coordination.list");
  const actorId = Number(user.sub);
  const { resultado } = await searchParams;

  const header = (
    <PageHeader title={t("title")} description={t("description")} />
  );

  const scope = await resolveCoordinationScope(actorId, user.rol);
  if (scope.kind === "none") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <div role="alert" className={`${ALERT} flex flex-col gap-1`}>
          <p className="font-medium">{t("noAccess.title")}</p>
          <p>{t("noAccess.message")}</p>
        </div>
      </div>
    );
  }

  const { open, notices } = await listCoordinationEscalations(scope);
  await recordEscalationQueueRead(
    actorId,
    scope.carreraId,
    open.length + notices.length,
  );

  const answered = RESULT_CODES.find((code) => code === resultado);

  return (
    <div className="flex flex-col gap-8">
      {header}
      {answered ? (
        <p role="status" className={NOTICE}>
          {t(`result.${answered}`)}
        </p>
      ) : null}
      <CoordinationList open={open} notices={notices} />
    </div>
  );
}
