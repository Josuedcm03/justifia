"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";

import {
  registerAction,
  type RegisterState,
} from "@/app/(auth)/register/actions";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const initialState: RegisterState = { error: null };

export function RegisterForm({ carreras }: { carreras: Carrera[] }) {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialState,
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombreCompleto">{t("nameLabel")}</Label>
            <Input id="nombreCompleto" name="nombreCompleto" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="login">{t("loginLabel")}</Label>
            <Input id="login" name="login" autoComplete="username" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              showLabel={tCommon("showPassword")}
              hideLabel={tCommon("hidePassword")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              required
              showLabel={tCommon("showPassword")}
              hideLabel={tCommon("hidePassword")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="correo">{t("emailLabel")}</Label>
            <Input id="correo" name="correo" type="email" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="telefono">{t("phoneLabel")}</Label>
            <Input id="telefono" name="telefono" autoComplete="tel" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cif">{t("cifLabel")}</Label>
            <Input id="cif" name="cif" required />
          </div>

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

          <p className="text-muted-foreground text-center text-sm">
            {t("hasAccount")}{" "}
            <Link href="/login" className="underline underline-offset-4">
              {t("signIn")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
