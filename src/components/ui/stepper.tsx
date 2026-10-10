import { cn } from "cn";
import Link from "next/link";

export type StepperStep = {
  key: string;
  label: string;
  /** Only steps the user may jump to carry a link. */
  href?: string;
};

// Multi-step progress. The current step is said with the primary underline of
// the "Academic Governance" design system plus `aria-current="step"`, so the
// signal never rests on colour alone (docs/design-system.md 2.3). Earlier steps
// are links; later ones are plain text. Below the `sm` breakpoint the list
// collapses into `summary` ("Step n of 4") and a progress bar (RNF-11).
export function Stepper({
  steps,
  current,
  label,
  summary,
}: {
  steps: readonly StepperStep[];
  /** 1-based position of the current step. */
  current: number;
  label: string;
  summary: string;
}) {
  return (
    <nav aria-label={label} data-slot="stepper" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:hidden">
        <p className="text-sm font-medium">{summary}</p>
        <div aria-hidden className="bg-muted h-1 rounded-full">
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${(current / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="hidden gap-6 sm:flex">
        {steps.map((step, index) => {
          const isCurrent = index + 1 === current;
          const className = cn(
            "inline-block pb-1 text-sm",
            isCurrent
              ? "text-foreground font-medium shadow-[inset_0_-3px_0_0_var(--primary)]"
              : "text-muted-foreground",
          );

          return (
            <li key={step.key}>
              {step.href && index + 1 < current ? (
                <Link
                  href={step.href}
                  className={cn(className, "hover:text-primary")}
                >
                  {step.label}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={className}
                >
                  {step.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
