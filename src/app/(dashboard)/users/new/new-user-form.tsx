"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import {
  createStaffAction,
  type CreateStaffState,
} from "@/app/(dashboard)/users/new/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import type { RolUsuario } from "@/lib/validations/auth";

const initialState: CreateStaffState = { error: null };

function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function NewUserForm({
  carreras,
  rolesAsignables,
}: {
  carreras: Carrera[];
  rolesAsignables: readonly RolUsuario[];
}) {
  const t = useTranslations("users.new");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    createStaffAction,
    initialState,
  );
  const [rol, setRol] = useState<string>("");
  const esCoordinacion = rol === "coordinacion";

  return (
    <form action={formAction}>
      <Card className="mx-auto w-full max-w-2xl [--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col gap-5">
          <Field htmlFor="nombreCompleto" label={t("nameLabel")}>
            <Input
              id="nombreCompleto"
              name="nombreCompleto"
              autoComplete="name"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field htmlFor="login" label={t("loginLabel")}>
              <Input id="login" name="login" autoComplete="off" required />
            </Field>

            <Field htmlFor="password" label={t("passwordLabel")}>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field htmlFor="correo" label={t("emailLabel")}>
              <Input
                id="correo"
                name="correo"
                type="email"
                autoComplete="email"
              />
            </Field>

            <Field htmlFor="telefono" label={t("phoneLabel")}>
              <Input id="telefono" name="telefono" autoComplete="tel" />
            </Field>
          </div>

          <Field htmlFor="rol" label={t("roleLabel")}>
            <Select
              name="rol"
              required
              value={rol}
              onValueChange={(value) => setRol(value ?? "")}
              items={rolesAsignables.map((r) => ({
                value: r,
                label: t(`roles.${r}`),
              }))}
            >
              <SelectTrigger id="rol" className="w-full">
                <SelectValue placeholder={t("rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {rolesAsignables.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Coordination is the only role tied to a career, so the field
              appears when it becomes relevant instead of sitting disabled. */}
          {esCoordinacion ? (
            <Field htmlFor="carreraId" label={t("careerLabel")}>
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
            </Field>
          ) : null}

          {state.error ? (
            <p
              role="alert"
              aria-live="polite"
              className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {state.error}
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="border-border flex justify-end gap-3 border-t py-4">
          <Link href="/users" className={buttonVariants({ variant: "ghost" })}>
            {tCommon("cancel")}
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("submitting") : t("submit")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
