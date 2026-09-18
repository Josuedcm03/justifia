"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
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

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    loginAction,
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
          <input type="hidden" name="next" value={next} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="login">{t("loginLabel")}</Label>
            <Input
              id="login"
              name="login"
              autoComplete="username"
              autoFocus
              required
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
            />
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
            {t("isStudent")}{" "}
            <Link href="/register" className="underline underline-offset-4">
              {t("registerLink")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
