"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type ReactNode } from "react";

import type { EscalationActionFailure } from "@/app/(dashboard)/review/[id]/escalation-actions";
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
import { Label } from "@/components/ui/label";
import { ESCALATION_NOTE_MAX } from "@/lib/intake/escalation";

// Pieces the staff dialogs share (docs/design-system.md §5 Form, Alert,
// Dialog), so the decision, escalation, absence-report and coordinator answer
// dialogs look and behave alike (RNF-12).

/** The catalog alert banner of a refusal that names no field. */
export const DIALOG_ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink flex flex-col gap-2 rounded-lg border border-l-4 px-3 py-2 text-sm";

export const DIALOG_TEXTAREA =
  "border-input bg-card placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/30 dark:bg-input/30 min-h-32 w-full rounded-lg border px-3 py-2 text-base transition-colors outline-none focus-visible:ring-3 aria-invalid:ring-3 md:text-sm";

/** Messages under one control, already translated; nothing when empty. */
export function FieldMessages({
  id,
  messages,
}: {
  id: string;
  messages: readonly string[];
}) {
  if (messages.length === 0) return null;
  return (
    <div
      id={id}
      role="alert"
      className="text-destructive-ink flex flex-col gap-1 text-sm"
    >
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

/** The `dialog.*` copy both escalation namespaces define. */
export type DialogCopy = (
  key:
    | "dialog.trigger"
    | "dialog.title"
    | "dialog.description"
    | "dialog.backToQueue"
    | "dialog.cancel"
    | "dialog.pending"
    | "dialog.confirm"
    | "dialog.noteLabel"
    | "dialog.noteHint"
    | "dialog.counter",
  values?: { count: number },
) => string;

/**
 * The refusal of the last confirm and the running state. A success never
 * resolves here: the action redirects. A second confirm while one runs is
 * ignored. Generic in the failure type, so the secretary and the coordinator
 * actions share it.
 */
export function useEscalationAction<
  F extends { reason: string } = EscalationActionFailure,
>() {
  const [failure, setFailure] = useState<F | null>(null);
  const [pending, startTransition] = useTransition();
  const running = useRef(false);

  function run(action: () => Promise<F>) {
    if (running.current) return;
    running.current = true;
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result) setFailure(result);
      } finally {
        running.current = false;
      }
    });
  }

  return { failure, setFailure, pending, run };
}

/**
 * An escalation-style confirmation dialog: outline trigger, the refusal banner
 * (with the way back to the list `backHref` when the request moved or
 * vanished), the fields, then cancel and confirm. It stays open while the
 * action runs, and closing it discards the draft through `onDiscard`.
 */
export function EscalationFormDialog({
  copy,
  failure,
  banner,
  pending,
  onConfirm,
  onDiscard,
  backHref = "/review",
  children,
}: {
  copy: DialogCopy;
  failure: { reason: string } | null;
  banner: string | null;
  pending: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
  backHref?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const backToQueue =
    failure?.reason === "conflict" || failure?.reason === "not_found";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) onDiscard();
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
          />
        }
      >
        {copy("dialog.trigger")}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy("dialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy("dialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {banner ? (
          <div role="alert" className={DIALOG_ALERT}>
            <p>{banner}</p>
            {backToQueue ? (
              <Link
                href={backHref}
                prefetch={false}
                className="text-primary w-fit font-medium underline underline-offset-4"
              >
                {copy("dialog.backToQueue")}
              </Link>
            ) : null}
          </div>
        ) : null}

        {children}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            render={<Button variant="ghost" size="lg" />}
          >
            {copy("dialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction size="lg" disabled={pending} onClick={onConfirm}>
            {pending ? copy("dialog.pending") : copy("dialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The note textarea with its hint, its counter and its messages. */
export function NoteField({
  id,
  copy,
  value,
  onChange,
  messages,
}: {
  id: string;
  copy: DialogCopy;
  value: string;
  onChange: (value: string) => void;
  messages: readonly string[];
}) {
  // The server limit applies to the trimmed text, so the counter does too.
  const length = value.trim().length;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{copy("dialog.noteLabel")}</Label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={messages.length > 0 || undefined}
        aria-describedby={messages.length > 0 ? `${id}-error` : `${id}-hint`}
        className={DIALOG_TEXTAREA}
      />
      <div className="flex items-start justify-between gap-3">
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {copy("dialog.noteHint")}
        </p>
        <p
          className={
            length > ESCALATION_NOTE_MAX
              ? "text-destructive-ink text-xs tabular-nums"
              : "text-muted-foreground text-xs tabular-nums"
          }
        >
          {copy("dialog.counter", { count: length })}
        </p>
      </div>
      <FieldMessages id={`${id}-error`} messages={messages} />
    </div>
  );
}
