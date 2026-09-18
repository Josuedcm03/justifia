import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/dal";
import { listUsuarios } from "@/lib/data/users";

export default async function UsersPage() {
  const t = await getTranslations("users");
  const format = await getFormatter();
  const [{ data, degraded }, user] = await Promise.all([
    listUsuarios(),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        {user?.rol === "administrador" ? (
          <Button render={<Link href="/users/new" />}>{t("newButton")}</Button>
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.login")}</TableHead>
              <TableHead>{t("columns.role")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.createdAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground text-center"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.nombreCompleto}
                  </TableCell>
                  <TableCell>{u.login}</TableCell>
                  <TableCell className="capitalize">{u.rol}</TableCell>
                  <TableCell>
                    {u.activo ? t("status.active") : t("status.inactive")}
                  </TableCell>
                  <TableCell>
                    {format.dateTime(u.creadoEn, { dateStyle: "medium" })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {degraded ? (
        <p className="text-muted-foreground text-xs">
          Database unavailable — showing empty state.
        </p>
      ) : null}
    </div>
  );
}
