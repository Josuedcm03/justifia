import { describe, expect, it } from "vitest";

import {
  canAssignRole,
  canCreateUsers,
  rolesAsignablesPor,
  rolesQueCreanUsuarios,
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
