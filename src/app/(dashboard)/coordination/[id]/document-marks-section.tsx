import { useTranslations } from "next-intl";

import { Fact, Section } from "@/app/(dashboard)/review/[id]/request-sections";
import { DegradedAlert } from "@/components/degraded-alert";
import type {
  DocumentMarksItem,
  DocumentMarksList,
} from "@/lib/data/document-marks-read";

// The read-only block of the coordination detail (MD-30): the registered type
// and the firma and sello marks of each current document, so the coordinator
// can understand the signals RN-11, RN-12 and RN-13 that open a case (RF-10 c,
// RF-14 b, RF-14 d). A server component with no action and no control. It
// renders only what the narrow read hands it, which holds no name, issuer,
// date or rest period (RNF-01, RNF-02). Every state is conveyed as text:
// `null` reads "Sin registrar", never "No".

function Entry({ item }: { item: DocumentMarksItem }) {
  const t = useTranslations("coordination.detail");
  const state = (mark: boolean | null) =>
    t(`markValues.${mark === null ? "unregistered" : mark ? "yes" : "no"}`);

  return (
    <li className="flex flex-col gap-3">
      <h3 className="text-title break-all">{item.nombreOriginal}</h3>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Fact label={t("marks.type")}>
          {item.type === null
            ? t("markValues.unregistered")
            : t(`types.${item.type}`)}
        </Fact>
        <Fact label={t("marks.signature")}>{state(item.hasSignature)}</Fact>
        <Fact label={t("marks.seal")}>{state(item.hasSeal)}</Fact>
      </dl>
    </li>
  );
}

export function DocumentMarksSection({ marks }: { marks: DocumentMarksList }) {
  const t = useTranslations("coordination.detail");
  if (!marks.degraded && marks.data.length === 0) return null;

  return (
    <Section id="marks" title={t("sections.marks")}>
      {marks.degraded ? (
        <DegradedAlert message={t("marksDegraded")} />
      ) : (
        <>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("marks.note")}
          </p>
          <ul className="flex flex-col gap-6">
            {marks.data.map((item) => (
              <Entry key={item.documentoId} item={item} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
