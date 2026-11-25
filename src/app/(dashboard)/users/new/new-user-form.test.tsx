import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewUserForm } from "@/app/(dashboard)/users/new/new-user-form";
import { rolesAsignablesPor } from "@/lib/auth/permissions";
import { messages } from "@/test/intl";

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

  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "has no facultad field for %s: the server derives it (SR-16)",
    (caller) => {
      const { container } = render(
        <NewUserForm
          carreras={[]}
          rolesAsignables={rolesAsignablesPor(caller)}
        />,
      );

      expect(container.querySelector("[name=facultadId]")).toBeNull();
    },
  );
});

// FE-27, FE-28: staff sign in with their email, so the form asks for it and
// never asks for a "Usuario". The admin screens speak "tú".
describe("NewUserForm email and no Usuario (FE-27, FE-28)", () => {
  it("has no Usuario field and no login input", () => {
    const { container } = render(
      <NewUserForm
        carreras={[]}
        rolesAsignables={rolesAsignablesPor("administrador")}
      />,
    );

    expect(container.querySelector("[name=login]")).toBeNull();
    expect(container.querySelector("#login")).toBeNull();
    expect(screen.queryByText("loginLabel")).toBeNull();
  });

  it("asks for a required institutional email, tied to its hint", () => {
    render(
      <NewUserForm
        carreras={[]}
        rolesAsignables={rolesAsignablesPor("secretaria")}
      />,
    );

    const email = screen.getByLabelText("emailLabel");
    expect(email).toHaveAttribute("name", "correo");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toBeRequired();
    const hint = screen.getByText("emailHint");
    expect(email.getAttribute("aria-describedby")).toContain(hint.id);
  });

  it("pins the Spanish lines of the new fields and errors (tú)", () => {
    const es = messages.es.users.new;

    expect(es.emailLabel).toBe("Correo institucional");
    expect(es.emailHint).toBe("Con este correo la persona ingresa al sistema.");
    expect(es.errors.duplicate).toBe("Ya existe una cuenta con ese correo.");
    expect(es.errors.emailTooLong).toBe(
      "El correo no puede superar los 60 caracteres.",
    );
    expect(es.errors.emailInvalid).toBe(
      "Ingresa un correo válido, de hasta 160 caracteres.",
    );
    expect(es).not.toHaveProperty("loginLabel");
  });

  it("pins the English lines of the new fields and errors", () => {
    const en = messages.en.users.new;

    expect(en.emailLabel).toBe("Institutional email");
    expect(en.emailHint).toBe("This person signs in with this email.");
    expect(en.errors.duplicate).toBe(
      "An account with that email already exists.",
    );
    expect(en.errors.emailTooLong).toBe(
      "The email cannot exceed 60 characters.",
    );
    expect(en.errors.emailInvalid).toBe(
      "Enter a valid email of up to 160 characters.",
    );
    expect(en).not.toHaveProperty("loginLabel");
  });

  // "Crear usuario" names the action of creating an account; what must not
  // exist is a field or a label that asks for a "Usuario" to type.
  it.each(["es", "en"] as const)(
    "has no key or label for a Usuario to type in the %s form copy",
    (l) => {
      for (const [key, value] of Object.entries(messages[l].users.new)) {
        expect(key.toLowerCase()).not.toContain("login");
        if (typeof value === "string") {
          expect(value).not.toMatch(/^(usuario|username)$/i);
        }
      }
    },
  );
});
