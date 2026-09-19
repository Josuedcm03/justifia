import type { ReactNode } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Two-panel auth shell (docs/design-system.md §4.3): an ink-900 brand panel
 * carrying the institutional mark above `lg`, the form on the card surface at
 * the right. Below `lg` the panel collapses to a compact header.
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("common");

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="bg-sidebar text-sidebar-foreground relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Image
            src="/uam-seeklogo.png"
            alt=""
            width={40}
            height={40}
            className="shrink-0"
            priority
          />
          <span className="font-display text-sidebar-accent-foreground text-lg font-semibold">
            {t("appName")}
          </span>
        </div>

        <p className="font-display max-w-[16ch] text-4xl leading-[1.15] font-bold text-white">
          {t("tagline")}
        </p>

        <p className="text-sm">{t("institution")}</p>

        {/* Single quiet accent: the teal edge where the panel meets the form. */}
        <div
          aria-hidden
          className="bg-primary-hover absolute inset-y-0 right-0 w-1"
        />
      </aside>

      <main className="bg-card relative flex flex-col items-center justify-center px-6 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        {/* Each form owns its own measure — sign-in is narrow, sign-up is not. */}
        <div className="flex w-full flex-col gap-8 *:mx-auto *:w-full">
          <div className="flex items-center gap-3 lg:hidden">
            <Image
              src="/uam-seeklogo.png"
              alt=""
              width={32}
              height={32}
              className="shrink-0"
              priority
            />
            <span className="font-display text-base font-semibold">
              {t("appName")}
            </span>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
