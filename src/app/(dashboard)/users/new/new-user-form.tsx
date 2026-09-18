"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import {
  createStaffAction,
  type CreateStaffState,
} from "@/app/(dashboard)/users/new/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Carrera } from "@/db/schema";
import { rolesStaff } from "@/lib/validations/users";

const initialState: CreateStaffState = { error: null };

export function NewUserForm({ carreras }: { carreras: Carrera[] }) {
  const t = useTranslations("users.new");
  const [state, formAction, isPending] = useActionState(
    createStaffAction,
    initialState,
  );
  const [rol, setRol] = useState<string>("");
  const esCoordinacion = rol === "coordinacion";

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombreCompleto">{t("nameLabel")}</Label>
            <Input id="nombreCompleto" name="nombreCompleto" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="login">{t("loginLabel")}</Label>
            <Input id="login" name="login" autoComplete="off" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="correo">{t("emailLabel")}</Label>
            <Input id="correo" name="correo" type="email" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="telefono">{t("phoneLabel")}</Label>
            <Input id="telefono" name="telefono" autoComplete="tel" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rol">{t("roleLabel")}</Label>
            <Select
              name="rol"
              required
              value={rol}
              onValueChange={(value) => setRol(value ?? "")}
              items={rolesStaff.map((r) => ({
                value: r,
                label: t(`roles.${r}`),
              }))}
            >
              <SelectTrigger id="rol" className="w-full">
                <SelectValue placeholder={t("rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {rolesStaff.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {esCoordinacion ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="carreraId">{t("careerLabel")}</Label>
              <Select
                name="carreraId"
                required
                items={carreras.map((c) => ({
                  value: String(c.id),
                  label: c.nombre,
                }))}
              >
                <SelectTrigger id="carreraId" className="w-full">
                  <SelectValue placeholder={t("careerPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {carreras.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {state.error ? (
            <p
              role="alert"
              className="text-destructive text-sm"
              aria-live="polite"
            >
              {state.error}
            </p>
          ) : null}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
