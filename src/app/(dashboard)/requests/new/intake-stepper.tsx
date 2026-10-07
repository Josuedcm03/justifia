import { useTranslations } from "next-intl";

import {
  STEP_KEYS,
  stepHref,
  type StepNumber,
} from "@/app/(dashboard)/requests/new/steps";
import { Stepper } from "@/components/ui/stepper";

/** The four-step header of the intake flow (RF-01); `current` is 1-based. */
export function IntakeStepper({ current }: { current: StepNumber }) {
  const t = useTranslations("intake.stepper");

  return (
    <Stepper
      label={t("label")}
      current={current}
      summary={t("stepOf", { current, total: STEP_KEYS.length })}
      steps={STEP_KEYS.map((key, index) => ({
        key,
        label: t(`steps.${key}`),
        href: stepHref(index + 1),
      }))}
    />
  );
}
