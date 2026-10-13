import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import { templateKey } from "@/app/(dashboard)/review/template-key";
import { buttonVariants } from "@/components/ui/button";
import type {
  DetailDecision,
  DetailDocument,
  DetailRevision,
  RequestDetail,
  RetiredDocument,
} from "@/lib/data/solicitud-detail";
import type { DeadlineStatus } from "@/lib/intake/business-days";
import type { RevisionDiff, SectionMark } from "@/lib/intake/revision-diff";

// The sections of the staff detail (RF-06, RF-08 b). Each one is a labelled
// card, so a later section (the RF-14 document signals) is one more entry in
// the page's stack. Sync components: next-intl resolves text and dates on the
// server, and dates are shown in the business zone, not the server's.

const BUSINESS_TIME_ZONE = "America/Managua";

function useDates() {
  const format = useFormatter();
  const t = useTranslations("review.detail");
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  return {
    instant: (date: Date) =>
      format.dateTime(date, {
        dateStyle: "medium",
        timeZone: BUSINESS_TIME_ZONE,
      }),
    day,
    period: (start: string, end: string) =>
      start === end
        ? day(start)
        : t("period", { start: day(start), end: day(end) }),
  };
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="border-border bg-card shadow-soft flex flex-col gap-4 rounded-xl border p-6"
    >
      <h2 id={`${id}-title`} className="text-headline">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Fact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

const STATE_TONES: Record<string, string> = {
  pendiente: "bg-warning/10 text-warning-ink",
  aprobada: "bg-success/10 text-success-ink",
  rechazada: "bg-destructive/10 text-destructive-ink",
  devuelta: "bg-muted text-muted-foreground",
  en_revision_coordinacion: "bg-muted text-muted-foreground",
};

function StatePill({ estado }: { estado: string }) {
  const t = useTranslations("review.detail.states");
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
        STATE_TONES[estado] ?? STATE_TONES.devuelta,
      )}
    >
      {t(estado)}
    </span>
  );
}

export function RequestSection({
  detail,
  deadline,
}: {
  detail: RequestDetail;
  /** Only for a pending request: the RN-08 state and its date. */
  deadline: { status: DeadlineStatus; label: string; due: string } | null;
}) {
  const t = useTranslations("review.detail");
  const tCauses = useTranslations("intake.causes");
  const dates = useDates();
  const notSet = t("notSet");

  return (
    <Section id="request" title={t("sections.request")}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("fields.state")}>
          <StatePill estado={detail.estado} />
        </Fact>
        <Fact label={t("fields.cause")}>
          {detail.causa ? tCauses(detail.causa) : notSet}
        </Fact>
        <Fact label={t("fields.period")}>
          {detail.fechaInicio && detail.fechaFin
            ? dates.period(detail.fechaInicio, detail.fechaFin)
            : notSet}
        </Fact>
        <Fact label={t("fields.presented")}>
          {detail.presentadaEn ? dates.instant(detail.presentadaEn) : notSet}
        </Fact>
        {detail.reenviadaEn ? (
          <Fact label={t("fields.resubmitted")}>
            {dates.instant(detail.reenviadaEn)}
          </Fact>
        ) : null}
        {deadline ? (
          <Fact label={t("fields.deadline")}>
            <div className="flex flex-col gap-1">
              <DeadlineBadge status={deadline.status} label={deadline.label} />
              <span className="text-muted-foreground text-xs">
                {deadline.due}
              </span>
            </div>
          </Fact>
        ) : null}
      </dl>
    </Section>
  );
}

export function StudentSection({
  student,
}: {
  student: RequestDetail["estudiante"];
}) {
  const t = useTranslations("review.detail");
  const notSet = t("notSet");

  return (
    <Section id="student" title={t("sections.student")}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("fields.name")}>{student.nombre ?? notSet}</Fact>
        <Fact label={t("fields.cif")}>{student.cif ?? notSet}</Fact>
        <Fact label={t("fields.career")}>{student.carrera ?? notSet}</Fact>
        <Fact label={t("fields.email")}>{student.correo ?? notSet}</Fact>
      </dl>
    </Section>
  );
}

