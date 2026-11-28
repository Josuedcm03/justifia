import { CauseDatesStep } from "@/app/(dashboard)/requests/new/cause-dates-step";
import { DocumentsStep } from "@/app/(dashboard)/requests/new/documents-step";
import type { Flow } from "@/app/(dashboard)/requests/new/flow";
import { IntakeStepper } from "@/app/(dashboard)/requests/new/intake-stepper";
import { ReviewStep } from "@/app/(dashboard)/requests/new/review-step";
import {
  draftRange,
  type StepNumber,
} from "@/app/(dashboard)/requests/new/steps";
import { SubjectsStep } from "@/app/(dashboard)/requests/new/subjects-step";
import type { EnrollmentGroup } from "@/lib/data/enrollment";
import type { Draft } from "@/lib/data/solicitudes";
import type { Causa } from "@/lib/intake/causes";
import type { IntakeLimits } from "@/lib/parameters/derive";

/**
 * The stepper and the current step of an intake flow: a new draft, or (with a
 * `flow`) the correction of a returned request. Synchronous on purpose: the page
 * owns the reads, this only lays out what it was given.
 */
export function FlowSteps({
  step,
  draft,
  enrollment,
  fromReview,
  flow,
  previousDocumentIds,
  today,
  limits,
  causes,
}: {
  step: StepNumber;
  draft: Draft;
  enrollment: {
    data: EnrollmentGroup[];
    degraded: boolean;
    enrolled: boolean;
  };
  fromReview: boolean;
  flow?: Flow;
  /** The ids of the version just returned; set by the correction (FE-16). */
  previousDocumentIds?: readonly number[] | null;
  /** The Managua calendar day, read on the server (FE-19). */
  today: string;
  /** The limits in force, read on the server; messages state them (NP-17). */
  limits: IntakeLimits;
  /** The causes the cause step offers, in the stored order (NP-11). */
  causes: readonly Causa[];
}) {
  const range = draftRange(draft);
  const validDocuments = draft.documents.filter((d) => d.estado === "valido");
  const heldGroups = new Set(draft.subjects.map((s) => s.grupoId));

  return (
    <>
      <IntakeStepper current={step} basePath={flow?.basePath} />
      {step === 1 ? (
        <CauseDatesStep
          initial={{
            causa: draft.causa,
            fechaInicio: draft.fechaInicio,
            fechaFin: draft.fechaFin,
          }}
          fromReview={fromReview}
          flow={flow}
          today={today}
          limits={limits}
          causes={causes}
        />
      ) : null}
      {step === 2 ? (
        <SubjectsStep
          groups={enrollment.data}
          selected={draft.subjects}
          hasDates={range !== null}
          range={range}
          today={today}
          degraded={enrollment.degraded}
          enrolled={enrollment.enrolled}
          fromReview={fromReview}
          flow={flow}
        />
      ) : null}
      {step === 3 ? (
        <DocumentsStep
          draftId={draft.id}
          documents={validDocuments}
          fromReview={fromReview}
          flow={flow}
          previousDocumentIds={previousDocumentIds}
          range={range}
          today={today}
        />
      ) : null}
      {step === 4 ? (
        <ReviewStep
          draft={draft}
          groups={enrollment.data.filter((g) => heldGroups.has(g.grupoId))}
          documents={validDocuments}
          degraded={enrollment.degraded}
          flow={flow}
          previousDocumentIds={previousDocumentIds}
          today={today}
          limits={limits}
        />
      ) : null}
    </>
  );
}
