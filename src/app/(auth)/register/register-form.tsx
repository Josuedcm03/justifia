"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";

import {
  registerAction,
  type RegisterState,
} from "@/app/(auth)/register/actions";
import { AuthCard } from "@/components/auth-card";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
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

function Field({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Section({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-label-caps text-muted-foreground mb-4 w-full border-b pb-2 uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

export function RegisterForm({ carreras }: { carreras: Carrera[] }) {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialState,
  );

  const describedBy = state.error ? "register-error" : undefined;

  return (
    <AuthCard className="max-w-xl">
      <header className="flex flex-col gap-1">
        <h1 className="text-headline">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("subtitle")}
        </p>
      </header>

      <form action={formAction} className="flex flex-col gap-8">
        {/* Three passes instead of one wall of eight fields: who you are, how
            you get in, how we reach you. */}
        <Section legend={t("sections.identity")}>
          <Field htmlFor="nombreCompleto" label={t("nameLabel")}>
            <Input
              id="nombreCompleto"
              name="nombreCompleto"
              autoComplete="name"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="cif" label={t("cifLabel")}>
              <Input id="cif" name="cif" required />
            </Field>

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
          </div>
        </Section>

        <Section legend={t("sections.access")}>
          <Field htmlFor="login" label={t("loginLabel")}>
            <Input
              id="login"
              name="login"
              autoComplete="username"
              required
              aria-describedby={describedBy}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="password" label={t("passwordLabel")}>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                showLabel={tCommon("showPassword")}
                hideLabel={tCommon("hidePassword")}
              />
            </Field>

            <Field htmlFor="confirmPassword" label={t("confirmPasswordLabel")}>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
                showLabel={tCommon("showPassword")}
                hideLabel={tCommon("hidePassword")}
              />
            </Field>
          </div>
        </Section>

        <Section legend={t("sections.contact")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="correo" label={t("emailLabel")}>
              <Input
                id="correo"
                name="correo"
                type="email"
                autoComplete="email"
                required
              />
            </Field>

            <Field htmlFor="telefono" label={t("phoneLabel")}>
              <Input id="telefono" name="telefono" autoComplete="tel" />
            </Field>
          </div>
        </Section>

        {state.error ? (
          <p
            id="register-error"
            role="alert"
            aria-live="polite"
            className="border-destructive/30 border-l-destructive bg-destructive/8 text-destructive-ink rounded-lg border border-l-4 px-3 py-2 text-sm"
          >
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </form>

      <div className="border-border flex flex-col items-center gap-2 border-t pt-6 text-center">
        <p className="text-muted-foreground text-sm">{t("hasAccount")}</p>
        <Link
          href="/login"
          className="text-title text-primary hover:text-primary-hover rounded-sm underline-offset-4 hover:underline"
        >
          {t("signIn")}
        </Link>
      </div>
    </AuthCard>
  );
}
