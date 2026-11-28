"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, startTransition, useActionState, useId } from "react";

import type { ParameterFormState } from "@/lib/parameters/form-state";

// What the four sections of the parameters page share: the section card with
// its heading, the dispatch of a form to its Server Action and the live region
// that words the outcome. A save is submitted directly (NP-8): the only extra
// step in the page is the deactivation dialog of the causes section.

export type ParameterFormAction = (
  previous: ParameterFormState,
  formData: FormData,
) => Promise<ParameterFormState>;

export const ERROR_PANEL =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

const IDLE: ParameterFormState = { kind: "idle" };

/**
 * The state of one form and its dispatch. The form is submitted by hand
 * (`onSubmit`, not a form `action`): React resets the fields of a form action
 * once it settles, which would discard what the user typed after an error.
 */
export function useParameterForm(action: ParameterFormAction) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  return {
    state,
    pending,
    fieldErrors: state.kind === "invalid" ? state.fieldErrors : {},
    submit(formData: FormData) {
      if (pending) return;
      startTransition(() => dispatch(formData));
    },
  };
}

/** One section of the page: a card with its own `h2`. */
export function ParameterSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="border-border bg-card shadow-soft flex flex-col gap-5 rounded-xl border p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-headline text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground max-w-prose text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The outcome of a save, as text. Mounted from the start so a screen reader
 * announces what changes; field errors are shown by the fields themselves.
 */
export function SaveOutcome({
  state,
  pending,
}: {
  state: ParameterFormState;
  pending: boolean;
}) {
  const t = useTranslations("parameters.state");

  let outcome: { text: string; failed: boolean } | null = null;
  if (!pending) {
    if (state.kind === "saved") {
      outcome = { text: t("saved"), failed: false };
    } else if (state.kind === "unchanged") {
      outcome = { text: t("unchanged"), failed: false };
    } else if (state.kind === "busy") {
      outcome = { text: t("busy"), failed: true };
    } else if (state.kind === "error") {
      outcome = { text: state.message, failed: true };
    }
  }

  return (
    <div role="status" aria-live="polite">
      {outcome ? (
        <p className={outcome.failed ? ERROR_PANEL : "text-sm"}>
          {outcome.text}
        </p>
      ) : null}
    </div>
  );
}
