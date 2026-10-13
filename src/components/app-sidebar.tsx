"use client";

import {
  BookOpen,
  Briefcase,
  ChevronRight,
  ClipboardCheck,
  FilePlus,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { cn } from "cn";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  canCreateUsers,
  canFileRequests,
  canImportCatalog,
  canManageCatalog,
  canReviewRequests,
} from "@/lib/auth/permissions";
import type { RolUsuario } from "@/lib/validations/auth";

type NavLink = {
  key: string;
  href: string;
  icon: LucideIcon;
  visibleTo?: (rol: RolUsuario) => boolean;
  /** `false` keeps Next.js from prefetching the target. The review pages write
   *  an audit row when they render, so nothing may render them speculatively. */
  prefetch?: false;
};

type NavGroup = {
  key: string;
  icon: LucideIcon;
  children: readonly NavLink[];
};

// `visibleTo` is the only access rule an item carries; it reuses the same
// predicates the pages enforce, so the menu can never offer what a page denies.
// A group has no rule of its own: it shows when at least one child does, so a
// new back-office page is one more entry in `children`.
const items = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  {
    key: "newRequest",
    href: "/requests/new",
    icon: FilePlus,
    visibleTo: canFileRequests,
  },
  {
    key: "review",
    href: "/review",
    icon: ClipboardCheck,
    visibleTo: canReviewRequests,
    prefetch: false,
  },
  {
    key: "administration",
    icon: Briefcase,
    children: [
      {
        key: "catalogAsignaturas",
        href: "/catalog/asignaturas",
        icon: BookOpen,
        visibleTo: canManageCatalog,
      },
      {
        key: "catalogDocentes",
        href: "/catalog/docentes",
        icon: GraduationCap,
        visibleTo: canManageCatalog,
      },
      {
        key: "catalogImport",
        href: "/catalog/import",
        icon: FileSpreadsheet,
        visibleTo: canImportCatalog,
      },
      { key: "users", href: "/users", icon: Users, visibleTo: canCreateUsers },
    ],
  },
  { key: "settings", href: "/settings", icon: Settings },
] as const satisfies readonly (NavLink | NavGroup)[];

// The 4px primary bar is the "you are here" signal (docs/design-system.md
// §2.3); aria-current carries the same information for anyone not reading
// colour.
const currentMarker =
  "data-active:shadow-[inset_4px_0_0_0_var(--sidebar-primary)]";

function isCurrent(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function prefetchOf(item: NavLink) {
  return item.prefetch;
}

function isVisible(item: NavLink, rol: RolUsuario) {
  return !item.visibleTo || item.visibleTo(rol);
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
  const holdsCurrent = links.some((link) => isCurrent(pathname, link.href));
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
          const isActive = isCurrent(pathname, link.href);

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

export function AppSidebar({ rol }: { rol: RolUsuario }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
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
            <SidebarMenu>
              {items.map((item) => {
                if ("children" in item) {
                  const links = item.children
                    .filter((link) => isVisible(link, rol))
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

                if (!isVisible(item, rol)) return null;

                const isActive = isCurrent(pathname, item.href);

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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
