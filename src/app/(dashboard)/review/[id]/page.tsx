import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { DecisionDialog } from "@/app/(dashboard)/review/[id]/decision-dialog";
import { ExtractionSection } from "@/app/(dashboard)/review/[id]/extraction-section";
import { RemissionSection } from "@/app/(dashboard)/review/[id]/remission-section";
import {
  ChangesSection,
  DocumentsSection,
  HistorySection,
  RequestSection,
  Section,
  StudentSection,
  SubjectsSection,
} from "@/app/(dashboard)/review/[id]/request-sections";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { listExtractions, type ExtractionList } from "@/lib/data/extraction";
import { listRemissions } from "@/lib/data/remision";
import { recordRequestRead } from "@/lib/data/request-reads";
import { resolveRequestScope } from "@/lib/data/request-scope";
import {
  getRequestDetail,
  type DetailRevision,
  type RequestDetail,
} from "@/lib/data/solicitud-detail";
import { isExtractionConfigured } from "@/lib/extraction/configured";
import { deadlineStatus } from "@/lib/intake/business-days";
import { calendar } from "@/lib/intake/calendar";
import { isCausa } from "@/lib/intake/causes";
import { managuaToday } from "@/lib/intake/dates";
import {
  DECISION_TEMPLATES,
  renderTemplate,
  type DecisionKind,
} from "@/lib/intake/decision-templates";
import { diffRevision, type RevisionDiff } from "@/lib/intake/revision-diff";
import { isVisibleState } from "@/lib/intake/states";

const POSITIVE_INTEGER = /^[1-9]\d*$/;
/** Approve first, the irreversible reject last. */
const DECISION_ORDER = ["aprobada", "devuelta", "rechazada"] as const;

/** The templates of each decision kind, rendered for this request (SR-8). */
function renderedTemplates(detail: RequestDetail) {
  const { causa, fechaInicio, fechaFin } = detail;
  if (!isCausa(causa) || !fechaInicio || !fechaFin) {
    throw new Error(`Pending request ${detail.id} lacks its cause or dates`);
  }
  const vars = {
    estudiante: detail.estudiante.nombre ?? "",
    causa,
    fechaInicio,
    fechaFin,
  };
  return (kind: DecisionKind) =>
    DECISION_TEMPLATES.filter((t) => t.tipo === kind).map((t) => ({
      codigo: t.codigo,
      motivo: t.motivo ?? null,
      texto: renderTemplate(t.codigo, vars),
    }));
}

/**
 * What changed since the return, only for a resubmitted request that is not
 * back with the student: while `devuelta` the student is still editing and the
 * latest snapshot is the version just returned (SR-17).
 */
function changesSinceReturn(detail: RequestDetail): RevisionDiff | null {
  if (detail.reenviadaEn === null || detail.estado === "devuelta") return null;
  const latest = detail.revisiones.reduce<DetailRevision | null>(
    (best, revision) =>
      best && best.numero > revision.numero ? best : revision,
    null,
  );
  if (!latest) return null;
  return diffRevision(latest, {
    causa: detail.causa,
    fechaInicio: detail.fechaInicio,
    fechaFin: detail.fechaFin,
    clases: detail.clases,
    documentoIds: detail.documentos.map((doc) => doc.id),
  });
}

/**
 * The extracted-data read is fail-soft (RF-11): `listExtractions` already turns
 * a failed query into a degraded result, and this guard keeps even an
 * unexpected throw from taking the rest of the detail down. Only the error name
 * is logged (RNF-04).
 */
async function loadExtractions(solicitudId: number): Promise<ExtractionList> {
  try {
    return await listExtractions(solicitudId);
  } catch (error) {
    console.error("extraction_read_failed", {
      solicitudId,
      code: error instanceof Error ? error.name : "unknown",
    });
    return { data: [], degraded: true };
  }
}

/**
 * The staff detail (RF-06, RF-08 b, RNF-01). The audited read is written here,
 * in the page body, after authorisation and after the data loaded and every
 * derived value was built, before the JSX is returned (SR-11). An id the caller
 * may not see, a draft and an unknown id are the same `notFound()`. The
 * sections are a stack of labelled cards, so the RF-14 document signals are one
 * more entry.
 */
