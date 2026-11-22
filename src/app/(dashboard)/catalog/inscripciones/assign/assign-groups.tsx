import { useTranslations } from "next-intl";

import { DiasCell } from "@/app/(dashboard)/catalog/dias-cell";
import { StatusPill } from "@/components/status-pill";
import type { DiaSemana } from "@/lib/catalog/dias";

/**
 * Exactly what the confirmed assign form of S3b-2 needs, and nothing more
 * (EA-PII-1): the student the call is for, the subject it names, the period,
 * the offered groups and the student's current group of the subject. The
 * current group's id is the `expectedReplaced` the form sends back (13.6); its
 * number names the group the confirmation replaces. The page builds this
 * object field by field, so a column added to a read later never reaches it.
 */
export type AssignGroupsProps = {
  student: { id: number; nombreCompleto: string; cif: string | null };
  asignatura: { id: number; codigo: string; nombre: string };
  periodo: string;
  groups: readonly {
    grupoId: number;
    numeroGrupo: string;
    docenteNombre: string | null;
    dias: readonly DiaSemana[];
    /** The student's active group of this subject and period. */
    current: boolean;
  }[];
  /** Named even when it is no longer offered (then no listed group is marked). */
  currentGroup: { grupoId: number; numeroGrupo: string } | null;
};

/**
 * The offered groups of the chosen subject with the student's current group
 * named (EA-CHG-1). Read-only in S3b-1: there is no control here until the form
 * of S3b-2 replaces this list.
 */
export function AssignGroups({
  student,
  asignatura,
  periodo,
  groups,
  currentGroup,
}: AssignGroupsProps) {
  const t = useTranslations("catalog.inscripciones.assign");
  const tDias = useTranslations("catalog.shared.dias");

  return (
    <section
      aria-labelledby="assign-groups-title"
      className="flex flex-col gap-3"
    >
      <h2 id="assign-groups-title" className="text-headline">
        {t("groups.title", { periodo })}
      </h2>
      <p className="text-muted-foreground max-w-prose text-sm">
        {currentGroup
          ? t("groups.currentNotice", {
              student: student.nombreCompleto,
              number: currentGroup.numeroGrupo,
            })
          : t("groups.noCurrent", { student: student.nombreCompleto })}
      </p>
      <ul
        aria-label={t("groups.caption", {
          subject: `${asignatura.codigo} · ${asignatura.nombre}`,
        })}
        className="flex flex-col gap-3"
      >
        {groups.map((g) => (
          <li
            key={g.grupoId}
            className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium break-words">
                {t("groups.group", { number: g.numeroGrupo })}
              </p>
              {g.current ? (
                <StatusPill active label={t("groups.current")} />
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm break-words">
              {g.docenteNombre
                ? t("groups.teacher", { name: g.docenteNombre })
                : t("groups.noTeacher")}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("groups.days")}:{" "}
              <DiasCell
                dias={g.dias}
                short={(dia) => tDias(`short.${dia}`)}
                long={(dia) => tDias(`long.${dia}`)}
                notSet={tDias("notSet")}
              />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
