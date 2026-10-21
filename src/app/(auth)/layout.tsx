import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ThemeToggle } from "@/components/theme-toggle";
import { PRIVACY_PATH } from "@/lib/auth/public-paths";

/**
 * Centred auth shell (docs/design-system.md §4.3): the brand block, the form
 * card and the institution line stacked on the page background, over a quiet
 * dotted field. Each form brings its own card (`AuthCard`) and measure.
 * One privacy-notice link (same tab) here covers both login and register.
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("common");

  return (
    <main className="auth-mesh bg-background relative flex min-h-svh flex-col items-center justify-center px-4 py-12 md:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-3">
            <Image
              src="/uam-seeklogo.png"
              alt=""
              width={40}
              height={40}
              className="shrink-0"
              priority
            />
            <span className="text-display-mobile md:text-display text-primary">
              {t("appName")}
            </span>
          </div>
          <p className="text-label text-muted-foreground">{t("tagline")}</p>
        </div>

        {children}

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-label text-muted-foreground">{t("institution")}</p>
          <Link
            href={PRIVACY_PATH}
            className="text-primary hover:text-primary-hover inline-flex min-h-11 items-center rounded-sm text-sm underline-offset-4 hover:underline"
          >
            {t("privacyNotice")}
          </Link>
        </div>
      </div>
    </main>
  );
}
