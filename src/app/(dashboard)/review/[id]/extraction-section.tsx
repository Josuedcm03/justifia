import { useTranslations } from "next-intl";

import {
  Fact,
  Section,
  useDates,
} from "@/app/(dashboard)/review/[id]/request-sections";
import { DegradedAlert } from "@/components/degraded-alert";
import type { ExtractionList, ExtractionListItem } from "@/lib/data/extraction";
import {
  toExtractionDisplay,
  type ExtractionDisplay,
} from "@/lib/extraction/display";
import type { EstadoSolicitud } from "@/lib/intake/states";

// The "Extracted data" section of the staff detail (RF-11, DE-13). A server
// component with no polling and no action: it only renders what the read model
// holds. The display rules (which state wins) live in `toExtractionDisplay`;
// this file turns them into text. The name read from the document is shown as
// such and is never compared with the snapshot name (RN-02).

type DataDisplay = Extract<ExtractionDisplay, { kind: "data" }>;

function Recognized({ value }: { value: string | null }) {
  const t = useTranslations("review.extraction");
  return value === null ? (
    <span className="text-muted-foreground">{t("notRecognized")}</span>
  ) : (
    value
  );
}

/** Calendar dates stay ISO strings, so no time zone can shift them. */
function RestPeriod({ rest }: { rest: DataDisplay["rest"] }) {
  const t = useTranslations("review.extraction");
  const dates = useDates();
  if (!rest.recognized) return <Recognized value={null} />;

  const days = t("restDays", { count: rest.days });
  if (rest.from === null || rest.to === null) return days;
  if (rest.from === rest.to) {
    return t("restSingleDay", { date: dates.day(rest.from), days });
  }
  return t("restRange", {
    from: dates.day(rest.from),
    to: dates.day(rest.to),
    days,
  });
}

function ExtractedFields({ display }: { display: DataDisplay }) {
  const t = useTranslations("review.extraction.fields");
  const dates = useDates();
  const text = (field: DataDisplay["issuer"]) =>
    field.recognized ? field.value : null;

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Fact label={t("studentName")}>
        <Recognized value={text(display.studentName)} />
      </Fact>
      <Fact label={t("issuer")}>
        <Recognized value={text(display.issuer)} />
      </Fact>
      <Fact label={t("issueDate")}>
        <Recognized
          value={
            display.issueDate.recognized
              ? dates.day(display.issueDate.value)
              : null
          }
        />
      </Fact>
      <Fact label={t("restPeriod")}>
        <RestPeriod rest={display.rest} />
      </Fact>
    </dl>
  );
}

function Entry({
  name,
  display,
}: {
  name: string;
  display: Exclude<ExtractionDisplay, { kind: "notConfigured" }>;
}) {
  const t = useTranslations("review.extraction.states");

  return (
    <li className="flex flex-col gap-3">
      <h3 className="text-title break-all">{name}</h3>
      {display.kind === "data" ? (
        <ExtractedFields display={display} />
      ) : (
        <p className="text-muted-foreground text-sm">
          {t(display.kind === "extracting" ? "extracting" : "unavailable")}
        </p>
      )}
    </li>
  );
}

/** A setup problem for the administrator, said once for the whole section. */
function ConfigurationNotice() {
  const t = useTranslations("review.extraction.states");
  return (
    <p
      role="status"
      className="border-warning/30 border-l-warning bg-warning/10 text-warning-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
    >
      {t("notConfigured")}
    </p>
  );
}

export function ExtractionSection({
  extractions,
  requestState,
  configured,
}: {
  extractions: ExtractionList;
  requestState: EstadoSolicitud;
  configured: boolean;
}) {
  const t = useTranslations("review");
  if (!extractions.degraded && extractions.data.length === 0) return null;

  const entries = extractions.degraded
    ? []
    : extractions.data.map((item: ExtractionListItem) => ({
        item,
        display: toExtractionDisplay(item.row, { requestState, configured }),
      }));
  const waitingForSetup = entries.some(
    (e) => e.display.kind === "notConfigured",
  );

  return (
    <Section id="extraction" title={t("detail.sections.extraction")}>
      {extractions.degraded ? (
        <DegradedAlert message={t("extraction.degraded")} />
      ) : (
        <>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("extraction.note")}
          </p>
          {waitingForSetup ? <ConfigurationNotice /> : null}
          <ul className="flex flex-col gap-6">
            {entries.map(({ item, display }) =>
              display.kind === "notConfigured" ? null : (
                <Entry
                  key={item.documentoId}
                  name={item.nombreOriginal}
                  display={display}
                />
              ),
            )}
          </ul>
        </>
      )}
    </Section>
  );
}
