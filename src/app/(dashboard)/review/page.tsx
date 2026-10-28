import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { ApprovedTab } from "@/app/(dashboard)/review/approved-tab";
import { CoordinationTab } from "@/app/(dashboard)/review/coordination-tab";
import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import {
  BUSINESS_TIME_ZONE,
  QueueCard,
  QueueEmpty,
  QueueStudent,
} from "@/app/(dashboard)/review/queue-parts";
import {
  ReviewQueueTable,
  type ReviewQueueTableRow,
} from "@/app/(dashboard)/review/review-queue-table";
import { ReviewTabs } from "@/app/(dashboard)/review/review-tabs";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { recordQueueRead } from "@/lib/data/request-reads";
import { resolveRequestScope } from "@/lib/data/request-scope";
import {
  listApprovedRequests,
  listCoordinationQueue,
  listReviewQueue,
  type ApprovedRow,
  type CoordinationQueueRow,
  type QueueRow,
  type ReviewQueue,
} from "@/lib/data/revision-queue";
import { calendar } from "@/lib/intake/calendar";
import { DECISION_KINDS } from "@/lib/intake/decision-templates";
import { reviewTabOf, type ReviewTab } from "@/lib/intake/review-tabs";
import type { RequestScope } from "@/lib/intake/request-scope";

const BASE = "/review";
const ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";
/** The outcomes a redirect back to the queue can confirm. */
const RESULT_CODES = [...DECISION_KINDS, "escalada"] as const;
const NOTICE =
  "border-success/30 border-l-success bg-success/8 text-success-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

type TabData =
  | { tab: "pendiente"; queue: ReviewQueue }
  | { tab: "en_revision_coordinacion"; rows: CoordinationQueueRow[] }
  | { tab: "aprobada"; rows: ApprovedRow[] };

/** Reads only the selected tab; the other two are never queried. */
async function loadTab(
  tab: ReviewTab,
  scope: RequestScope,
  now: Date,
): Promise<TabData> {
  switch (tab) {
    case "pendiente":
      return { tab, queue: await listReviewQueue(scope, now, calendar) };
    case "en_revision_coordinacion":
      return { tab, ...(await listCoordinationQueue(scope)) };
    case "aprobada":
      return { tab, ...(await listApprovedRequests(scope)) };
  }
}

/**
 * The staff queue with its state tabs (RF-06, RF-10, RF-15, SR-10). The audited read happens here, in the page
 * body, after authorisation and after the data loaded (SR-11): never in a
 * layout or a loading file, and every link to this route opts out of prefetch.
 * The absence cause is health data and is never listed (RNF-06). One tab is
 * read and one `solicitud.cola.consultada` row is written per render, with the
 * tab code.
 */
export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(...rolesRevisores);
  const t = await getTranslations("review.queue");
  const format = await getFormatter();
  const actorId = Number(user.sub);
  const { resultado, estado } = await searchParams;
  const tab = reviewTabOf(estado);

  const header = (
    <PageHeader
      title={t("title")}
      description={t(
        {
          pendiente: "description",
          en_revision_coordinacion: "coordination.description",
          aprobada: "approved.description",
        }[tab],
      )}
    />
  );

  const scope = await resolveRequestScope(actorId, user.rol);
  if (scope.kind === "none") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <div role="alert" className={`${ALERT} flex flex-col gap-1`}>
          <p className="font-medium">{t("noFaculty.title")}</p>
          <p>{t("noFaculty.message")}</p>
        </div>
      </div>
    );
  }

  const data = await loadTab(tab, scope, new Date());
  await recordQueueRead(
    actorId,
    scope.facultadId,
    data.tab === "pendiente" ? data.queue.rows.length : data.rows.length,
    tab,
  );

  const decided = RESULT_CODES.find((code) => code === resultado);
  const banner = decided ? (
    <p role="status" className={NOTICE}>
      {t(`result.${decided}`)}
    </p>
  ) : null;

  if (data.tab !== "pendiente") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        {banner}
        <ReviewTabs current={tab} />
        {data.tab === "en_revision_coordinacion" ? (
          <CoordinationTab rows={data.rows} />
        ) : (
          <ApprovedTab rows={data.rows} />
        )}
      </div>
    );
  }
  const { queue } = data;

  const received = (row: QueueRow) =>
    format.dateTime(row.clockStart, {
      dateStyle: "medium",
      timeZone: BUSINESS_TIME_ZONE,
    });
  const dueOn = (row: QueueRow) =>
    t("deadline.due", {
      date: format.dateTime(new Date(`${row.deadline}T00:00:00Z`), {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    });
  const deadlineLabel = (row: QueueRow) =>
    ({
      en_plazo: t("deadline.onTime"),
      por_vencer: t("deadline.dueSoon"),
      vencida: t("deadline.overdue"),
    })[row.status];
  const name = (row: QueueRow) => row.estudianteNombre ?? t("unnamed");
  const resubmitted = (row: QueueRow) =>
    row.reenviada ? (
      <span className="text-muted-foreground text-xs">{t("resubmitted")}</span>
    ) : null;
  const subjects = (row: QueueRow) =>
    t("subjectsCount", { count: row.asignaturas });
  const reviewLink = (row: QueueRow) => (
    <Link
      href={`${BASE}/${row.id}`}
      prefetch={false}
      aria-label={t("reviewNamed", { name: name(row) })}
      className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full sm:w-auto`}
    >
      {t("review")}
    </Link>
  );
  const deadline = (row: QueueRow) => (
    <div className="flex flex-col gap-1">
      <DeadlineBadge status={row.status} label={deadlineLabel(row)} />
      <span className="text-muted-foreground text-xs">{dueOn(row)}</span>
    </div>
  );

  // The desktop table is a client module: it receives plain display values,
  // picked field by field, never the data-layer row and never a function.
  const tableRows: ReviewQueueTableRow[] = queue.rows.map((row) => ({
    id: row.id,
    receivedText: received(row),
    resubmittedNote: row.reenviada ? t("resubmitted") : null,
    name: name(row),
    cif: row.estudianteCif,
    career: row.estudianteCarrera ?? "",
    subjectsText: subjects(row),
    deadlineStatus: row.status,
    deadlineLabel: deadlineLabel(row),
    dueOnText: dueOn(row),
    reviewLabel: t("review"),
    reviewAriaLabel: t("reviewNamed", { name: name(row) }),
  }));

  return (
    <div className="flex flex-col gap-8">
      {header}

      {banner}

      <ReviewTabs current={tab} />

      {queue.calendarLoaded ? null : (
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("calendarNotLoaded")}
        </p>
      )}

      {queue.rows.length === 0 ? (
        <QueueEmpty message={t("empty")} />
      ) : (
        <>
          <ul
            aria-label={t("caption")}
            className="flex flex-col gap-4 md:hidden"
          >
            {queue.rows.map((row) => (
              <QueueCard key={row.id}>
                <QueueStudent name={name(row)} cif={row.estudianteCif} />
                <p className="text-muted-foreground text-sm break-words">
                  {row.estudianteCarrera} · {subjects(row)}
                </p>
                <p className="text-sm">
                  {received(row)} {resubmitted(row)}
                </p>
                {deadline(row)}
                {reviewLink(row)}
              </QueueCard>
            ))}
          </ul>

          <div className="border-border bg-card shadow-soft hidden overflow-hidden rounded-xl border md:block">
            <ReviewQueueTable rows={tableRows} caption={t("caption")} />
          </div>
        </>
      )}
    </div>
  );
}
