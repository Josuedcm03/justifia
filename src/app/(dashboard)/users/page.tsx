import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { rolesQueGestionanUsuarios } from "@/lib/auth/permissions";
import { listUsuarios } from "@/lib/data/users";

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? "bg-accent text-accent-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          : "bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      }
    >
      {label}
    </span>
  );
}

export default async function UsersPage() {
  await requireRole(...rolesQueGestionanUsuarios);
  const t = await getTranslations("users");
  const format = await getFormatter();
  const { data, degraded } = await listUsuarios();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button render={<Link href="/users/new" />}>{t("newButton")}</Button>
        }
      />

      {degraded ? (
        <p
          role="status"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {t("degraded")}
        </p>
      ) : null}

      {data.length === 0 ? (
        // An empty screen is an invitation to act, not an apology.
        <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
          <p className="text-muted-foreground max-w-prose">{t("empty")}</p>
          <Button render={<Link href="/users/new" />}>{t("newButton")}</Button>
        </div>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.login")}</TableHead>
                <TableHead>{t("columns.role")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">
                  {t("columns.createdAt")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id} className="hover:bg-accent/50">
                  <TableCell className="font-medium">
                    {u.nombreCompleto}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.login}
                  </TableCell>
                  <TableCell className="capitalize">{u.rol}</TableCell>
                  <TableCell>
                    <StatusPill
                      active={u.activo}
                      label={
                        u.activo ? t("status.active") : t("status.inactive")
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {format.dateTime(u.creadoEn, { dateStyle: "medium" })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
