import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { logoutAction } from "@/app/(auth)/login/actions";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getUserLocale } from "@/i18n/locale";
import type { SessionPayload } from "@/lib/auth/session";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function DashboardHeader({ user }: { user: SessionPayload }) {
  const locale = await getUserLocale();
  const t = await getTranslations("auth.userMenu");

  return (
    <header className="bg-card/85 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4 backdrop-blur-sm md:px-8">
      <SidebarTrigger />
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher current={locale} />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={user.nombre}
              >
                <Avatar className="size-8">
                  <AvatarFallback>{initials(user.nombre)}</AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span>{user.nombre}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {t("signedInAs", { login: user.login, rol: user.rol })}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/profile">{t("viewProfile")}</Link>}
            />
            <DropdownMenuItem
              render={
                <form action={logoutAction}>
                  <button type="submit" className="w-full text-left">
                    {t("logout")}
                  </button>
                </form>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
