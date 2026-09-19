import { describe, expect, it } from "vitest";

import {
  canManageUsers,
  rolesQueGestionanUsuarios,
} from "@/lib/auth/permissions";
import { rolesUsuario } from "@/lib/validations/auth";

describe("canManageUsers", () => {
  it.each(["secretaria", "administrador",] as const)(
    "allows %s",
    (rol) => {
      expect(canManageUsers(rol)).toBe(true);
    },
  );

  it("denies estudiante", () => {
    expect(canManageUsers("estudiante")).toBe(false);
  });

  it("denies a missing role", () => {
    expect(canManageUsers(undefined)).toBe(false);
  });

  it("covers every role except estudiante", () => {
    expect([...rolesQueGestionanUsuarios].sort()).toEqual(
      rolesUsuario.filter((r) => r !== "estudiante").sort(),
    );
  });
});
