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
  Settings,
  Users,
} from "lucide-react";
import { describe, expect, it } from "vitest";

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

import {
  isCurrentPath,
  isNavVisible,
  NAV_CONTEXT_ONLY,
  NAV_ITEMS,
  type NavLink,
  shortcutsFor,
  trailFor,
} from "./navigation";

const ALL_ROLES: readonly RolUsuario[] = [
  "estudiante",
  "docente",
  "coordinacion",
  "secretaria",
  "administrador",
];

// Characterization pin (BS-NAV-1): the list the sidebar rendered before the
// config moved out of `app-sidebar.tsx`, plus the `/requests` and `/review`
// entries main added and the merge dropped (Batch S). Content and order must not
// change (D7: the settings entry stays as it was, even though its route does not
// exist). Proved by a mutation check, see apply-progress.
describe("NAV_ITEMS (BS-NAV-1 characterization)", () => {
  it("equals the previous sidebar list in content and order", () => {
    expect(NAV_ITEMS).toEqual([
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
          {
            key: "users",
            href: "/users",
            icon: Users,
            visibleTo: canCreateUsers,
          },
        ],
      },
      { key: "settings", href: "/settings", icon: Settings },
    ]);
  });

  it("opts the review entry out of prefetching (it writes an audited read)", () => {
    const review = NAV_ITEMS.find((item) => item.key === "review");

    expect(review).toMatchObject({ href: "/review", prefetch: false });
  });

  it("opts the coordinator entry out of prefetching too (its list is an audited read)", () => {
    const coordination = NAV_ITEMS.find((item) => item.key === "coordination");

    expect(coordination).toMatchObject({
      href: "/coordination",
      prefetch: false,
    });
  });

  it("leaves every other leaf without a prefetch flag", () => {
    const leaves = NAV_ITEMS.flatMap((item): readonly NavLink[] =>
      "children" in item ? item.children : [item],
    );

    for (const leaf of leaves.filter(
      (l) => l.key !== "review" && l.key !== "coordination",
    )) {
      expect(leaf, leaf.key).not.toHaveProperty("prefetch");
    }
  });

  it("keeps the settings entry last and pointing at /settings", () => {
    expect(NAV_ITEMS.at(-1)).toMatchObject({
      key: "settings",
      href: "/settings",
    });
  });
});

describe("NAV_CONTEXT_ONLY", () => {
  it("holds exactly the profile page, which has no menu entry", () => {
    expect(NAV_CONTEXT_ONLY).toEqual([{ key: "profile", href: "/profile" }]);
  });
});

describe("isCurrentPath", () => {
  it.each([
    ["/", "/", true],
    ["/users", "/", false],
    ["/users", "/users", true],
    ["/users/new", "/users", true],
    ["/users-archive", "/users", false],
    ["/catalog/asignaturas/3/grupos/new", "/catalog/asignaturas", true],
    ["/catalog/asignaturas", "/catalog/docentes", false],
  ])("%s against %s is %s", (pathname, href, expected) => {
    expect(isCurrentPath(pathname, href)).toBe(expected);
  });
});

describe("isNavVisible (same predicates as the sidebar)", () => {
  const leaf = (key: string) => {
    for (const item of NAV_ITEMS) {
      if ("children" in item) {
        const child = item.children.find((entry) => entry.key === key);
        if (child) return child;
      } else if (item.key === key) {
        return item;
      }
    }
    throw new Error(`no nav leaf ${key}`);
  };

  const STAFF: readonly RolUsuario[] = [
    "administrador",
    "coordinacion",
    "secretaria",
  ];

  it.each([
    ["dashboard", ALL_ROLES],
    ["settings", ALL_ROLES],
    ["myRequests", ["estudiante"]],
    ["newRequest", ["estudiante"]],
    ["enrollment", ["estudiante"]],
    ["review", ["secretaria"]],
    ["coordination", ["coordinacion"]],
    ["catalogAsignaturas", STAFF],
    ["catalogDocentes", STAFF],
    ["catalogImport", ["secretaria"]],
    ["users", STAFF],
  ] as const)("%s is visible to exactly %j", (key, visible) => {
    for (const rol of ALL_ROLES) {
      expect(isNavVisible(leaf(key), rol), `${key} for ${rol}`).toBe(
        (visible as readonly RolUsuario[]).includes(rol),
      );
    }
  });
});