export function SubjectsSection({
  classes,
}: {
  classes: RequestDetail["clases"];
}) {
  const t = useTranslations("review.detail");

  return (
    <Section id="subjects" title={t("sections.subjects")}>
      <ul className="flex flex-col gap-3">
        {classes.map((c) => (
          <li
            key={`${c.asignaturaId}-${c.numeroGrupo}`}
            className="flex flex-col gap-1"
          >
            <span className="text-sm font-medium break-words">
              {c.codigo} · {c.nombre}
            </span>
            <span className="text-muted-foreground flex flex-col text-sm sm:flex-row sm:gap-3">
              <span>{t("subject.group", { number: c.numeroGrupo })}</span>
              <span>
                {c.docenteNombre
                  ? t("subject.teacher", { name: c.docenteNombre })
                  : t("subject.noTeacher")}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** View and download go through the authenticated route, which audits both. */
function DocumentRow({ doc, note }: { doc: DetailDocument; note?: string }) {
  const t = useTranslations("review.detail.documents");
  const href = `/api/intake/documents/${doc.id}`;

  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium break-all">
          {doc.nombreOriginal}
        </span>
        {note ? (
          <span className="text-muted-foreground text-xs">{note}</span>
        ) : null}
      </span>
      <span className="flex flex-col gap-2 sm:flex-row">
        <a
          href={`${href}?modo=ver`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("viewNamed", { name: doc.nombreOriginal })}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          {t("view")}
        </a>
        <a
          href={`${href}?modo=descarga`}
          aria-label={t("downloadNamed", { name: doc.nombreOriginal })}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {t("download")}
        </a>
      </span>
    </li>
  );
}

export function DocumentsSection({
  documents,
}: {
  documents: readonly DetailDocument[];
}) {
  const t = useTranslations("review.detail");

  return (
    <Section id="documents" title={t("sections.documents")}>
      {documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("documents.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function DecisionEntry({ decision }: { decision: DetailDecision }) {
  const t = useTranslations("review");
  const dates = useDates();
  const templateLabel = `decision.templates.${templateKey(decision.plantillaCodigo)}`;

  return (
    <li className="border-border flex flex-col gap-2 border-l-2 pl-4">
      <span className="flex flex-wrap items-center gap-2">
        <StatePill estado={decision.tipo} />
        <span className="text-muted-foreground text-xs">
          {t("detail.history.decidedBy", {
            name: decision.secretariaNombre,
            date: dates.instant(decision.decididaEn),
          })}
        </span>
      </span>
      <span className="text-muted-foreground text-xs">
        {t("detail.history.template", {
          name: t.has(templateLabel)
            ? t(templateLabel)
            : decision.plantillaCodigo,
        })}
        {decision.motivoCodigo
          ? ` · ${t("detail.history.reason", {
              reason: t.has(`decision.reasons.${decision.motivoCodigo}`)
                ? t(`decision.reasons.${decision.motivoCodigo}`)
                : decision.motivoCodigo,
            })}`
          : ""}
      </span>
      <p className="text-sm break-words whitespace-pre-wrap">
        {decision.texto ?? t("detail.history.noText")}
      </p>
    </li>
  );
}

function RevisionEntry({ revision }: { revision: DetailRevision }) {
  const t = useTranslations("review.detail");
  const tCauses = useTranslations("intake.causes");
  const dates = useDates();

  return (
    <li className="border-border flex flex-col gap-1 border-l-2 pl-4 text-sm">
      <span className="font-medium">
        {t("history.revision", { number: revision.numero })}
        <span className="text-muted-foreground text-xs font-normal">
          {" "}
          · {dates.instant(revision.creadaEn)}
        </span>
      </span>
      <span>{tCauses(revision.causa)}</span>
      <span className="text-muted-foreground">
        {dates.period(revision.fechaInicio, revision.fechaFin)}
      </span>
      <span className="text-muted-foreground break-words">
        {revision.clases
          .map(
            (c) =>
              `${c.codigo} (${t("subject.group", { number: c.numeroGrupo })})`,
          )
          .join(", ")}
      </span>
      <span className="text-muted-foreground">
        {t("history.revisionDocuments", {
          count: revision.documentoIds.length,
        })}
      </span>
    </li>
  );
}

export function HistorySection({
  decisions,
  revisions,
  retired,
}: {
  decisions: readonly DetailDecision[];
  revisions: readonly DetailRevision[];
  retired: readonly RetiredDocument[];
}) {
  const t = useTranslations("review.detail");
  const dates = useDates();
  const empty =
    decisions.length === 0 && revisions.length === 0 && retired.length === 0;

  return (
    <Section id="history" title={t("sections.history")}>
      {empty ? (
        <p className="text-muted-foreground text-sm">{t("history.empty")}</p>
      ) : null}
      {decisions.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-title">{t("history.decisions")}</h3>
          <ul className="flex flex-col gap-4">
            {decisions.map((decision) => (
              <DecisionEntry key={decision.id} decision={decision} />
            ))}
          </ul>
        </div>
      ) : null}
      {revisions.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-title">{t("history.revisions")}</h3>
          <ul className="flex flex-col gap-4">
            {revisions.map((revision) => (
              <RevisionEntry key={revision.id} revision={revision} />
            ))}
          </ul>
        </div>
      ) : null}
      {retired.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-title">{t("history.retired")}</h3>
          <ul className="flex flex-col gap-4">
            {retired.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                note={t("history.replacedOn", {
                  date: dates.instant(doc.retiradoEn),
                })}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

const MARK_TONES: Record<SectionMark, string> = {
  changed: "bg-warning/10 text-warning-ink",
  unchanged: "bg-muted text-muted-foreground",
};

/** The mark carries its own text, so colour is never the only signal. */
function MarkPill({ mark }: { mark: SectionMark }) {
  const t = useTranslations("review.detail.changes.marks");
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
        MARK_TONES[mark],
      )}
    >
      {t(mark)}
    </span>
  );
}

function DocumentNames({
  title,
  ids,
  pool,
}: {
  title: string;
  ids: readonly number[];
  pool: ReadonlyMap<number, string>;
}) {
  const t = useTranslations("review.detail.changes");
  if (ids.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-title">{title}</h3>
      <ul aria-label={title} className="flex flex-col gap-1">
        {ids.map((id) => (
          <li key={id} className="text-sm break-all">
            {pool.get(id) ?? t("unknownDocument", { id })}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the student changed since the return, first in the stack (SR-17): one
 * mark per section and, for documents, the retired and the added ones by name.
 * Retired names come from the retired documents, added names from the current
 * ones.
 */
export function ChangesSection({
  diff,
  documents,
  retired,
}: {
  diff: RevisionDiff;
  documents: readonly DetailDocument[];
  retired: readonly RetiredDocument[];
}) {
  const t = useTranslations("review.detail.changes");
  const names = new Map(
    [...retired, ...documents].map((doc) => [doc.id, doc.nombreOriginal]),
  );
  const marks = [
    ["causeDates", diff.causeDates],
    ["subjects", diff.subjects],
    ["documents", diff.documents],
  ] as const;

  return (
    <Section id="changes" title={t("title")}>
      <p className="text-muted-foreground max-w-prose text-sm">
        {t("description")}
      </p>
      <ul className="flex flex-col gap-3">
        {marks.map(([key, mark]) => (
          <li
            key={key}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-sm font-medium">{t(`sections.${key}`)}</span>
            <MarkPill mark={mark} />
          </li>
        ))}
      </ul>
      <DocumentNames
        title={t("retired")}
        ids={diff.retiredDocumentIds}
        pool={names}
      />
      <DocumentNames
        title={t("added")}
        ids={diff.addedDocumentIds}
        pool={names}
      />
    </Section>
  );
}
