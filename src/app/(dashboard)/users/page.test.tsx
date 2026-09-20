import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RolUsuario } from "@/lib/validations/auth";

const { requireRoleMock, listUsuariosMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  listUsuariosMock: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data/users", () => ({
  listUsuarios: listUsuariosMock,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getFormatter: async () => ({ dateTime: () => "" }),
}));

import { rolesQueCreanUsuarios } from "@/lib/auth/permissions";

function sessionFor(rol: RolUsuario) {
  return { sub: "1", login: "caller", rol, nombre: "Caller" };
}

describe("UsersPage", () => {
  it("guards with exactly rolesQueCreanUsuarios", async () => {
    requireRoleMock.mockResolvedValue(sessionFor("secretaria"));
    listUsuariosMock.mockResolvedValue({ data: [], degraded: false });

    const { default: UsersPage } = await import("@/app/(dashboard)/users/page");
    render(await UsersPage());

    expect(requireRoleMock).toHaveBeenCalledWith(...rolesQueCreanUsuarios);
  });
});
