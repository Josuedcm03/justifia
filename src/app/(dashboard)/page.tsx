import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/data/users";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const stats = await getDashboardStats();

  const cards = [
    { label: t("totalUsers"), value: stats.totalUsuarios },
    { label: t("activeUsers"), value: stats.usuariosActivos },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="gap-2">
              <p className="text-muted-foreground text-sm">{card.label}</p>
              <CardTitle className="font-display text-h1 tabular-nums">
                {card.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