export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(...rolesRevisores);
  const actorId = Number(user.sub);
  const { id: rawId } = await params;
  if (!POSITIVE_INTEGER.test(rawId) || !Number.isSafeInteger(Number(rawId))) {
    notFound();
  }

  const scope = await resolveRequestScope(actorId, user.rol);
  if (scope.kind === "none") notFound();
  const detail = await getRequestDetail(scope, Number(rawId));
  if (!detail || !isVisibleState(detail.estado)) notFound();

  const t = await getTranslations("review");
  const tQueue = await getTranslations("review.queue");
  const format = await getFormatter();

  const now = new Date();
  const pending = detail.estado === "pendiente";
  const clockStart = detail.reenviadaEn ?? detail.presentadaEn;
  const due =
    pending && clockStart
      ? deadlineStatus(managuaToday(clockStart), managuaToday(now), calendar)
      : null;
  const templatesFor = pending ? renderedTemplates(detail) : null;
  const changes = changesSinceReturn(detail);
  // The remissions exist only once the request is approved (RF-09 c). They are
  // loaded with the rest, before the single audited read below.
  const remissions =
    detail.estado === "aprobada" ? await listRemissions(detail.id) : null;
  // The extracted data is read with the rest, before the single audited read;
  // showing it writes no audit row of its own (RF-11, RNF-06).
  const extractions = await loadExtractions(detail.id);

  await recordRequestRead(actorId, detail.id, detail.estado);

  const name = detail.estudiante.nombre ?? t("detail.unnamed");
  const presented = detail.presentadaEn
    ? format.dateTime(detail.presentadaEn, {
        dateStyle: "medium",
        timeZone: "America/Managua",
      })
    : t("detail.notSet");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("detail.title", { name })}
        description={t("detail.description", {
          id: detail.id,
          date: presented,
        })}
        action={
          <Link
            href="/review"
            prefetch={false}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t("detail.back")}
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {changes ? (
          <ChangesSection
            diff={changes}
            documents={detail.documentos}
            retired={detail.documentosRetirados}
          />
        ) : null}
        <RequestSection
          detail={detail}
          deadline={
            due
              ? {
                  status: due.status,
                  label: tQueue(
                    {
                      en_plazo: "deadline.onTime",
                      por_vencer: "deadline.dueSoon",
                      vencida: "deadline.overdue",
                    }[due.status],
                  ),
                  due: tQueue("deadline.due", {
                    date: format.dateTime(
                      new Date(`${due.deadline}T00:00:00Z`),
                      {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      },
                    ),
                  }),
                }
              : null
          }
        />
        <StudentSection
          student={detail.estudiante}
          consent={detail.consentimiento}
        />
        <SubjectsSection classes={detail.clases} />
        <DocumentsSection documents={detail.documentos} />
        <ExtractionSection
          extractions={extractions}
          requestState={detail.estado}
          configured={isExtractionConfigured()}
        />
        {remissions ? (
          <RemissionSection
            remissions={remissions}
            unassigned={detail.clases.filter((c) => c.docenteNombre === null)}
            specialFormat={
              detail.formatoEspecial
                ? {
                    solicitudId: detail.id,
                    attached: detail.formato && {
                      id: detail.formato.id,
                      nombreOriginal: detail.formato.nombreOriginal,
                    },
                  }
                : undefined
            }
          />
        ) : null}
        <HistorySection
          decisions={detail.decisiones}
          revisions={detail.revisiones}
          retired={detail.documentosRetirados}
        />
        {templatesFor ? (
          <Section id="decision" title={t("detail.sections.decision")}>
            <p className="text-muted-foreground max-w-prose text-sm">
              {t("detail.decisionPanel.description")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {DECISION_ORDER.map((kind) => (
                <DecisionDialog
                  key={kind}
                  kind={kind}
                  solicitudId={detail.id}
                  causa={detail.causa}
                  templates={templatesFor(kind)}
                />
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
