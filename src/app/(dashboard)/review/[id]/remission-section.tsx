import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";

import { Fact, Section } from "@/app/(dashboard)/review/[id]/request-sections";
import { ResendRemissionButton } from "@/app/(dashboard)/review/[id]/resend-remission-button";
import { SpecialFormatUpload } from "@/app/(dashboard)/review/[id]/special-format-upload";
import type { RemissionView } from "@/lib/data/remision";
import type { RemissionState } from "@/lib/remission/states";
import type { RevisionClase } from "@/db/schema";

// The remissions of an approved request, one card entry per teacher (RF-09 c).
// Staff only: the teacher's snapshot email is shown here and in no student
// view. Sync component, like the other sections: text and dates resolve on the
// server, and the send time is shown in the business zone.

const BUSINESS_TIME_ZONE = "America/Managua";

const STATE_TONES: Record<RemissionState, string> = {
  pendiente: "bg-warning/10 text-warning-ink",
  enviada: "bg-success/10 text-success-ink",
  bloqueada: "bg-destructive/10 text-destructive-ink",
};

const ALERT =
  "border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm";

export function RemissionSection({
  remissions,
  unassigned,
  specialFormat,
}: {
  remissions: readonly RemissionView[];
  /** Groups of the request that have no teacher: nothing is sent for them. */
  unassigned: readonly RevisionClase[];
  /** Present when the approval was marked for the RN-19 format. */
  specialFormat?: {
    solicitudId: number;
    attached: { id: number; nombreOriginal: string } | null;
  };
}) {
  const t = useTranslations("review.remission");
  const notSet = useTranslations("review.detail")("notSet");
  const format = useFormatter();
  const group = (c: RevisionClase) =>
    t("group", { code: c.codigo, name: c.nombre, number: c.numeroGrupo });

  return (
    <Section id="remission" title={t("title")}>
      <ul className="flex flex-col gap-6">
        {remissions.map((r) => (
          <li key={r.id} className="flex flex-col gap-3">
            <span className="text-sm font-medium break-words">
              {r.docenteNombre}
            </span>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label={t("fields.email")}>{r.correo ?? notSet}</Fact>
              <Fact label={t("fields.state")}>
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
                    STATE_TONES[r.estado],
                  )}
                >
                  {t(`states.${r.estado}`)}
                </span>
              </Fact>
              <Fact label={t("fields.groups")}>
                <ul className="flex flex-col gap-1">
                  {r.clases.map((c) => (
                    <li key={`${c.asignaturaId}-${c.numeroGrupo}`}>
                      {group(c)}
                    </li>
                  ))}
                </ul>
              </Fact>
              {r.enviadaEn ? (
                <Fact label={t("fields.sentAt")}>
                  {format.dateTime(r.enviadaEn, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: BUSINESS_TIME_ZONE,
                  })}
                </Fact>
              ) : null}
            </dl>
            {r.motivoCodigo ? (
              <p role="alert" className={ALERT}>
                {t(`reasons.${r.motivoCodigo}`)}
              </p>
            ) : null}
            {r.estado === "enviada" ? null : (
              <ResendRemissionButton
                remisionId={r.id}
                teacherName={r.docenteNombre}
              />
            )}
          </li>
        ))}
      </ul>
      {specialFormat ? (
        <div className="border-border border-t pt-6">
          <SpecialFormatUpload {...specialFormat} />
        </div>
      ) : null}
      {unassigned.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("noTeacher", { groups: unassigned.map(group).join("; ") })}
        </p>
      ) : null}
    </Section>
  );
}
