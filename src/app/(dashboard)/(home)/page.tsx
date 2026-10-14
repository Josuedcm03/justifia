import Link from "next/link";
import { UserCheck, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DegradedAlert } from "@/components/degraded-alert";
import { PageFrame } from "@/components/page-frame";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { canCreateUsers } from "@/lib/auth/permissions";
import { getDashboardStats } from "@/lib/data/users";
import { shortcutsFor } from "@/lib/navigation";

/**
 * Role-aware home (BS-HOME-1, design decision 9 of `backoffice-ui-refresh`).
 *
 * - Shortcuts come from `shortcutsFor(rol)`, the same configuration and
 *   predicates as the sidebar, so the two cannot disagree. The dashboard and
 *   `/settings` are never offered.
 * - The user counts are system-wide totals (A-HOME-SCOPE, confirmed): they show
 *   only to roles that may open `/users`, and the stats read is not performed
 *   for any other role.
 * - A failed stats read shows the degraded alert instead of zeros (R10).
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const nav = await getTranslations("nav");

  const shortcuts = shortcutsFor(user.rol);
  const stats = canCreateUsers(user.rol) ? await getDashboardStats() : null;

  const counts = stats
    ? [
        { label: t("totalUsers"), value: stats.totalUsuarios, icon: Users },
        {
          label: t("activeUsers"),
          value: stats.usuariosActivos,
          icon: UserCheck,
        },
      ]
    : [];

  return (
    <PageFrame>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {stats?.degraded ? (
        <DegradedAlert message={t("degraded")} />
      ) : counts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {counts.map((card) => (
            <Card key={card.label}>
              <CardHeader className="gap-1">
                {/* Metric card — docs/design-system.md §5: a tinted icon chip,
                    the label, then the figure on the display step. */}
                <div
                  aria-hidden="true"
                  className="bg-brand-ink/10 text-primary mb-3 flex size-12 items-center justify-center rounded-lg"
                >
                  <card.icon className="size-6" />
                </div>
                <p className="text-label text-muted-foreground">{card.label}</p>
                <CardTitle className="text-display tabular-nums">
                  {card.value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {shortcuts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((link) => (
            // Shortcut card — docs/design-system.md §5: the tinted icon chip,
            // a title and one muted sentence; hover tint only on
            // hover-capable pointers, focus is the shared ring.
            <Link
              key={link.key}
              href={link.href}
              prefetch={"prefetch" in link ? link.prefetch : undefined}
              className="border-border bg-card text-card-foreground shadow-soft hover:bg-primary/5 focus-visible:ring-ring focus-visible:ring-offset-background flex flex-col gap-1 rounded-xl border p-6 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <span
                aria-hidden="true"
                className="bg-brand-ink/10 text-primary mb-3 flex size-12 items-center justify-center rounded-lg"
              >
                <link.icon className="size-6" />
              </span>
              <span className="text-title">{nav(link.key)}</span>
              <span className="text-muted-foreground text-sm">
                {t(`shortcuts.${link.key}`)}
              </span>
            </Link>
          ))}
        </div>
      ) : !stats ? (
        <p className="text-muted-foreground max-w-prose">{t("empty")}</p>
      ) : null}
    </PageFrame>
  );
}
