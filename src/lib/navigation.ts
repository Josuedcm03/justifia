import {
  BookMarked,
  BookOpen,
  Briefcase,
  ClipboardCheck,
  FilePlus,
  FileSpreadsheet,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Settings,
  Users,
} from "lucide-react";

import {
  canCoordinate,
  canCreateUsers,
  canFileRequests,
  canImportCatalog,
  canManageCatalog,
  canManageOwnEnrollment,
  canReviewRequests,
} from "@/lib/auth/permissions";
import type { RolUsuario } from "@/lib/validations/auth";

export type NavLink = {
  key: string;
  href: string;
  icon: LucideIcon;
  visibleTo?: (rol: RolUsuario) => boolean;
  /**
   * `false` keeps Next.js from prefetching the target. The review and
   * coordination pages write an audit row when they render, so nothing may
   * render them speculatively.
   */
  prefetch?: false;
};

export type NavGroup = {
  key: string;
  icon: LucideIcon;
  children: readonly NavLink[];
};

// The one navigation list: the sidebar, the top-bar page context and the
// dashboard home all read it, so they cannot disagree. Each reader imports it
// directly; predicates are never passed as props.
//
// `visibleTo` is the only access rule an item carries; it reuses the same
// predicates the pages enforce, so the menu can never offer what a page denies.
// A group has no rule of its own: it shows when at least one child does, so a
// new back-office page is one more entry in `children`.
export const NAV_ITEMS = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  {
    key: "myRequests",
    href: "/requests",
    icon: ListChecks,
    visibleTo: canFileRequests,
  },
  {
    key: "newRequest",
    href: "/requests/new",
    icon: FilePlus,
    visibleTo: canFileRequests,
  },
  {
    key: "enrollment",
    href: "/enrollment",
    icon: BookMarked,
    visibleTo: canManageOwnEnrollment,
  },
  {
    key: "review",
    href: "/review",
    icon: ClipboardCheck,
    visibleTo: canReviewRequests,
    prefetch: false,
  },
  {
    key: "coordination",
    href: "/coordination",
    icon: Inbox,
    visibleTo: canCoordinate,
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

// Routes that name a page the top bar should locate but that have no menu
// entry. The page context reads the label from `nav.<key>`.
export const NAV_CONTEXT_ONLY = [{ key: "profile", href: "/profile" }] as const;

// Entries that are not offered as dashboard shortcuts: the dashboard is where
// the shortcuts live, and the settings route does not exist (D7 freezes the
// sidebar entry, not a second dead link).
const NOT_A_SHORTCUT: readonly string[] = ["dashboard", "settings"];

export type NavTrail = {
  groupKey?: string;
  key: string;
  href: string;
  /** True when the page is the entry itself, false when it is below it. */
  exact: boolean;
};

export function isCurrentPath(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

// `/requests/new` sits under `/requests`: the more specific top-level link owns
// the page, so two top-level entries are never current together.
const TOP_LEVEL_HREFS: readonly string[] = NAV_ITEMS.flatMap((item) =>
  "href" in item ? [item.href] : [],
);

export function isCurrentTopLevel(pathname: string, href: string): boolean {
  return (
    isCurrentPath(pathname, href) &&
    !TOP_LEVEL_HREFS.some(
      (other) => other.startsWith(`${href}/`) && isCurrentPath(pathname, other),
    )
  );
}

export function isNavVisible(item: NavLink, rol: RolUsuario): boolean {
  return !item.visibleTo || item.visibleTo(rol);
}

/**
 * The section trail for a path: the menu group (when the entry has one) and the
 * entry, never a record name. A path with no menu entry and no context-only
 * entry has no trail.
 */
export function trailFor(pathname: string): NavTrail | null {
  const places: { groupKey?: string; key: string; href: string }[] = [
    ...NAV_ITEMS.flatMap(
      (item): { groupKey?: string; key: string; href: string }[] =>
        "children" in item
          ? item.children.map((child) => ({ ...child, groupKey: item.key }))
          : [item],
    ),
    ...NAV_CONTEXT_ONLY,
  ];

  // The most specific entry owns the page: `/requests/new` is not a page
  // "below" `/requests`.
  const match = places
    .filter((place) => isCurrentPath(pathname, place.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return null;

  return {
    ...(match.groupKey ? { groupKey: match.groupKey } : {}),
    key: match.key,
    href: match.href,
    exact: pathname === match.href,
  };
}

/** Every menu destination the role can open, except the dashboard and settings. */
export function shortcutsFor(rol: RolUsuario): readonly NavLink[] {
  return NAV_ITEMS.flatMap((item): readonly NavLink[] =>
    "children" in item ? item.children : [item],
  ).filter(
    (link) => !NOT_A_SHORTCUT.includes(link.key) && isNavVisible(link, rol),
  );
}
