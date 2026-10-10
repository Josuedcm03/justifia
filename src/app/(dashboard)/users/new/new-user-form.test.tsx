import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewUserForm } from "@/app/(dashboard)/users/new/new-user-form";
import { rolesAsignablesPor } from "@/lib/auth/permissions";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/(dashboard)/users/new/actions", () => ({
  createStaffAction: vi.fn(),
}));

const ALL_ROLE_CODES = [
  "estudiante",
  "docente",
  "coordinacion",
  "secretaria",
  "administrador",
] as const;

async function openRoleSelect() {
  const user = userEvent.setup();
  // base-ui portals the popup content to document.body, so it must be opened
  // before its options can be queried.
  await user.click(screen.getByRole("combobox"));
  return user;
}

describe("NewUserForm role selector", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "offers exactly the assignable roles for %s",
    async (caller) => {
      const assignable = rolesAsignablesPor(caller);
      render(<NewUserForm carreras={[]} rolesAsignables={assignable} />);

      await openRoleSelect();

      const options = await screen.findAllByRole("option");
      const optionTexts = options.map((option) => option.textContent);
      expect(optionTexts).toEqual(assignable.map((rol) => `roles.${rol}`));
    },
  );

  it("never offers a non-assignable role to an administrador", async () => {
    render(
      <NewUserForm
        carreras={[]}
        rolesAsignables={rolesAsignablesPor("administrador")}
      />,
    );

    await openRoleSelect();

    const options = await screen.findAllByRole("option");
    const optionTexts = options.map((option) => option.textContent);
    for (const forbidden of ALL_ROLE_CODES) {
      if (forbidden === "coordinacion") continue;
      expect(optionTexts).not.toContain(`roles.${forbidden}`);
    }
  });
});
