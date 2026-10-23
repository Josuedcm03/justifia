import { cn } from "cn";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { StatePill } from "@/app/(dashboard)/requests/state-pill";
import { useRequestDates } from "@/app/(dashboard)/requests/use-request-dates";
import { Fact, Section } from "@/app/(dashboard)/review/[id]/request-sections";
import { buttonVariants } from "@/components/ui/button";
import type {
  DetailDocument,
  DetailRevision,
} from "@/lib/data/solicitud-detail";
import type {
  OwnDecision,
  OwnRequestDetail,
} from "@/lib/data/student-requests";

// The sections of the student's request detail (RF-07 c, RF-08 b). They share
// the staff detail's labelled card, and read their own `requests.*` text. Sync
// components: next-intl resolves text and dates on the server.

export function RequestSection({ detail }: { detail: OwnRequestDetail }) {
  const t = useTranslations("requests");
  const tCauses = useTranslations("intake.causes");
  const dates = useRequestDates();
  const { causa, fechaInicio, fechaFin, presentadaEn, reenviadaEn } = detail;

  return (
    <Section id="request" title={t("detail.sections.request")}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("detail.fields.state")}>
          <StatePill estado={detail.estado} />
        </Fact>
        <Fact label={t("detail.fields.cause")}>
          {causa ? tCauses(causa) : t("notSet")}
        </Fact>
        <Fact label={t("detail.fields.period")}>
          {fechaInicio && fechaFin
            ? dates.period(fechaInicio, fechaFin)
            : t("notSet")}
        </Fact>
        <Fact label={t("detail.fields.presented")}>
          {presentadaEn ? dates.instant(presentadaEn) : t("notSet")}
        </Fact>
        {reenviadaEn ? (
          <Fact label={t("detail.fields.resubmitted")}>
            {dates.instant(reenviadaEn)}
          </Fact>
        ) : null}
      </dl>
    </Section>
  );
}

/** The decision itself: when, the RN-17 reason when there is one, the text. */
function DecisionBody({ decision }: { decision: OwnDecision }) {
  const t = useTranslations("requests.detail");
  const dates = useRequestDates();
  const { motivoCodigo } = decision;
  const reasonKey = `reasons.${motivoCodigo}`;

  return (
    <>
      <span className="text-muted-foreground text-xs">
        {t("decision.decidedOn", { date: dates.instant(decision.decididaEn) })}
      </span>
      {motivoCodigo ? (
        <p className="text-sm font-medium break-words">
          {t("decision.reason", {
            reason: t.has(reasonKey) ? t(reasonKey) : motivoCodigo,
          })}
        </p>
      ) : null}
      <p className="text-sm break-words whitespace-pre-wrap">
        {decision.texto ?? t("decision.noText")}
      </p>
    </>
  );
}

/**
 * The latest decision and, for a returned request, the way to correct it. The
 * correction route belongs to the next slice; the link is the entry point.
 */
export function DecisionSection({
  decision,
  correctHref,
}: {
  decision: OwnDecision | null;
  correctHref: string | null;
}) {
  const t = useTranslations("requests.detail");

  return (
    <Section id="decision" title={t("sections.decision")}>
      {decision ? (
        <div className="flex flex-col items-start gap-2">
          <StatePill estado={decision.tipo} />
          <DecisionBody decision={decision} />
        </div>
      ) : null}
      {correctHref ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("decision.correctHint")}
          </p>
          <Link
            href={correctHref}
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full sm:w-auto sm:self-start",
            )}
          >
            {t("decision.correct")}
          </Link>
        </div>
      ) : null}
    </Section>
  );
}

/**
 * The one thing a student learns of an escalation (ES-14, E13): the request is
 * with the coordination of their career. No reason, note, answer or person.
 */
export function CoordinationCallout() {
  const t = useTranslations("requests.detail");

  return (
    <p className="border-border bg-muted text-foreground rounded-lg border px-3 py-2 text-sm">
      {t("coordination")}
    </p>
  );
}

export function SubjectsSection({
  classes,
}: {
  classes: OwnRequestDetail["clases"];
}) {
  const t = useTranslations("requests.detail");

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

function DocumentRow({ doc }: { doc: DetailDocument }) {
  const t = useTranslations("requests.detail.documents");
  const href = `/api/intake/documents/${doc.id}`;

  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 text-sm font-medium break-all">
        {doc.nombreOriginal}
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
  const t = useTranslations("requests.detail");

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

function RevisionEntry({ revision }: { revision: DetailRevision }) {
  const t = useTranslations("requests.detail");
  const tCauses = useTranslations("intake.causes");
  const dates = useRequestDates();

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

function HistoryGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-title">{title}</h3>
      <ul className="flex flex-col gap-4">{children}</ul>
    </div>
  );
}

/** Earlier decisions and earlier versions; the page omits it when both are empty. */
export function HistorySection({
  decisions,
  revisions,
}: {
  decisions: readonly OwnDecision[];
  revisions: readonly DetailRevision[];
}) {
  const t = useTranslations("requests.detail");

  return (
    <Section id="history" title={t("sections.history")}>
      {decisions.length > 0 ? (
        <HistoryGroup title={t("history.decisions")}>
          {decisions.map((decision) => (
            <li
              key={decision.id}
              className="border-border flex flex-col items-start gap-2 border-l-2 pl-4"
            >
              <StatePill estado={decision.tipo} />
              <DecisionBody decision={decision} />
            </li>
          ))}
        </HistoryGroup>
      ) : null}
      {revisions.length > 0 ? (
        <HistoryGroup title={t("history.revisions")}>
          {revisions.map((revision) => (
            <RevisionEntry key={revision.id} revision={revision} />
          ))}
        </HistoryGroup>
      ) : null}
    </Section>
  );
}
