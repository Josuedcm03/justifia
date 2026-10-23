"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition, type ReactNode } from "react";

import {
  decideAction,
  type DecideFailure,
} from "@/app/(dashboard)/review/[id]/actions";
import { templateKey } from "@/app/(dashboard)/review/template-key";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { DecisionKind } from "@/lib/intake/decision-templates";
import {
  DECISION_TEXT_MAX,
  type DecisionError,
  type DecisionField,
} from "@/lib/intake/decision-validation";

/** A template already rendered for this request (the page owns the data). */
export type DialogTemplate = {
  codigo: string;
  /** RN-17 reason of a return template; null for approve and reject. */
  motivo: string | null;
  texto: string;
};

const TRIGGER_VARIANT = {
  aprobada: "default",
  devuelta: "outline",
  // RNF-12: the trigger is the quiet step, only the confirm is destructive.
  rechazada: "secondary",
} as const satisfies Record<DecisionKind, "default" | "outline" | "secondary">;

const COPY_KEY = {
  aprobada: "approve",
  devuelta: "return",
  rechazada: "reject",
} as const satisfies Record<DecisionKind, string>;

const ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink flex flex-col gap-2 rounded-lg border border-l-4 px-3 py-2 text-sm";
const TEXTAREA =
  "border-input bg-card placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/30 dark:bg-input/30 min-h-32 w-full rounded-lg border px-3 py-2 text-base transition-colors outline-none focus-visible:ring-3 aria-invalid:ring-3 md:text-sm";

function FieldAlert({
  id,
  codes,
}: {
  id: string;
  codes: readonly DecisionError["code"][];
}) {
  const t = useTranslations("review.decision.errors");
  if (codes.length === 0) return null;
  return (
    <div
      id={id}
      role="alert"
      className="text-destructive-ink flex flex-col gap-1 text-sm"
    >
      {codes.map((code) => (
        <p key={code}>{t(code)}</p>
      ))}
    </div>
  );
}

