import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RolUsuario } from "@/lib/validations/auth";

const { requireRoleMock, listCarrerasMock, newUserFormMock } = vi.hoisted(
  () => ({
    requireRoleMock: vi.fn(),
    listCarrerasMock: vi.fn(),
    // The unused param fixes the mock's inferred arity so a later
    // `toHaveBeenCalledWith(props)` assertion typechecks.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    newUserFormMock: vi.fn((_props: unknown) => null),
  }),
);

vi.mock("@/lib/auth/dal", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data/carreras", () => ({
  listCarreras: listCarrerasMock,
}));

vi.mock("@/app/(dashboard)/users/new/new-user-form", () => ({
  NewUserForm: (props: unknown) => {
    newUserFormMock(props);
    return null;
  },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import {
  rolesAsignablesPor,
  rolesQueCreanUsuarios,
} from "@/lib/auth/permissions";

function sessionFor(rol: RolUsuario) {
  return { sub: "1", login: "caller", rol, nombre: "Caller" };
}

describe("NewUserPage", () => {
  it("guards with exactly rolesQueCreanUsuarios and passes the caller's assignable roles to the form", async () => {
    const session = sessionFor("coordinacion");
    requireRoleMock.mockResolvedValue(session);
    listCarrerasMock.mockResolvedValue([]);

    const { default: NewUserPage } =
      await import("@/app/(dashboard)/users/new/page");
    render(await NewUserPage());

    expect(requireRoleMock).toHaveBeenCalledWith(...rolesQueCreanUsuarios);
    expect(newUserFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rolesAsignables: rolesAsignablesPor(session.rol),
      }),
    );
  });
});
