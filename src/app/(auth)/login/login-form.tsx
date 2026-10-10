"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
import { AuthCard } from "@/components/auth-card";
import { PasswordInput } from "@/components/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <AuthCard className="max-w-[440px]">
      <header className="flex flex-col gap-1">
        <h1 className="text-headline">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("subtitle")}
        </p>
      </header>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="login">{t("loginLabel")}</Label>
          <Input
            id="login"
            name="login"
            autoComplete="username"
            autoFocus
            required
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "login-error" : undefined}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            showLabel={tCommon("showPassword")}
            hideLabel={tCommon("hidePassword")}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "login-error" : undefined}
          />
        </div>

        {state.error ? (
          <p
            id="login-error"
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

      <div className="border-border flex flex-col gap-4 border-t pt-6 text-center">
        <p className="text-muted-foreground text-sm">{t("isStudent")}</p>
        <Link
          href="/register"
          className={buttonVariants({
            variant: "outline",
            className: "w-full",
          })}
        >
          {t("registerLink")}
        </Link>
      </div>
    </AuthCard>
  );
}
