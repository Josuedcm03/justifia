import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CONSENT_VERSION } from "@/lib/intake/consent";

/**
 * Public privacy notice (RC-10, RN-25). It lives outside `(dashboard)` and
 * `(auth)` on purpose: it has no session read, no role guard and no redirect,
 * so an anonymous visitor and a signed-in user get the same static notice
 * (`middleware.ts` lets the path through via `isPublicPage`). The locale comes
 * from the cookie through the request config, so it works anonymously.
 *
 * Draft: UAM legal review is pending, so the marker is the first element. The
 * Spanish text is pinned to `CONSENT_VERSION` by `consent.test.ts`.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  const tCommon = await getTranslations("common");
  return { title: `${t("title")} · ${tCommon("appName")}` };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <main className="bg-background text-foreground flex flex-1 flex-col items-center px-4 py-12 md:px-8">
      <article className="flex w-full max-w-prose min-w-0 flex-col gap-6 break-words">
        <div
          role="note"
          className="border-warning/30 border-l-warning bg-warning/8 text-warning-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
        >
          {t("draft")}
        </div>

        <header className="flex flex-col gap-2">
          <h1 className="text-display-mobile md:text-display text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t.rich("version", {
              version: CONSENT_VERSION,
              date: (chunks) => (
                <time dateTime={CONSENT_VERSION}>{chunks}</time>
              ),
            })}
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-foreground">
            {t("controller.title")}
          </h2>
          <p className="text-base">{t("controller.body")}</p>
          <p className="text-muted-foreground text-base">
            {t("controller.contact")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-foreground">
            {t("purpose.title")}
          </h2>
          <p className="text-base">{t("purpose.body")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-foreground">
            {t("recipients.title")}
          </h2>
          <p className="text-base">{t("recipients.body")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-foreground">{t("data.title")}</h2>
          <ul className="flex list-disc flex-col gap-1 pl-6 text-base">
            <li>{t("data.identity")}</li>
            <li>{t("data.request")}</li>
            <li>{t("data.documents")}</li>
            <li>{t("data.health")}</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-foreground">
            {t("mandatory.title")}
          </h2>
          <p className="text-base">{t("mandatory.body")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-foreground">{t("rights.title")}</h2>
          <p className="text-base">{t("rights.body")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-foreground">
            {t("retention.title")}
          </h2>
          <p className="text-base">{t("retention.body")}</p>
        </section>
      </article>
    </main>
  );
}
