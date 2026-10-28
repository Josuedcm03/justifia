import { cn } from "cn";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { RequestCard } from "@/app/(dashboard)/requests/request-card";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { listOwnRequests } from "@/lib/data/student-requests";

/**
 * The student's own requests (RF-07 c). The list is built from the session
 * user only, never from request input (RNF-01). Own reads are not audited
 * (student-requests spec), so nothing is written here.
 */
export default async function OwnRequestsPage() {
  const user = await requireRole(...rolesSolicitantes);
  const t = await getTranslations("requests.list");
  const requests = await listOwnRequests(Number(user.sub));

  const newRequest = (
    <Link
      href="/requests/new"
      className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
    >
      {t("newRequest")}
    </Link>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={requests.length > 0 ? newRequest : undefined}
      />

      {requests.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center gap-4 rounded-xl border px-6 py-12 text-center">
          <p className="text-muted-foreground max-w-prose">{t("empty")}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {newRequest}
            <Link
              href="/enrollment"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto",
              )}
            >
              {t("enrollment")}
            </Link>
          </div>
        </div>
      ) : (
        <ul aria-label={t("caption")} className="flex flex-col gap-4">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </ul>
      )}
    </div>
  );
}
