import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { DocumentDataForm } from "@/app/(dashboard)/review/[id]/document-data-form";
import {
  Fact,
  Section,
  useDates,
} from "@/app/(dashboard)/review/[id]/request-sections";
import { DegradedAlert } from "@/components/degraded-alert";
import type { ExtractionList, ExtractionListItem } from "@/lib/data/extraction";
import { datumOrigin, type ManualDatum } from "@/lib/document-data/effective";
import type { DocumentMarks, ManualFields } from "@/lib/document-data/types";
import {
  toExtractionDisplay,
  type ExtractionDisplay,
} from "@/lib/extraction/display";
import type { EstadoSolicitud } from "@/lib/intake/states";

// The "Extracted data" section of the staff detail (RF-11, DE-13, RF-14). A
// server component with no polling: it renders what the read model holds, the
// effective values (manual over extracted, RN-24), each manual datum marked as
// such, the type and the two marks, and, while the request can be edited, the
// manual data form of each current document (MD-23). The display rules (which
// state wins) live in `toExtractionDisplay`; this file turns them into text.
// The name read from the document is shown as such and is never compared with
// the snapshot name (RN-02).

type DataDisplay = Extract<ExtractionDisplay, { kind: "data" }>;

function Recognized({ value }: { value: string | null }) {
  const t = useTranslations("review.extraction");
  return value === null ? (
    <span className="text-muted-foreground">{t("notRecognized")}</span>
  ) : (
    value
  );
}

/** The text mark of a value entered by hand; never colour alone (RF-14 a). */
function ManualBadge() {
  const t = useTranslations("review.extraction");
  return (
    <span className="bg-muted text-muted-foreground inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium">
      {t("manualBadge")}
    </span>
  );
}

/** A value and, when the secretary entered it, the manual mark. */
function Datum({
  recognized,
  manual,
  datum,
  children,
}: {
  recognized: boolean;
  manual: ManualFields | null;
  datum: ManualDatum;
  children: ReactNode;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {children}
      {recognized && datumOrigin(manual, datum) === "manual" ? (
        <ManualBadge />
      ) : null}
    </span>
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

function ExtractedFields({
  display,
  manual,
}: {
  display: DataDisplay;
  manual: ManualFields | null;
}) {
  const t = useTranslations("review.extraction.fields");
  const dates = useDates();
  const text = (field: DataDisplay["issuer"]) =>
    field.recognized ? field.value : null;

  return (
    <>
      <Fact label={t("studentName")}>
        <Datum
          recognized={display.studentName.recognized}
          manual={manual}
          datum="studentName"
        >
          <Recognized value={text(display.studentName)} />
        </Datum>
      </Fact>
      <Fact label={t("issuer")}>
        <Datum
          recognized={display.issuer.recognized}
          manual={manual}
          datum="issuer"
        >
          <Recognized value={text(display.issuer)} />
        </Datum>
      </Fact>
      <Fact label={t("issueDate")}>
        <Datum
          recognized={display.issueDate.recognized}
          manual={manual}
          datum="issueDate"
        >
          <Recognized
            value={
              display.issueDate.recognized
                ? dates.day(display.issueDate.value)
                : null
            }
          />
        </Datum>
      </Fact>
      <Fact label={t("restPeriod")}>
        <Datum
          recognized={display.rest.recognized}
          manual={manual}
          datum="rest"
        >
          <RestPeriod rest={display.rest} />
        </Datum>
      </Fact>
    </>
  );
}

/** The registered type and the two marks; `null` reads "Sin registrar". */
function MarkFacts({ marks }: { marks: DocumentMarks }) {
  const t = useTranslations("review.extraction");
  const state = (mark: boolean | null) =>
    t(`markValues.${mark === null ? "unregistered" : mark ? "yes" : "no"}`);

  return (
    <>
      <Fact label={t("marks.type")}>
        {marks.type === null
          ? t("markValues.unregistered")
          : t(`types.${marks.type}`)}
      </Fact>
      <Fact label={t("marks.signature")}>{state(marks.hasSignature)}</Fact>
      <Fact label={t("marks.seal")}>{state(marks.hasSeal)}</Fact>
    </>
  );
}

function Entry({
  item,
  display,
  editable,
  solicitudId,
}: {
  item: ExtractionListItem;
  display: ExtractionDisplay;
  editable: boolean;
  solicitudId: number;
}) {
  const t = useTranslations("review.extraction.states");

  return (
    <li className="flex flex-col gap-3">
      <h3 className="text-title break-all">{item.nombreOriginal}</h3>
      {display.kind === "extracting" || display.kind === "unavailable" ? (
        <p className="text-muted-foreground text-sm">
          {t(display.kind === "extracting" ? "extracting" : "unavailable")}
        </p>
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2">
        {display.kind === "data" ? (
          <ExtractedFields display={display} manual={item.manual} />
        ) : null}
        <MarkFacts marks={item.marks} />
      </dl>
      {editable ? (
        <DocumentDataForm
          // Remounts closed once a save changes what is stored (MD-23).
          key={JSON.stringify([item.documentoId, item.manual, item.marks])}
          solicitudId={solicitudId}
          documentoId={item.documentoId}
          documentName={item.nombreOriginal}
          manual={item.manual}
          marks={item.marks}
          extracted={item.ocr}
        />
      ) : null}
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
  solicitudId,
  extractions,
  requestState,
  configured,
  editable,
}: {
  solicitudId: number;
  extractions: ExtractionList;
  requestState: EstadoSolicitud;
  configured: boolean;
  /** True while the request is `pendiente`: the secretary may register data. */
  editable: boolean;
}) {
  const t = useTranslations("review");
  if (!extractions.degraded && extractions.data.length === 0) return null;

  const entries = extractions.degraded
    ? []
    : extractions.data.map((item) => ({
        item,
        display: toExtractionDisplay(item.row, { requestState, configured }),
      }));
  const waitingForSetup = entries.some(
    (e) => e.display.kind === "notConfigured",
  );
  // A document waiting for the setting is listed only to carry its form
  // (RF-14 c); with no form to offer it is covered by the notice alone.
  const listed = entries.filter(
    (e) => e.display.kind !== "notConfigured" || editable,
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
            {listed.map(({ item, display }) => (
              <Entry
                key={item.documentoId}
                item={item}
                display={display}
                editable={editable}
                solicitudId={solicitudId}
              />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
