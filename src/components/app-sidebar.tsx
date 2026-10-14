"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { cn } from "cn";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { initials } from "@/lib/initials";
import {
  isCurrentPath,
  isCurrentTopLevel,
  isNavVisible,
  NAV_ITEMS,
  type NavLink,
} from "@/lib/navigation";
import type { RolUsuario } from "@/lib/validations/auth";

// The 4px primary bar is the "you are here" signal (docs/design-system.md
// §2.3); aria-current carries the same information for anyone not reading
// colour.
const currentMarker =
  "data-active:shadow-[inset_4px_0_0_0_var(--sidebar-primary)]";

// Only a leaf that opts out carries a value; the rest stay on Next.js defaults.
function prefetchOf(item: NavLink) {
  return item.prefetch;
}

function NavGroupItem({
  label,
  icon: Icon,
  links,
  pathname,
}: {
  label: string;
  icon: LucideIcon;
  links: readonly (NavLink & { label: string })[];
  pathname: string;
}) {
  const listId = useId();
  const holdsCurrent = links.some((link) => isCurrentPath(pathname, link.href));
  const [open, setOpen] = useState(holdsCurrent);

  // Landing on a child route opens the group; between navigations it stays
  // however the user left it.
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    if (holdsCurrent) setOpen(true);
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        // Kept while collapsed too: the list stays mounted, only hidden.
        aria-controls={listId}
        render={
          // Collapsed around the current page, the trigger takes the accent
          // background as a hint. Never the primary bar: that belongs to the
          // page itself.
          <SidebarMenuButton isActive={holdsCurrent && !open} />
        }
      >
        <Icon className="size-4" />
        <span className="truncate">{label}</span>
        <ChevronRight
          className={cn(
            "ease-ui ml-auto size-4 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        id={listId}
        keepMounted
        className="ease-ui h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-250 data-ending-style:h-0 data-starting-style:h-0"
        render={<SidebarMenuSub />}
      >
        {links.map((link) => {
          const isActive = isCurrentPath(pathname, link.href);

          return (
            <SidebarMenuSubItem key={link.key}>
              <SidebarMenuSubButton
                isActive={isActive}
                className={currentMarker}
                render={
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                  />
                }
              >
                <link.icon className="size-4" />
                <span>{link.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AppSidebar({
  rol,
  nombre,
}: {
  rol: RolUsuario;
  nombre: string;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("roles");
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-sidebar-border h-16 justify-center border-b p-0">
        <div className="flex items-center gap-3 px-6">
          <Image
            src="/uam-seeklogo.png"
            alt=""
            width={28}
            height={28}
            className="shrink-0"
            priority
          />
          <span className="text-title text-sidebar-primary truncate font-bold">
            {tCommon("appName")}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sectionLabel")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label={t("sectionLabel")}>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  if ("children" in item) {
                    const links = item.children
                      .filter((link) => isNavVisible(link, rol))
                      .map((link) => ({ ...link, label: t(link.key) }));
                    if (links.length === 0) return null;

                    return (
                      <NavGroupItem
                        key={item.key}
                        label={t(item.key)}
                        icon={item.icon}
                        links={links}
                        pathname={pathname}
                      />
                    );
                  }

                  if (!isNavVisible(item, rol)) return null;

                  const isActive = isCurrentTopLevel(pathname, item.href);

                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        className={currentMarker}
                        render={
                          <Link
                            href={item.href}
                            prefetch={prefetchOf(item)}
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
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar aria-hidden="true">
            <AvatarFallback className="bg-secondary text-primary text-xs font-bold">
              {initials(nombre)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span
              className="text-sidebar-foreground truncate text-sm font-semibold"
              title={nombre}
            >
              {nombre}
            </span>
            <span className="text-label text-muted-foreground truncate">
              {tRoles(rol)}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
