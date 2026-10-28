"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { dropAction } from "@/app/(dashboard)/enrollment/actions";
import { ConfirmChangeDialog } from "@/app/(dashboard)/enrollment/confirm-change-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { MyEnrollment } from "@/lib/data/enrollment-picker";

/**
 * The student's effective enrollments (RF-16, RF-04) with a drop control per
 * entry. Dropping always confirms (RNF-12) and warns when a draft or returned
 * request uses the group (D5); the warning never blocks. The list itself comes
 * from the server and refreshes when the action revalidates `/enrollment`.
 */
export function MyEnrollments({
  enrollments,
}: {
  enrollments: readonly MyEnrollment[];
}) {
  const t = useTranslations("enrollment");
  const [dropping, setDropping] = useState<MyEnrollment | null>(null);

  const label = (e: MyEnrollment) =>
    `${e.asignaturaCodigo} · ${e.asignaturaNombre}, ${t("list.group", { number: e.numeroGrupo })}`;

  return (
    <section aria-labelledby="my-enrollments" className="flex flex-col gap-4">
      <h2 id="my-enrollments" className="text-headline">
        {t("list.title")}
      </h2>
      {enrollments.length === 0 ? (
        <EmptyState variant="empty" message={t("list.empty")} />
      ) : (
        <ul aria-label={t("list.caption")} className="flex flex-col gap-3">
          {enrollments.map((e) => (
            <li
              key={e.grupoId}
              className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium break-words">
                  {e.asignaturaCodigo} · {e.asignaturaNombre}
                </p>
                <p className="text-muted-foreground text-sm break-words">
                  {t("list.period", { periodo: e.periodo })} ·{" "}
                  {t("list.group", { number: e.numeroGrupo })} ·{" "}
                  {e.docenteNombre
                    ? t("list.teacher", { name: e.docenteNombre })
                    : t("list.noTeacher")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                aria-label={t("list.dropLabel", {
                  subject: `${e.asignaturaCodigo} · ${e.asignaturaNombre}`,
                  group: t("list.group", { number: e.numeroGrupo }),
                })}
                onClick={() => setDropping(e)}
              >
                {t("list.drop")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {dropping ? (
        <ConfirmChangeDialog
          key={dropping.grupoId}
          texts={{
            title: t("dialog.drop.title", { group: label(dropping) }),
            description: t("dialog.drop.description"),
            warning: dropping.inOpenRequest ? t("dialog.warning") : undefined,
            confirm: t("dialog.drop.confirm"),
            pending: t("dialog.drop.pending"),
          }}
          action={() => dropAction({ grupoId: dropping.grupoId })}
          onClose={() => setDropping(null)}
        />
      ) : null}
    </section>
  );
}
