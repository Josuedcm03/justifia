import { getFormatter, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { listCarreras } from "@/lib/data/carreras";
import { getUsuarioByLogin } from "@/lib/data/users";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{usuario?.nombreCompleto ?? session.nombre}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t("loginLabel")}</span>
            <span>{usuario?.login ?? session.login}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t("roleLabel")}</span>
            <span className="capitalize">{usuario?.rol ?? session.rol}</span>
          </div>
          {usuario?.correo ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("emailLabel")}</span>
              <span>{usuario.correo}</span>
            </div>
          ) : null}
          {usuario?.telefono ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("phoneLabel")}</span>
              <span>{usuario.telefono}</span>
            </div>
          ) : null}
          {usuario?.cif ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("cifLabel")}</span>
              <span>{usuario.cif}</span>
            </div>
          ) : null}
          {carrera ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("careerLabel")}</span>
              <span>{carrera.nombre}</span>
            </div>
          ) : null}
          {usuario ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {t("memberSinceLabel")}
              </span>
              <span>
                {format.dateTime(usuario.creadoEn, { dateStyle: "medium" })}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
