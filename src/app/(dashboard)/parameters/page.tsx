import { getTranslations } from "next-intl/server";

import { PageFrame } from "@/components/page-frame";
import { PageHeader } from "@/components/page-header";
import { requireParameterAccess } from "@/lib/auth/parameter-access";
import { loadNormativeParameters } from "@/lib/parameters/loader";
import { PARAMETER_KEYS, PARAMETER_REGISTRY } from "@/lib/parameters/registry";

import { saveCalendarAction, saveScalarParametersAction } from "./actions";
import { CalendarSection } from "./calendar-section";
import { ScalarsForm } from "./scalars-form";

// The one screen that edits the normative parameters (NP-7, CU-13). The guard
// is the first statement: nothing is read for a caller who may not be here.
// Opening the page only reads, so it writes no parameter row and no audit row.
// A read that fell back shows its defaults like any other value: no alert and
// no locked form (scope cut 2026-11-27).
export default async function ParametersPage() {
  await requireParameterAccess();
  const t = await getTranslations("parameters.page");
  const { values } = await loadNormativeParameters(new Date());

  // The scalar keys are the registry entries that carry an integer range.
  const scalars = PARAMETER_KEYS.flatMap((key) => {
    const { range, field } = PARAMETER_REGISTRY[key];
    return range ? [{ key, value: values[field] as number }] : [];
  });

  return (
    <PageFrame>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="text-muted-foreground max-w-prose text-sm">
        {t("effectNote")}
      </p>
      <ScalarsForm action={saveScalarParametersAction} fields={scalars} />
      <CalendarSection
        action={saveCalendarAction}
        entries={values.nonWorkingDays}
      />
    </PageFrame>
  );
}
