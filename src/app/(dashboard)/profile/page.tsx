import { getFormatter, getTranslations } from "next-intl/server";
import { cn } from "cn";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { listCarreras } from "@/lib/data/carreras";
import { getUsuarioByLogin } from "@/lib/data/users";

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className={cn("text-title break-words", capitalize && "capitalize")}>
        {value}
      </dd>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await requireUser();
  const t = await getTranslations("profile");
  const format = await getFormatter();

  const [usuario, carreras] = await Promise.all([
    getUsuarioByLogin(session.login),
    listCarreras(),
  ]);

  const carrera = usuario?.carreraId
    ? carreras.find((c) => c.id === usuario.carreraId)
    : null;

  const rows: { label: string; value: string; capitalize?: boolean }[] = [
    { label: t("loginLabel"), value: usuario?.login ?? session.login },
    {
      label: t("roleLabel"),
      value: usuario?.rol ?? session.rol,
      capitalize: true,
    },
  ];

  if (usuario?.correo)
    rows.push({ label: t("emailLabel"), value: usuario.correo });
  if (usuario?.telefono)
    rows.push({ label: t("phoneLabel"), value: usuario.telefono });
  if (usuario?.cif) rows.push({ label: t("cifLabel"), value: usuario.cif });
  if (carrera) rows.push({ label: t("careerLabel"), value: carrera.nombre });
  if (usuario)
    rows.push({
      label: t("memberSinceLabel"),
      value: format.dateTime(usuario.creadoEn, { dateStyle: "medium" }),
    });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card className="max-w-2xl">
        <CardHeader className="border-b">
          <CardTitle className="text-headline">
            {usuario?.nombreCompleto ?? session.nombre}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {rows.map((row) => (
              <Row key={row.label} {...row} />
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
