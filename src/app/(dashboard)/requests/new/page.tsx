import { getTranslations } from "next-intl/server";

import { CauseDatesStep } from "@/app/(dashboard)/requests/new/cause-dates-step";
import { DocumentsStep } from "@/app/(dashboard)/requests/new/documents-step";
import { IntakeStepper } from "@/app/(dashboard)/requests/new/intake-stepper";
import {
  defaultStep,
  draftRange,
  parseStep,
} from "@/app/(dashboard)/requests/new/steps";
import { SubjectsStep } from "@/app/(dashboard)/requests/new/subjects-step";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { listEnrollmentFailSoft } from "@/lib/data/enrollment";
import { type Draft, openDraft } from "@/lib/data/solicitudes";
import { getIntakeDeps } from "@/lib/intake/deps";

/**
 * Fail-soft draft read (A7): a database or storage-wiring failure becomes an
 * in-page message, never an error screen. Resuming or creating the draft is the
 * only write a visit makes, and it is the student's own (D8).
 */
async function loadDraft(userId: number): Promise<Draft | null> {
  try {
    return await openDraft(userId, new Date(), getIntakeDeps().store);
  } catch {
    return null;
  }
}

/**
 * Container of the intake flow. The page guard is only the first line: every
 * action and route re-checks role and ownership itself (RNF-01). The step lives
 * in `?step=` and the draft on the server, so refresh and back are safe (A7).
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(...rolesSolicitantes);
  const userId = Number(session.sub);
  const t = await getTranslations("intake");

  const draft = await loadDraft(userId);
  const header = <PageHeader title={t("title")} description={t("subtitle")} />;

  if (!draft) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <p
          role="status"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {t("degraded")}
        </p>
      </div>
    );
  }

  const step = parseStep((await searchParams).step) ?? defaultStep(draft);
  const range = draftRange(draft);
  // Enrollment is read only for the step that lists it, and only with dates.
  const enrollment =
    step === 2 && range
      ? await listEnrollmentFailSoft(userId, range, getIntakeDeps().schedule)
      : { data: [], degraded: false };

  return (
    <div className="flex flex-col gap-8">
      {header}
      <IntakeStepper current={step} />
      {step === 1 ? (
        <CauseDatesStep
          initial={{
            causa: draft.causa,
            fechaInicio: draft.fechaInicio,
            fechaFin: draft.fechaFin,
          }}
        />
      ) : null}
      {step === 2 ? (
        <SubjectsStep
          groups={enrollment.data}
          selected={draft.subjects}
          hasDates={range !== null}
          degraded={enrollment.degraded}
        />
      ) : null}
      {step === 3 ? (
        <DocumentsStep
          draftId={draft.id}
          documents={draft.documents.filter((d) => d.estado === "valido")}
        />
      ) : null}
    </div>
  );
}
