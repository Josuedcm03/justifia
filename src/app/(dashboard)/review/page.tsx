import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { recordQueueRead } from "@/lib/data/request-reads";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { listReviewQueue, type QueueRow } from "@/lib/data/revision-queue";
import { calendar } from "@/lib/intake/calendar";
import { DECISION_KINDS } from "@/lib/intake/decision-templates";

const BASE = "/review";
const BUSINESS_TIME_ZONE = "America/Managua";
const ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";
const NOTICE =
  "border-success/30 border-l-success bg-success/8 text-success-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

/**
 * The staff queue (RF-06, SR-10). The audited read happens here, in the page
 * body, after authorisation and after the data loaded (SR-11): never in a
 * layout or a loading file, and every link to this route opts out of prefetch.
 * The absence cause is health data and is never listed (RNF-06).
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

  const header = (
    <PageHeader title={t("title")} description={t("description")} />
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

  const queue = await listReviewQueue(scope, new Date(), calendar);
  await recordQueueRead(actorId, scope.facultadId, queue.rows.length);

  const { resultado } = await searchParams;
  const decided = DECISION_KINDS.find((kind) => kind === resultado);

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
  const student = (row: QueueRow) => (
    <div className="flex flex-col">
      <span className="font-medium break-words">{name(row)}</span>
      {row.estudianteCif ? (
        <span className="text-muted-foreground text-xs">
          {row.estudianteCif}
        </span>
      ) : null}
    </div>
  );
  const resubmitted = (row: QueueRow) =>
    row.reenviada ? (
      <span className="text-muted-foreground text-xs">{t("resubmitted")}</span>
    ) : null;
  const subjects = (row: QueueRow) =>
    t("subjectsCount", { count: row.asignaturas });

  const columns: readonly DataTableColumn<QueueRow>[] = [
    {
      key: "received",
      header: t("columns.received"),
      cell: (row) => (
        <div className="flex flex-col">
          <span>{received(row)}</span>
          {resubmitted(row)}
        </div>
      ),
      className: "tabular-nums",
    },
    { key: "student", header: t("columns.student"), cell: student },
    {
      key: "career",
      header: t("columns.career"),
      cell: (row) => row.estudianteCarrera ?? "",
      className: "text-muted-foreground",
    },
    { key: "subjects", header: t("columns.subjects"), cell: subjects },
    { key: "deadline", header: t("columns.deadline"), cell: deadline },
    {
      key: "action",
      header: t("columns.action"),
      align: "end",
      cell: reviewLink,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {header}

      {decided ? (
        <p role="status" className={NOTICE}>
          {t(`result.${decided}`)}
        </p>
      ) : null}

      {queue.calendarLoaded ? null : (
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("calendarNotLoaded")}
        </p>
      )}

      {queue.rows.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
          <p className="text-muted-foreground max-w-prose">{t("empty")}</p>
        </div>
      ) : (
        <>
          <ul
            aria-label={t("caption")}
            className="flex flex-col gap-4 md:hidden"
          >
            {queue.rows.map((row) => (
              <li
                key={row.id}
                className="border-border bg-card shadow-soft flex flex-col gap-3 rounded-xl border p-4"
              >
                {student(row)}
                <p className="text-muted-foreground text-sm break-words">
                  {row.estudianteCarrera} · {subjects(row)}
                </p>
                <p className="text-sm">
                  {received(row)} {resubmitted(row)}
                </p>
                {deadline(row)}
                {reviewLink(row)}
              </li>
            ))}
          </ul>

          <div className="border-border bg-card shadow-soft hidden overflow-hidden rounded-xl border md:block">
            <DataTable
              columns={columns}
              rows={queue.rows}
              getRowKey={(row) => row.id}
              caption={t("caption")}
              empty={null}
            />
          </div>
        </>
      )}
    </div>
  );
}
