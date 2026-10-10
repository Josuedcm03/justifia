"use client";

import { cn } from "cn";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { formatFileSize } from "@/app/(dashboard)/catalog/import/file-dropzone";
import { DiscardDialog } from "@/app/(dashboard)/requests/new/discard-dialog";
import {
  BackLink,
  FieldErrors,
  StepShell,
  errorsOf,
} from "@/app/(dashboard)/requests/new/form-field";
import { reviewEditHref, stepHref } from "@/app/(dashboard)/requests/new/steps";
import { SubmitDialog } from "@/app/(dashboard)/requests/new/submit-dialog";
import { buttonVariants } from "@/components/ui/button";
import type { EnrollmentGroup } from "@/lib/data/enrollment";
import type { FieldError } from "@/lib/validations/solicitud";

type ReviewDraft = {
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
};

type ReviewDocument = {
  id: number;
  nombreOriginal: string;
  tamanoBytes: number;
};

const SECTION_FIELDS = [
  "causa",
  "fechaInicio",
  "fechaFin",
  "subjects",
  "documents",
];

/** One read-only block of the review with its link back to the step (RF-01). */
function Section({
  id,
  title,
  step,
  errors,
  children,
}: {
  id: string;
  title: string;
  step: number;
  errors: readonly FieldError[];
  children: ReactNode;
}) {
  const t = useTranslations("intake.review");

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="border-border flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-title`} className="text-sm font-medium">
          {title}
        </h3>
        <Link
          href={reviewEditHref(step)}
          aria-label={t("editSection", { section: title })}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          {t("edit")}
        </Link>
      </div>
      {children}
      <FieldErrors id={id} errors={errors} />
    </section>
  );
}

/**
 * Step 4: everything the student is about to submit, read only, with a link to
 * edit each part (RF-01). Submit refusals come back per field and are shown
 * under the part they concern (RF-03); the server re-validates everything, so
 * nothing here is trusted.
 */
export function ReviewStep({
  draft,
  groups,
  documents,
  degraded,
}: {
  draft: ReviewDraft;
  /** The groups the draft holds, with subject and teacher labels. */
  groups: readonly EnrollmentGroup[];
  documents: readonly ReviewDocument[];
  degraded: boolean;
}) {
  const t = useTranslations("intake");
  const format = useFormatter();
  const locale = useLocale();
  const [errors, setErrors] = useState<FieldError[]>([]);

  const date = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      dateStyle: "long",
      timeZone: "UTC",
    });
  const notSet = t("review.notSet");
  const { causa, fechaInicio, fechaFin } = draft;

  return (
    <StepShell
      title={t("review.title")}
      description={t("review.description")}
      footer={
        <>
          <BackLink href={stepHref(3)} />
          <DiscardDialog onErrors={setErrors} />
          <SubmitDialog onErrors={setErrors} />
        </>
      }
    >
      <Section
        id="review-details"
        title={t("review.sections.details")}
        step={1}
        errors={errors.filter((e) =>
          ["causa", "fechaInicio", "fechaFin"].includes(e.field),
        )}
      >
        <p className="text-sm break-words">
          {causa ? t(`causes.${causa}`) : notSet}
        </p>
        <p className="text-muted-foreground text-sm">
          {fechaInicio && fechaFin
            ? t("review.period", {
                start: date(fechaInicio),
                end: date(fechaFin),
              })
            : notSet}
        </p>
      </Section>

      <Section
        id="review-subjects"
        title={t("review.sections.subjects")}
        step={2}
        errors={errors.filter(
          (e) => e.field === "subjects" && e.asignaturaId === undefined,
        )}
      >
        {degraded ? (
          <p role="status" className="text-sm">
            {t("subjects.degraded")}
          </p>
        ) : groups.length === 0 ? (
          <p className="text-sm">{notSet}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((g) => (
              <li key={g.grupoId} className="flex flex-col gap-1">
                <span className="text-sm break-words">
                  {g.asignaturaCodigo} · {g.asignaturaNombre}
                </span>
                <span className="text-muted-foreground flex flex-col text-sm sm:flex-row sm:gap-2">
                  <span>{t("subjects.group", { number: g.numeroGrupo })}</span>
                  <span>
                    {g.docenteNombre
                      ? t("subjects.teacher", { name: g.docenteNombre })
                      : t("subjects.noTeacher")}
                  </span>
                </span>
                <FieldErrors
                  id={`review-subject-${g.asignaturaId}`}
                  errors={errors.filter(
                    (e) => e.asignaturaId === g.asignaturaId,
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="review-documents"
        title={t("review.sections.documents")}
        step={3}
        errors={errorsOf(errors, "documents")}
      >
        {documents.length === 0 ? (
          <p className="text-sm">{notSet}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex min-w-0 flex-col">
                <span className="truncate text-sm" title={doc.nombreOriginal}>
                  {doc.nombreOriginal}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatFileSize(doc.tamanoBytes, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <FieldErrors
        id="review-form"
        errors={errors.filter((e) => !SECTION_FIELDS.includes(e.field))}
      />
    </StepShell>
  );
}
