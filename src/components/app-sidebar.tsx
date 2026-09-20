"use client";

import { LayoutDashboard, Settings, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { canManageUsers } from "@/lib/auth/permissions";
import type { RolUsuario } from "@/lib/validations/auth";

const items = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "users", href: "/users", icon: Users, requiresUserManagement: true },
  { key: "settings", href: "/settings", icon: Settings },
] as const;

export function AppSidebar({ rol }: { rol: RolUsuario }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const visibleItems = items.filter(
    (item) => !("requiresUserManagement" in item) || canManageUsers(rol),
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-sidebar-border border-b">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Image
            src="/uam-seeklogo.png"
            alt=""
            width={28}
            height={28}
            className="shrink-0"
            priority
          />
          <span className="font-display text-sidebar-accent-foreground truncate text-sm font-semibold">
            {tCommon("appName")}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sectionLabel")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      // The lime bar is the "you are here" signal
                      // (docs/design-system.md §2.3); aria-current carries the
                      // same information for anyone not reading colour.
                      className="data-active:shadow-[inset_3px_0_0_0_var(--highlight)]"
                      render={
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                        />
                      }
                    >
                      <item.icon className="size-4" />
                      <span>{t(item.key)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
