"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/change-password/actions";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: ChangePasswordState = { error: null };

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useTranslations("changePassword");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialState,
  );

  const invalid = state.error ? true : undefined;
  const describedBy = state.error ? "change-password-error" : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose">
          {forced ? t("subtitleForced") : t("subtitle")}
        </p>
      </header>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentPassword">{t("currentPasswordLabel")}</Label>
          <PasswordInput
            id="currentPassword"
            name="currentPassword"
            autoComplete="current-password"
            autoFocus
            required
            showLabel={tCommon("showPassword")}
            hideLabel={tCommon("hidePassword")}
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="newPassword">{t("newPasswordLabel")}</Label>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            required
            showLabel={tCommon("showPassword")}
            hideLabel={tCommon("hidePassword")}
            aria-invalid={invalid}
            aria-describedby={
              describedBy
                ? `new-password-hint ${describedBy}`
                : "new-password-hint"
            }
          />
          <p id="new-password-hint" className="text-muted-foreground text-sm">
            {t("newPasswordHint")}
          </p>
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
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>

        {state.error ? (
          <p
            id="change-password-error"
            role="alert"
            aria-live="polite"
            className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </form>
    </div>
  );
}
