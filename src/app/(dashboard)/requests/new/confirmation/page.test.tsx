import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rolesSolicitantes } from "@/lib/auth/permissions";

import esMessages from "../../../../../../i18n/es.json";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));

vi.mock("@/lib/auth/dal", () => ({ requireRole }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: "es",
      messages: esMessages,
      namespace: namespace as "intake",
    }),
}));

import ConfirmationPage from "@/app/(dashboard)/requests/new/confirmation/page";

beforeEach(() => {
  requireRole.mockReset();
  requireRole.mockResolvedValue({ sub: "7", rol: "estudiante" });
});

describe("ConfirmationPage (where submitRequestAction redirects)", () => {
  it("is guarded for the students only", async () => {
    await ConfirmationPage();
    expect(requireRole).toHaveBeenCalledWith(...rolesSolicitantes);
  });

  it("confirms the submission and links to the dashboard and a new request", async () => {
    render(await ConfirmationPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Solicitud presentada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hemos registrado tu solicitud de justificación/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al panel" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("link", { name: "Presentar otra solicitud" }),
    ).toHaveAttribute("href", "/requests/new");
  });

  it("reads nothing when the role guard redirects", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(ConfirmationPage()).rejects.toThrow("NEXT_REDIRECT");
  });
});
