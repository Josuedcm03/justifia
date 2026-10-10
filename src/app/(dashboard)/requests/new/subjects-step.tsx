"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";

import { saveSubjectsAction } from "@/app/(dashboard)/requests/new/actions";
import {
  BackLink,
  FieldErrors,
  StepShell,
  errorsOf,
  invalidProps,
} from "@/app/(dashboard)/requests/new/form-field";
import { stepHref } from "@/app/(dashboard)/requests/new/steps";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { EnrollmentGroup } from "@/lib/data/enrollment";
import type { FieldError } from "@/lib/validations/solicitud";

type Subject = {
  asignaturaId: number;
  label: string;
  groups: EnrollmentGroup[];
};

/** One entry per subject, in the order the enrollment lists them. */
function bySubject(groups: readonly EnrollmentGroup[]): Subject[] {
  const subjects = new Map<number, Subject>();
  for (const g of groups) {
    const subject = subjects.get(g.asignaturaId) ?? {
      asignaturaId: g.asignaturaId,
      label: `${g.asignaturaCodigo} · ${g.asignaturaNombre}`,
      groups: [],
    };
    subject.groups.push(g);
    subjects.set(g.asignaturaId, subject);
  }
  return [...subjects.values()];
}

/**
 * Step 2: affected subjects (RF-04). The student ticks subjects from their own
 * enrollment; the group and teacher are shown without any search. Only when the
 * enrollment leaves several groups does a radio list ask for the choice, with
 * none preselected (RF-04 c). The action re-checks everything (RN-21).
 */
export function SubjectsStep({
  groups,
  selected,
  hasDates,
  degraded,
  fromReview = false,
}: {
  groups: readonly EnrollmentGroup[];
  selected: readonly { asignaturaId: number; grupoId: number }[];
  hasDates: boolean;
  degraded: boolean;
  fromReview?: boolean;
}) {
  const t = useTranslations("intake");
  const router = useRouter();
  // asignaturaId -> chosen group; null while an ambiguous subject has none.
  const [picked, setPicked] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(selected.map((s) => [s.asignaturaId, s.grupoId])),
  );
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [pending, startTransition] = useTransition();

  const back = <BackLink href={stepHref(fromReview ? 4 : 1)} />;

  const notice = !hasDates
    ? t("subjects.datesRequired")
    : degraded
      ? t("subjects.degraded")
      : groups.length === 0
        ? t("subjects.empty")
        : null;

  if (notice) {
    return (
      <StepShell
        title={t("subjects.title")}
        description={t("subjects.description")}
        footer={back}
      >
        <p role={degraded ? "status" : undefined} className="text-sm">
          {notice}
        </p>
        {hasDates ? null : (
          <Link href={stepHref(1)} className="text-primary text-sm underline">
            {t("subjects.goToDates")}
          </Link>
        )}
      </StepShell>
    );
  }

  function toggle(subject: Subject, checked: boolean) {
    setPicked((current) => {
      const next = { ...current };
      if (!checked) delete next[subject.asignaturaId];
      else {
        next[subject.asignaturaId] =
          subject.groups.length === 1 ? subject.groups[0].grupoId : null;
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selections = Object.entries(picked).map(([id, grupoId]) => ({
      asignaturaId: Number(id),
      grupoId,
    }));

    startTransition(async () => {
      const result = await saveSubjectsAction({ selections });
      if (result.ok) {
        setErrors([]);
        router.push(stepHref(fromReview ? 4 : 3));
      } else {
        setErrors(result.errors);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <StepShell
        title={t("subjects.title")}
        description={t("subjects.description")}
        footer={
          <>
            {back}
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="w-full sm:w-auto"
            >
              {pending ? t("actions.saving") : t("actions.next")}
            </Button>
          </>
        }
      >
        <FieldErrors
          id="subjects"
          errors={errors.filter(
            (e) => e.asignaturaId === undefined && e.field !== "form",
          )}
        />
        <ul className="flex flex-col gap-3">
          {bySubject(groups).map((subject) => {
            const id = subject.asignaturaId;
            const isPicked = id in picked;
            const subjectErrors = errors.filter((e) => e.asignaturaId === id);
            const errorId = `subject-${id}`;

            return (
              <li
                key={id}
                data-subject={id}
                className="border-border flex flex-col gap-3 rounded-xl border p-4"
              >
                <label className="flex items-start gap-3 text-sm font-medium">
                  <Checkbox
                    checked={isPicked}
                    onChange={(event) => toggle(subject, event.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 break-words">{subject.label}</span>
                </label>

                {isPicked ? (
                  <GroupChoice
                    id={errorId}
                    groups={subject.groups}
                    value={picked[id]}
                    errors={subjectErrors}
                    onChange={(grupoId) =>
                      setPicked((current) => ({ ...current, [id]: grupoId }))
                    }
                  />
                ) : null}
                <FieldErrors id={errorId} errors={subjectErrors} />
              </li>
            );
          })}
        </ul>
        <FieldErrors id="form" errors={errorsOf(errors, "form")} />
      </StepShell>
    </form>
  );
}

/** Group and teacher of a ticked subject: fixed text, or a radio list. */
function GroupChoice({
  id,
  groups,
  value,
  errors,
  onChange,
}: {
  id: string;
  groups: EnrollmentGroup[];
  value: number | null;
  errors: FieldError[];
  onChange: (grupoId: number) => void;
}) {
  const t = useTranslations("intake.subjects");

  const describe = (g: EnrollmentGroup) => (
    <span className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-2">
      <span>{t("group", { number: g.numeroGrupo })}</span>
      <span className="text-muted-foreground">
        {g.docenteNombre
          ? t("teacher", { name: g.docenteNombre })
          : t("noTeacher")}
      </span>
    </span>
  );

  if (groups.length === 1) return describe(groups[0]);

  return (
    <RadioGroup
      aria-label={t("chooseGroup")}
      value={value === null ? "" : String(value)}
      onValueChange={(next) => onChange(Number(next))}
      {...invalidProps(id, errors)}
    >
      {groups.map((g) => (
        <label key={g.grupoId} className="flex items-start gap-3">
          <RadioGroupItem value={String(g.grupoId)} className="mt-0.5" />
          {describe(g)}
        </label>
      ))}
    </RadioGroup>
  );
}
