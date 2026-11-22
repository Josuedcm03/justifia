"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AssignInscripcionState } from "@/lib/catalog/types";

import { assignInscripcionAction } from "../actions";
import { assignHref } from "./assign-params";
import { AssignGroups, type AssignGroupsProps } from "./assign-groups";

const LIST_PATH = "/catalog/inscripciones";

type Group = AssignGroupsProps["groups"][number];

/**
 * The confirmed create and change-group form (EA-CRE-1, EA-CHG-1, EA-SIB-1,
 * RNF-12). Choosing a group opens a confirm step that names the student, the
 * subject, the group and, when the student has a current group of the subject,
 * the group it replaces; nothing is sent until she confirms and cancelling
 * changes nothing. The group named as replaced is the very id sent as
 * `expectedReplaced` (13.6), so what she saw is what the server checks: when
 * the enrollment changed meanwhile the action answers with an error and nothing
 * is written. A refusal or a not-found answer leaves the form usable and offers
 * a reload; a success stops offering the groups, since the page behind it is
 * stale, and links back to the list. It is a plain button flow with no form
 * element: the action takes explicit arguments, not form data.
 */
export function AssignForm(props: AssignGroupsProps) {
  const { student, asignatura, periodo, currentGroup } = props;
  const t = useTranslations("catalog.inscripciones.assign.form");
  const tShared = useTranslations("catalog.shared");
  const [target, setTarget] = useState<Group | null>(null);
  const [answer, setAnswer] = useState<{
    result: AssignInscripcionState;
    number: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const done = answer?.result.kind === "done" ? answer.result : null;
  const failure =
    answer?.result.kind === "error"
      ? answer.result.message
      : answer?.result.kind === "gone"
        ? `${tShared("notFound.title")}. ${tShared("notFound.message")}`
        : null;
  const values = {
    student: student.nombreCompleto,
    subject: `${asignatura.codigo} · ${asignatura.nombre}`,
    periodo,
  };

  function confirm(group: Group) {
    startTransition(async () => {
      const result = await assignInscripcionAction(
        student.id,
        group.grupoId,
        currentGroup?.grupoId ?? null,
      );
      setAnswer({ result, number: group.numeroGrupo });
      setTarget(null);
    });
  }

  return (
    <>
      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        {done && answer ? (
          <>
            <p className="max-w-prose text-sm break-words">
              {t(`done.${done.outcome}`, {
                student: student.nombreCompleto,
                number: answer.number,
              })}
              {done.replaced > 0 ? ` ${t("done.replacedNote")}` : ""}
            </p>
            <Link
              href={LIST_PATH}
              prefetch={false}
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "w-full sm:w-auto sm:self-start",
              })}
            >
              {t("done.back")}
            </Link>
          </>
        ) : null}
      </div>
      {failure ? (
        <div
          role="alert"
          className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink flex flex-col gap-3 rounded-lg border border-l-4 px-3 py-2 text-sm"
        >
          <p className="break-words">{failure}</p>
          <Link
            href={assignHref({
              estudianteId: student.id,
              asignaturaId: asignatura.id,
            })}
            prefetch={false}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "w-full sm:w-auto sm:self-start",
            })}
          >
            {t("reload")}
          </Link>
        </div>
      ) : null}
      <AssignGroups
        {...props}
        renderAction={(group) =>
          group.current ? null : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto sm:self-start"
              disabled={pending || done !== null}
              aria-label={t("chooseLabel", {
                number: group.numeroGrupo,
                student: student.nombreCompleto,
              })}
              onClick={() => setTarget(group)}
            >
              {t("choose")}
            </Button>
          )
        }
      />
      {target ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !pending) setTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="break-words">
                {t("confirm.title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="break-words">
                {currentGroup
                  ? t("confirm.replace", {
                      ...values,
                      number: target.numeroGrupo,
                      replaced: currentGroup.numeroGrupo,
                    })
                  : t("confirm.create", {
                      ...values,
                      number: target.numeroGrupo,
                    })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={pending}
                render={<Button variant="ghost" size="lg" />}
              >
                {t("confirm.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                size="lg"
                disabled={pending}
                onClick={() => confirm(target)}
              >
                {pending ? t("confirm.pending") : t("confirm.submit")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