describe("trailFor (BS-CTX-1)", () => {
  it.each([
    ["/", { key: "dashboard", href: "/", exact: true }],
    [
      "/users",
      { groupKey: "administration", key: "users", href: "/users", exact: true },
    ],
    [
      "/users/new",
      {
        groupKey: "administration",
        key: "users",
        href: "/users",
        exact: false,
      },
    ],
    [
      "/catalog/asignaturas",
      {
        groupKey: "administration",
        key: "catalogAsignaturas",
        href: "/catalog/asignaturas",
        exact: true,
      },
    ],
    [
      "/catalog/asignaturas/3/edit",
      {
        groupKey: "administration",
        key: "catalogAsignaturas",
        href: "/catalog/asignaturas",
        exact: false,
      },
    ],
    [
      "/catalog/asignaturas/3/grupos/5/edit",
      {
        groupKey: "administration",
        key: "catalogAsignaturas",
        href: "/catalog/asignaturas",
        exact: false,
      },
    ],
    [
      "/catalog/docentes",
      {
        groupKey: "administration",
        key: "catalogDocentes",
        href: "/catalog/docentes",
        exact: true,
      },
    ],
    [
      "/catalog/import",
      {
        groupKey: "administration",
        key: "catalogImport",
        href: "/catalog/import",
        exact: true,
      },
    ],
    ["/requests", { key: "myRequests", href: "/requests", exact: true }],
    [
      "/requests/new",
      { key: "newRequest", href: "/requests/new", exact: true },
    ],
    ["/requests/42", { key: "myRequests", href: "/requests", exact: false }],
    ["/enrollment", { key: "enrollment", href: "/enrollment", exact: true }],
    ["/review", { key: "review", href: "/review", exact: true }],
    ["/review/42", { key: "review", href: "/review", exact: false }],
    [
      "/coordination",
      { key: "coordination", href: "/coordination", exact: true },
    ],
    [
      "/coordination/42",
      { key: "coordination", href: "/coordination", exact: false },
    ],
    ["/profile", { key: "profile", href: "/profile", exact: true }],
  ])("%s resolves to its section trail", (pathname, trail) => {
    expect(trailFor(pathname)).toEqual(trail);
  });

  it.each(["/nope", "/catalog", "/users-archive", "/profile-edit"])(
    "%s has no trail",
    (pathname) => {
      expect(trailFor(pathname)).toBeNull();
    },
  );

  it("never carries a record name or id: only config keys and hrefs", () => {
    const trail = trailFor("/catalog/asignaturas/12345/edit");

    expect(Object.keys(trail ?? {}).sort()).toEqual([
      "exact",
      "groupKey",
      "href",
      "key",
    ]);
    expect(JSON.stringify(trail)).not.toContain("12345");
  });
});

describe("shortcutsFor (BS-HOME-1 inputs)", () => {
  it.each([
    ["estudiante", ["/requests", "/requests/new", "/enrollment"]],
    ["docente", []],
    ["administrador", ["/catalog/asignaturas", "/catalog/docentes", "/users"]],
    [
      "coordinacion",
      ["/coordination", "/catalog/asignaturas", "/catalog/docentes", "/users"],
    ],
    [
      "secretaria",
      [
        "/review",
        "/catalog/asignaturas",
        "/catalog/docentes",
        "/catalog/import",
        "/users",
      ],
    ],
  ] as const)("%s gets exactly its destinations, in order", (rol, hrefs) => {
    expect(shortcutsFor(rol).map((link) => link.href)).toEqual(hrefs);
  });

  it.each(ALL_ROLES)("never offers the dashboard or settings to %s", (rol) => {
    const hrefs = shortcutsFor(rol).map((link) => link.href);

    expect(hrefs).not.toContain("/");
    expect(hrefs).not.toContain("/settings");
  });
});
