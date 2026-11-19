import { useTranslations } from "next-intl";
import Link from "next/link";

import { AuthCard } from "@/components/auth-card";

/**
 * What /register shows while `REGISTRATION_OPEN` keeps self-registration
 * closed: a short notice in the sign-in card's measure and the way back to
 * /login. No form, so nothing to submit; the register action refuses anyway.
 */
export function RegistrationClosed() {
  const t = useTranslations("auth.register.closed");

  return (
    <AuthCard className="max-w-[440px]">
      <header className="flex flex-col gap-1">
        <h1 className="text-headline">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">{t("body")}</p>
      </header>

      <div className="border-border flex flex-col items-center border-t pt-6 text-center">
        <Link
          href="/login"
          className="text-title text-primary hover:text-primary-hover rounded-sm underline-offset-4 hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </AuthCard>
  );
}
