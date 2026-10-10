import { describe, expect, it } from "vitest";

import {
  canAssignRole,
  canCreateUsers,
  canImportCatalog,
  canManageCatalog,
  isCarreraScopedRole,
  rolesAsignablesPor,
  rolesQueCreanUsuarios,
  rolesQueGestionanCatalogo,
  rolesVisibles,
  rolesVisiblesPara,
} from "@/lib/auth/permissions";
import * as perms from "@/lib/auth/permissions";
import { rolesUsuario } from "@/lib/validations/auth";

const ALLOWED_PAIRS = new Set([
  "administrador:coordinacion",
  "coordinacion:secretaria",
  "secretaria:docente",
]);

const ALL_ROLE_PAIRS = rolesUsuario.flatMap((caller) =>
  rolesUsuario.map((target) => [caller, target] as const),
);

describe("rolesQueCreanUsuarios", () => {
  it("covers every role except estudiante and docente", () => {
    expect([...rolesQueCreanUsuarios].sort()).toEqual([
      "administrador",
      "coordinacion",
      "secretaria",
    ]);
  });
});

describe("canAssignRole", () => {
  it.each(ALL_ROLE_PAIRS)("caller %s -> target %s", (caller, target) => {
    const expected = ALLOWED_PAIRS.has(`${caller}:${target}`);
    expect(canAssignRole(caller, target)).toBe(expected);
  });

  it("denies an unknown target role for every caller", () => {
    for (const caller of rolesUsuario) {
      expect(canAssignRole(caller, "noSoyUnRol")).toBe(false);
    }
  });
});

describe("canCreateUsers", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "allows %s",
    (rol) => {
      expect(canCreateUsers(rol)).toBe(true);
    },
  );

  it.each(["docente", "estudiante"] as const)("denies %s", (rol) => {
    expect(canCreateUsers(rol)).toBe(false);
  });

  it("denies a missing caller role", () => {
    expect(canCreateUsers(undefined)).toBe(false);
  });
});

describe("canImportCatalog (CEI: Only secretaria may import)", () => {
  it("allows secretaria", () => {
    expect(canImportCatalog("secretaria")).toBe(true);
  });

  it.each([
    "administrador",
    "coordinacion",
    "docente",
    "estudiante",
    undefined,
  ] as const)("denies %s", (rol) => {
    expect(canImportCatalog(rol)).toBe(false);
  });

  it("tracks canAssignRole(rol, 'docente') for every role", () => {
    for (const rol of rolesUsuario) {
      expect(canImportCatalog(rol)).toBe(canAssignRole(rol, "docente"));
    }
  });
});

describe("rolesAsignablesPor", () => {
  it("returns an empty list for a missing caller role", () => {
    expect(rolesAsignablesPor(undefined)).toEqual([]);
  });
});

describe("single source of truth", () => {
  it("no longer exports the superseded module-policy names", () => {
    expect(perms).not.toHaveProperty("canManageUsers");
    expect(perms).not.toHaveProperty("rolesQueGestionanUsuarios");
  });
});

describe("rolesVisibles", () => {
  it("is total over every role", () => {
    expect(Object.keys(rolesVisibles).sort()).toEqual([...rolesUsuario].sort());
  });

  it.each(["administrador", "coordinacion"] as const)(
    "%s sees every role",
    (rol) => {
      expect([...rolesVisibles[rol]].sort()).toEqual([...rolesUsuario].sort());
    },
  );

  it("secretaria sees exactly docente, not administrador", () => {
    expect(rolesVisibles.secretaria).toEqual(["docente"]);
    expect(rolesVisibles.secretaria).not.toContain("administrador");
  });

  it.each(["docente", "estudiante"] as const)("%s sees nobody", (rol) => {
    expect(rolesVisibles[rol]).toEqual([]);
  });
});

describe("rolesVisiblesPara", () => {
  it("returns an empty list for a missing viewer role", () => {
    expect(rolesVisiblesPara(undefined)).toEqual([]);
  });

  it.each(["docente", "estudiante"] as const)(
    "returns an empty list for %s",
    (rol) => {
      expect(rolesVisiblesPara(rol)).toEqual([]);
    },
  );
});

describe("viewing right matches module access", () => {
  it("roles with a non-empty visibility row equal rolesQueCreanUsuarios", () => {
    const canSee = rolesUsuario.filter(
      (rol) => rolesVisiblesPara(rol).length > 0,
    );
    expect([...canSee].sort()).toEqual([...rolesQueCreanUsuarios].sort());
  });
});

describe("canManageCatalog (CM-ACC-1: role matrix)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "allows %s",
    (rol) => {
      expect(canManageCatalog(rol)).toBe(true);
    },
  );

  it.each(["docente", "estudiante"] as const)("denies %s", (rol) => {
    expect(canManageCatalog(rol)).toBe(false);
  });

  it("is derived from canCreateUsers for every role, not a second list", () => {
    for (const rol of rolesUsuario) {
      expect(canManageCatalog(rol)).toBe(canCreateUsers(rol));
    }
  });

  it("denies a missing role", () => {
    expect(canManageCatalog(undefined)).toBe(false);
  });
});

describe("rolesQueGestionanCatalogo", () => {
  it("equals rolesUsuario filtered by canManageCatalog", () => {
    expect(rolesQueGestionanCatalogo).toEqual(
      rolesUsuario.filter(canManageCatalog),
    );
  });
});

describe("isCarreraScopedRole", () => {
  it.each(rolesUsuario)("%s", (rol) => {
    expect(isCarreraScopedRole(rol)).toBe(rol === "coordinacion");
  });

  it("is false for a missing role", () => {
    expect(isCarreraScopedRole(undefined)).toBe(false);
  });
});
