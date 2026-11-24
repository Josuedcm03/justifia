import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { ASSIGN_BASE } from "./assign-params";

/** The subject as the picker shows it; the carrera name tells apart a subject
 *  of another carrera (EA-CRE-1 scopes the student, not the subject). */
export type AsignaturaOption = {
  id: number;
  codigo: string;
  nombre: string;
  carreraNombre: string;
  ownCarrera: boolean;
};

const SELECT =
  "border-input bg-card text-foreground h-11 w-full rounded-lg border px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-ring/40 focus-visible:ring-3";

/**
 * The subject choice (EA-CRE-1, EA-CHG-1): a GET form with the student as a
 * hidden field, so the choice lives in the URL and the server page reads that
 * subject's groups. The student's own carrera comes first, then the others
 * named by their carrera, as on the student's own picker (SE-4).
 */
export function AsignaturaPicker({
  studentId,
  asignaturas,
  truncated,
  selectedId,
}: {
  studentId: number;
  asignaturas: readonly AsignaturaOption[];
  truncated: boolean;
  selectedId: number | null;
}) {
  const t = useTranslations("catalog.inscripciones.assign");
  // A stable sort: the read's order inside each of the two blocks is kept.
  const ordered = [...asignaturas].sort(
    (a, b) => Number(b.ownCarrera) - Number(a.ownCarrera),
  );

  return (
    <section
      aria-labelledby="assign-picker-title"
      className="flex flex-col gap-3"
    >
      <h2 id="assign-picker-title" className="text-headline">
        {t("picker.title")}
      </h2>
      <form
        method="get"
        action={ASSIGN_BASE}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="estudiante" value={studentId} />
        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-80">
          <Label htmlFor="assign-asignatura">{t("picker.label")}</Label>
          <select
            id="assign-asignatura"
            name="asignatura"
            required
            defaultValue={selectedId === null ? "" : String(selectedId)}
            className={SELECT}
          >
            <option value="">{t("picker.placeholder")}</option>
            {ordered.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ownCarrera
                  ? `${a.codigo} · ${a.nombre}`
                  : `${a.codigo} · ${a.nombre} (${a.carreraNombre})`}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {t("picker.submit")}
        </Button>
      </form>
      {truncated ? (
        <p className="text-muted-foreground text-sm">{t("picker.truncated")}</p>
      ) : null}
    </section>
  );
}
