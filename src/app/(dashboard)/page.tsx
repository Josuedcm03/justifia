import { UserCheck, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/data/users";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const stats = await getDashboardStats();

  const cards = [
    { label: t("totalUsers"), value: stats.totalUsuarios, icon: Users },
    {
      label: t("activeUsers"),
      value: stats.usuariosActivos,
      icon: UserCheck,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
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
    </div>
  );
}
