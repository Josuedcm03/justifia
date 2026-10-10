"use client";

import { useTranslations } from "next-intl";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import type { ActiveToggleState } from "@/lib/catalog/types";

export type ActiveToggleAction = (
  previous: ActiveToggleState,
  formData: FormData,
) => Promise<ActiveToggleState>;

type Intent = "deactivate" | "reactivate";

const IDLE: ActiveToggleState = { kind: "idle" };

/**
 * Inline two-step activate/deactivate control (design Decision 8). Shared by
 * every catalog entity: it receives the Server Action and the record's label
 * and knows nothing else. Deactivation asks for a confirmation that names the
 * record; reactivation is a single press. It is a form POST, never a link.
 *
 * `notice` is an optional sentence shown in the confirmation step (for an
 * Asignatura, how many active groups it has); the caller owns that copy.
 */
export function ActiveToggle({
  action,
  id,
  recordLabel,
  activo,
  notice,
}: {
  action: ActiveToggleAction;
  id: number;
  recordLabel: string;
  activo: boolean;
  notice?: string;
}) {
  const t = useTranslations("catalog.shared");
  const [state, dispatch, isPending] = useActionState(action, IDLE);
  const [confirming, setConfirming] = useState(false);
  const [intent, setIntent] = useState<Intent>("deactivate");
  const titleId = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Focus goes back to step one only after cancel or an answer, never on mount.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (confirming) {
      confirmRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      openRef.current?.focus();
    }
  }, [confirming]);

  // The answer replaces the confirmation's button, so focus is handed back to
  // step one once the server has answered.
  useEffect(() => {
    if (state.kind === "idle") return;
    openRef.current?.focus();
  }, [state]);

  // What the pill shows: the answer wins over the (possibly stale) prop. A
  // no-op answer means the record already is in the state that was asked for.
  const shownActive =
    state.kind === "done"
      ? state.activo
      : state.kind === "unchanged"
        ? intent === "reactivate"
        : activo;

  function submit(form: HTMLFormElement, next: Intent) {
    const formData = new FormData(form);
    formData.set("id", String(id));
    formData.set("intent", next);
    setIntent(next);
    setConfirming(false);
    restoreFocus.current = true;
    startTransition(() => dispatch(formData));
  }

  let outcome: { text: string; failed: boolean } | null = null;
  if (!isPending) {
    if (state.kind === "done") {
      outcome = {
        text: t(state.activo ? "status.active" : "status.inactive"),
        failed: false,
      };
    } else if (state.kind === "unchanged") {
      outcome = {
        text: t(
          intent === "reactivate"
            ? "refusals.unchanged"
            : "refusals.alreadyInactive",
        ),
        failed: false,
      };
    } else if (state.kind === "error") {
      outcome = { text: state.message, failed: true };
    } else if (state.kind === "busy") {
      outcome = { text: t("busy"), failed: true };
    } else if (state.kind === "gone") {
      outcome = {
        text: `${t("notFound.title")}. ${t("notFound.message")}`,
        failed: true,
      };
    }
  }

  return (
    <form
      method="post"
      className="flex flex-col gap-4"
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        // The confirm button is the only submit button; reactivation presses
        // a plain button that calls `submit` itself.
        submit(event.currentTarget, "deactivate");
      }}
    >
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill
          active={shownActive}
          label={t(shownActive ? "status.active" : "status.inactive")}
        />
        {state.kind !== "gone" && !confirming ? (
          <Button
            ref={openRef}
            type="button"
            variant="secondary"
            size="lg"
            disabled={isPending}
            onClick={(event) => {
              if (shownActive) {
                setConfirming(true);
              } else {
                const form = event.currentTarget.form;
                if (form) submit(form, "reactivate");
              }
            }}
          >
            {t(shownActive ? "toggle.deactivate" : "toggle.reactivate")}
          </Button>
        ) : null}
      </div>

      {confirming ? (
        <div
          role="group"
          aria-labelledby={titleId}
          className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4"
        >
          <p id={titleId} className="font-medium">
            {t("toggle.confirmTitle", { record: recordLabel })}
          </p>
          <p className="text-muted-foreground text-sm">
            {t("toggle.nothingDeleted")}
          </p>
          {notice ? <p className="text-sm">{notice}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button
              ref={confirmRef}
              type="submit"
              variant="destructive"
              size="lg"
              disabled={isPending}
            >
              {t("toggle.confirm")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => {
                restoreFocus.current = true;
                setConfirming(false);
              }}
            >
              {t("toggle.cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Mounted from the start so a screen reader announces what changes. */}
      <div role="status" aria-live="polite">
        {outcome ? (
          <p
            className={
              outcome.failed
                ? "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
                : "text-sm"
            }
          >
            {outcome.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
