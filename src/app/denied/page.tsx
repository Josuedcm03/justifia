import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { buttonVariants } from "@/components/ui/button";

/**
 * Generic permission-denied screen (design.md decisions 13-15). It has no
 * session read and no role guard on purpose: a page that never calls
 * `redirect` cannot redirect to itself, which is the structural half of the
 * no-loop guarantee. The unauthenticated branch never reaches this page
 * either — middleware.ts sends an anonymous request to /login first.
 * By product decision the screen sits on the neutral app background and red
 * appears only as an accent, in the icon badge (design.md decision 16, revised).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("denied");
  const tCommon = await getTranslations("common");
  return { title: `${t("title")} · ${tCommon("appName")}` };
}

export default async function DeniedPage() {
  const t = await getTranslations("denied");

  return (
    <main className="bg-background text-foreground flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div
          aria-hidden="true"
          className="bg-denied/10 text-denied flex size-16 items-center justify-center rounded-full"
        >
          <ShieldOff className="size-8" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-h1 text-foreground">{t("title")}</h1>
          <p className="text-lead text-muted-foreground max-w-prose">
            {t("message")}
          </p>
        </div>
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
