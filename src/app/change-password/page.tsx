import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { logoutAction } from "@/app/(auth)/login/actions";
import { ChangePasswordForm } from "@/app/change-password/change-password-form";
import { Button } from "@/components/ui/button";
import { requireUserAllowingPasswordChange } from "@/lib/auth/dal";

/**
 * Forced-password-change screen (design D13). It lives outside `(dashboard)`
 * and uses the sibling guard that can only send an anonymous caller to login,
 * so this page cannot send a flagged session to itself. It also serves a
 * voluntary change by an unflagged user.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("changePassword");
  const tCommon = await getTranslations("common");
  return { title: `${t("title")} · ${tCommon("appName")}` };
}

export default async function ChangePasswordPage() {
  const session = await requireUserAllowingPasswordChange();
  const tMenu = await getTranslations("auth.userMenu");

  return (
    <>
      <ChangePasswordForm forced={session.debeCambiarClave === true} />

      {/* Sign out must stay reachable while flagged: no guard on this action. */}
      <form action={logoutAction} className="mx-auto w-full max-w-sm">
        <Button type="submit" variant="ghost" className="w-full">
          {tMenu("logout")}
        </Button>
      </form>
    </>
  );
}