function Fieldset({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label text-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * One decision as a confirmation dialog (RF-07, RNF-12). Nothing is sent until
 * the secretary confirms, cancelling or Escape changes nothing, and the dialog
 * stays open while the action runs. The templates arrive rendered; the secretary
 * edits the text, and the server validates everything again. A success
 * redirects (the action rejects with a redirect that Next handles), so this
 * component only ever receives refusals. Reject is the destructive path:
 * secondary trigger, destructive confirm (docs/design-system.md §5). An
 * approval for force majeure can also be marked as needing the special format
 * (RN-19); the format itself is uploaded from the detail afterwards, never here.
 */
export function DecisionDialog({
  kind,
  solicitudId,
  causa = null,
  templates,
}: {
  kind: DecisionKind;
  solicitudId: number;
  /** Cause of the request; only `fuerza_mayor` offers the RN-19 mark. */
  causa?: string | null;
  templates: readonly DialogTemplate[];
}) {
  const t = useTranslations("review.decision");
  const copy = COPY_KEY[kind];
  const isReturn = kind === "devuelta";
  const ids = useId();

  // Approve and reject start on the first template; a return starts with no
  // reason chosen, because the reason is what selects the template.
  const firstChoice = (list: readonly DialogTemplate[]) =>
    isReturn ? "" : (list[0]?.codigo ?? "");
  const choiceOf = (template: DialogTemplate) =>
    isReturn ? (template.motivo ?? "") : template.codigo;
  const fresh = () => ({
    choice: firstChoice(templates),
    texto: isReturn ? "" : (templates[0]?.texto ?? ""),
  });

  const [open, setOpen] = useState(false);
  const [{ choice, texto }, setDraft] = useState(fresh);
  const [marked, setMarked] = useState(false);
  const offersMark = kind === "aprobada" && causa === "fuerza_mayor";
  const [failure, setFailure] = useState<DecideFailure | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = templates.find((tp) => choiceOf(tp) === choice);
  const fieldCodes = (...fields: DecisionField[]) =>
    failure?.reason === "invalid"
      ? failure.errors
          .filter((error) => fields.includes(error.field))
          .map((error) => error.code)
      : [];
  const choiceCodes = fieldCodes(isReturn ? "motivo" : "plantilla");
  const textCodes = fieldCodes("texto");
  // A refusal that names no field of this form is shown as a banner.
  const banner:
    "conflict" | "not_found" | "tipo_invalid" | "unexpected" | null =
    failure === null
      ? null
      : failure.reason !== "invalid"
        ? failure.reason
        : failure.errors.length === 0
          ? "unexpected"
          : failure.errors.some((e) => e.field === "tipo")
            ? "tipo_invalid"
            : null;

  function choose(next: string) {
    const template = templates.find((tp) => choiceOf(tp) === next);
    setDraft({ choice: next, texto: template?.texto ?? texto });
  }

  function confirm() {
    setFailure(null);
    startTransition(async () => {
      const result = await decideAction({
        solicitudId,
        tipo: kind,
        // A return with no reason yet still names a template, so the server
        // reports the one problem the secretary can fix: the missing reason.
        plantilla: selected?.codigo ?? templates[0]?.codigo ?? "",
        motivo: isReturn ? choice || null : null,
        texto,
        ...(offersMark && marked ? { formatoEspecial: true } : {}),
      });
      // A success never resolves here: the action redirects.
      if (result) setFailure(result);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) {
          setDraft(fresh());
          setMarked(false);
          setFailure(null);
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            size="lg"
            variant={TRIGGER_VARIANT[kind]}
            className="w-full sm:w-auto"
          />
        }
      >
        {t(`${copy}.trigger`)}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${copy}.title`)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(`${copy}.description`)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {banner ? (
          <div role="alert" className={ALERT}>
            <p>{t(`errors.${banner}`)}</p>
            {banner === "conflict" || banner === "not_found" ? (
              <Link
                href="/review"
                prefetch={false}
                className="text-primary w-fit font-medium underline underline-offset-4"
              >
                {t("backToQueue")}
              </Link>
            ) : null}
          </div>
        ) : null}

        <Fieldset label={isReturn ? t("reasonLabel") : t("templateLabel")}>
          <RadioGroup
            value={choice}
            onValueChange={(value) => choose(String(value))}
            aria-label={isReturn ? t("reasonLabel") : t("templateLabel")}
            aria-invalid={choiceCodes.length > 0 || undefined}
            aria-describedby={
              choiceCodes.length > 0 ? `${ids}-choice-error` : undefined
            }
          >
            {templates.map((template) => (
              <label
                key={template.codigo}
                className="flex min-h-11 items-center gap-3 text-sm"
              >
                <RadioGroupItem value={choiceOf(template)} />
                {isReturn
                  ? t(`reasons.${template.motivo as string}`)
                  : t(`templates.${templateKey(template.codigo)}`)}
              </label>
            ))}
          </RadioGroup>
          <FieldAlert id={`${ids}-choice-error`} codes={choiceCodes} />
        </Fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-text`}>{t("textLabel")}</Label>
          <textarea
            id={`${ids}-text`}
            value={texto}
            onChange={(event) =>
              setDraft({ choice, texto: event.target.value })
            }
            aria-invalid={textCodes.length > 0 || undefined}
            aria-describedby={
              textCodes.length > 0 ? `${ids}-text-error` : `${ids}-text-hint`
            }
            className={TEXTAREA}
          />
          <div className="flex items-start justify-between gap-3">
            <p
              id={`${ids}-text-hint`}
              className="text-muted-foreground text-xs"
            >
              {t("textHint")}
            </p>
            <p
              className={
                texto.length > DECISION_TEXT_MAX
                  ? "text-destructive-ink text-xs tabular-nums"
                  : "text-muted-foreground text-xs tabular-nums"
              }
            >
              {t("counter", { count: texto.length })}
            </p>
          </div>
          <FieldAlert id={`${ids}-text-error`} codes={textCodes} />
        </div>

        {offersMark ? (
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox
                checked={marked}
                onChange={(event) => setMarked(event.target.checked)}
                aria-describedby={`${ids}-mark-hint`}
              />
              {t("approve.specialFormat.label")}
            </label>
            <p
              id={`${ids}-mark-hint`}
              className="text-muted-foreground text-xs"
            >
              {t("approve.specialFormat.hint")}
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            render={<Button variant="ghost" size="lg" />}
          >
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            size="lg"
            variant={kind === "rechazada" ? "destructive" : "default"}
            disabled={pending}
            onClick={confirm}
          >
            {pending ? t(`${copy}.pending`) : t(`${copy}.confirm`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
