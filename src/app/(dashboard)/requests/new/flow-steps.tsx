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
}) {
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
        />
      ) : null}
      {step === 2 ? (
        <SubjectsStep
          groups={enrollment.data}
          selected={draft.subjects}
          hasDates={draftRange(draft) !== null}
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
        />
      ) : null}
      {step === 4 ? (
        <ReviewStep
          draft={draft}
          groups={enrollment.data.filter((g) => heldGroups.has(g.grupoId))}
          documents={validDocuments}
          degraded={enrollment.degraded}
          flow={flow}
        />
      ) : null}
    </>
  );
}
