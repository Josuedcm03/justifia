"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";

import { DiasCell } from "@/app/(dashboard)/catalog/dias-cell";
import { enrollAction } from "@/app/(dashboard)/enrollment/actions";
import { ConfirmChangeDialog } from "@/app/(dashboard)/enrollment/confirm-change-dialog";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import type {
  EnrollableAsignatura,
  EnrollableGroup,
  MyEnrollment,
} from "@/lib/data/enrollment-picker";
import type { EnrollmentErrorCode } from "@/lib/enrollment/types";

/** Case- and accent-insensitive "contains", the way the combobox filters. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

type Replacing = { group: EnrollableGroup; current: MyEnrollment };

/**
 * Picker of the offered groups (RF-16, RN-21). The student chooses an asignatura
 * in a searchable list, own carrera first and every other carrera reachable by
 * code, name or carrera name; the choice lives in `?asignatura=` so the server
 * page reads that asignatura's groups (SE-6). Enrolling in a group of an
 * asignatura the student already has for the period asks to replace it first
 * (RNF-12); otherwise it enrolls directly. The server decides everything again.
 */
export function GroupPicker({
  periodo,
  asignaturas,
  truncated,
  selectedId,
  groups,
  enrollments,
}: {
  periodo: string;
  asignaturas: readonly EnrollableAsignatura[];
  truncated: boolean;
  selectedId: number | null;
  groups: readonly EnrollableGroup[];
  enrollments: readonly MyEnrollment[];
}) {
  const t = useTranslations("enrollment");
  const tDias = useTranslations("catalog.shared.dias");
  const router = useRouter();
  const [replacing, setReplacing] = useState<Replacing | null>(null);
  const [error, setError] = useState<EnrollmentErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  // Own carrera first (stable), each other carrera named so it can be searched.
  const items = useMemo(
    () =>
      [...asignaturas]
        .sort((a, b) => Number(b.ownCarrera) - Number(a.ownCarrera))
        .map((a) => ({
          value: String(a.id),
          label: a.ownCarrera
            ? `${a.codigo} · ${a.nombre}`
            : `${a.codigo} · ${a.nombre} (${a.carreraNombre})`,
        })),
    [asignaturas],
  );
  // The search text is owned here so it survives the popup closing: Base UI
  // would clear it (reason `input-clear`) and the no-results state with it.
  const [text, setText] = useState(
    () => items.find((item) => item.value === String(selectedId))?.label ?? "",
  );
  const term = text.trim();
  const noMatches =
    term !== "" && !items.some((item) => fold(item.label).includes(fold(term)));

  const label = (e: MyEnrollment) =>
    `${e.asignaturaCodigo} · ${e.asignaturaNombre}, ${t("list.group", { number: e.numeroGrupo })}`;

  function enroll(group: EnrollableGroup) {
    const current = enrollments.find(
      (e) =>
        e.asignaturaId === selectedId &&
        e.periodo === periodo &&
        e.grupoId !== group.grupoId,
    );
    if (current) {
      setReplacing({ group, current });
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await enrollAction({ grupoId: group.grupoId });
      setError(result.ok ? null : result.error);
    });
  }

  return (
    <section aria-labelledby="group-picker" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="group-picker" className="text-headline">
          {t("picker.title")}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("picker.description", { periodo })}
        </p>
      </div>
      <FormField id="enrollment-asignatura" label={t("picker.subjectLabel")}>
        {(control) => (
          <Combobox
            {...control}
            name="asignaturaId"
            items={items}
            emptyText={t("picker.popupEmpty")}
            placeholder={t("picker.placeholder")}
            truncated={truncated}
            truncatedText={t("picker.truncated")}
            defaultValue={selectedId === null ? null : String(selectedId)}
            inputValue={text}
            onInputValueChange={(value, reason) => {
              if (reason !== "input-clear") setText(value);
            }}
            onValueChange={(value) =>
              router.replace(value ? `?asignatura=${value}` : "?")
            }
          />
        )}
      </FormField>
      {noMatches ? (
        <EmptyState
          variant="no-results"
          title={t("picker.noResults.title", { term })}
          hint={t("picker.noResults.hint")}
          clear={{
            label: t("picker.noResults.clear"),
            onClick: () => setText(""),
          }}
        />
      ) : null}
      {error ? (
        <p
          role="alert"
          className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
        >
          {t(`errors.${error}`)}
        </p>
      ) : null}
      {selectedId !== null && groups.length > 0 ? (
        <ul
          aria-label={t("picker.groupsCaption")}
          className="flex flex-col gap-3"
        >
          {groups.map((g) => {
            const group = t("list.group", { number: g.numeroGrupo });
            const isEnrolled = enrollments.some((e) => e.grupoId === g.grupoId);
            return (
              <li
                key={g.grupoId}
                className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-medium break-words">{group}</p>
                  <p className="text-muted-foreground text-sm break-words">
                    {g.docenteNombre
                      ? t("list.teacher", { name: g.docenteNombre })
                      : t("list.noTeacher")}{" "}
                    · {t("picker.days")}:{" "}
                    <DiasCell
                      dias={g.dias}
                      short={(dia) => tDias(`short.${dia}`)}
                      long={(dia) => tDias(`long.${dia}`)}
                      notSet={tDias("notSet")}
                    />
                  </p>
                </div>
                {isEnrolled ? (
                  <p className="text-sm font-medium">{t("picker.enrolled")}</p>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={pending}
                    aria-label={t("picker.enrollLabel", { group })}
                    onClick={() => enroll(g)}
                  >
                    {t("picker.enroll")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {replacing ? (
        <ConfirmChangeDialog
          key={replacing.group.grupoId}
          texts={{
            title: t("dialog.replace.title", {
              group: label(replacing.current),
            }),
            description: t("dialog.replace.description", {
              group: label(replacing.current),
              next: t("list.group", { number: replacing.group.numeroGrupo }),
            }),
            warning: replacing.current.inOpenRequest
              ? t("dialog.warning")
              : undefined,
            confirm: t("dialog.replace.confirm"),
            pending: t("dialog.replace.pending"),
          }}
          action={() => enrollAction({ grupoId: replacing.group.grupoId })}
          onClose={() => setReplacing(null)}
        />
      ) : null}
    </section>
  );
}
