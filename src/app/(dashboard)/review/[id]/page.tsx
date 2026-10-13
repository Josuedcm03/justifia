import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { DecisionDialog } from "@/app/(dashboard)/review/[id]/decision-dialog";
import {
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
import { recordRequestRead } from "@/lib/data/request-reads";
import { resolveRequestScope } from "@/lib/data/request-scope";
import {
  getRequestDetail,
  type RequestDetail,
} from "@/lib/data/solicitud-detail";
import { deadlineStatus } from "@/lib/intake/business-days";
import { calendar } from "@/lib/intake/calendar";
import { isCausa } from "@/lib/intake/causes";
import { managuaToday } from "@/lib/intake/dates";
import {
  DECISION_TEMPLATES,
  renderTemplate,
  type DecisionKind,
} from "@/lib/intake/decision-templates";
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
        <StudentSection student={detail.estudiante} />
        <SubjectsSection classes={detail.clases} />
        <DocumentsSection documents={detail.documentos} />
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
