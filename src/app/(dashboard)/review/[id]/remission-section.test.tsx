import { screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

vi.mock("@/app/(dashboard)/review/[id]/remission-actions", () => ({
  resendRemissionAction: vi.fn(),
  attachSpecialFormatAction: vi.fn(),
}));

import { RemissionSection } from "@/app/(dashboard)/review/[id]/remission-section";
import type { RemissionView } from "@/lib/data/remision";

const en = messages.en.review.remission;
const es = messages.es.review.remission;

const CLASS = {
  asignaturaId: 1,
  codigo: "MAT-101",
  nombre: "Calculo",
  numeroGrupo: "2",
};

function view(overrides: Partial<RemissionView> = {}): RemissionView {
  return {
    id: 31,
    docenteNombre: "Pedro Ruiz",
    correo: "pedro@uam.edu.ni",
    clases: [CLASS],
    estado: "pendiente",
    motivoCodigo: null,
    enviadaEn: null,
    intentos: 0,
    ...overrides,
  };
}

function show(
  remissions: RemissionView[],
  unassigned: (typeof CLASS)[] = [],
  locale: "en" | "es" = "en",
  specialFormat?: ComponentProps<typeof RemissionSection>["specialFormat"],
) {
  return renderIntl(
    <RemissionSection
      remissions={remissions}
      unassigned={unassigned}
      specialFormat={specialFormat}
    />,
    locale,
  );
}

describe("RemissionSection: special format (RN-19)", () => {
  const upload = messages.en.review.remission.upload;

  it("offers the upload for a marked request without a format", () => {
    show([view()], [], "en", { solicitudId: 12, attached: null });

    expect(
      screen.getByRole("heading", { level: 3, name: upload.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: upload.action }),
    ).toBeInTheDocument();
  });

  it("shows the attached format by name instead of the control", () => {
    show([view()], [], "en", {
      solicitudId: 12,
      attached: { id: 30, nombreOriginal: "firmado.pdf" },
    });

    expect(screen.getByRole("link", { name: "firmado.pdf" })).toHaveAttribute(
      "href",
      "/api/intake/documents/30",
    );
    expect(
      screen.queryByRole("button", { name: upload.action }),
    ).not.toBeInTheDocument();
  });

  it("shows nothing about a format for an unmarked request", () => {
    show([view()]);

    expect(screen.queryByText(upload.title)).not.toBeInTheDocument();
  });
});

describe("RemissionSection (RF-09 c)", () => {
  it("shows each teacher with the snapshot email, the groups and the state as text", () => {
    show([
      view(),
      view({
        id: 32,
        docenteNombre: "Rosa Mena",
        correo: "rosa@uam.edu.ni",
        clases: [
          { ...CLASS, codigo: "FIS-200", nombre: "Fisica", numeroGrupo: "1" },
        ],
        estado: "enviada",
        enviadaEn: new Date("2026-10-19T03:30:00Z"),
      }),
    ]);

    expect(
      screen.getByRole("heading", { level: 2, name: en.title }),
    ).toBeInTheDocument();
    const items = ["Pedro Ruiz", "Rosa Mena"].map(
      (name) => screen.getByText(name).closest("li") as HTMLElement,
    );
    expect(within(items[0]).getByText("Pedro Ruiz")).toBeInTheDocument();
    expect(within(items[0]).getByText("pedro@uam.edu.ni")).toBeInTheDocument();
    expect(
      within(items[0]).getByText("MAT-101 · Calculo, group 2"),
    ).toBeInTheDocument();
    expect(within(items[0]).getByText(en.states.pendiente)).toBeInTheDocument();
    expect(within(items[1]).getByText("Rosa Mena")).toBeInTheDocument();
    expect(
      within(items[1]).getByText("FIS-200 · Fisica, group 1"),
    ).toBeInTheDocument();
    expect(within(items[1]).getByText(en.states.enviada)).toBeInTheDocument();
  });

  it("shows the send time in the business zone", () => {
    // 03:30 UTC on the 19th is still the 18th, 21:30 in Managua (UTC-6).
    show([
      view({ estado: "enviada", enviadaEn: new Date("2026-10-19T03:30:00Z") }),
    ]);

    expect(screen.getByText(/Oct 18, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/9:30\s?PM/)).toBeInTheDocument();
    expect(screen.queryByText(/Oct 19, 2026/)).not.toBeInTheDocument();
  });

  it("offers Reenviar only while the remission is not sent", () => {
    show([
      view({ id: 31 }),
      view({ id: 32, docenteNombre: "Rosa Mena", estado: "enviada" }),
      view({
        id: 33,
        docenteNombre: "Luis Mora",
        estado: "bloqueada",
        motivoCodigo: "sin_correo",
        correo: null,
      }),
    ]);

    expect(
      screen.getAllByRole("button", { name: /^Resend the notice to / }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Resend the notice to Pedro Ruiz" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resend the notice to Rosa Mena" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resend the notice to Luis Mora" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["bloqueada", "sin_correo"],
    ["bloqueada", "formato_especial_faltante"],
    ["bloqueada", "adjuntos_exceden_limite"],
    ["pendiente", "error_envio"],
  ] as const)(
    "explains a %s remission with reason %s in an alert, in both languages",
    (estado, motivoCodigo) => {
      const { unmount } = show([view({ estado, motivoCodigo })], [], "en");
      expect(screen.getByRole("alert")).toHaveTextContent(
        en.reasons[motivoCodigo],
      );
      unmount();

      show([view({ estado, motivoCodigo })], [], "es");
      expect(screen.getByRole("alert")).toHaveTextContent(
        es.reasons[motivoCodigo],
      );
    },
  );

  it("raises no alert for a pending remission with no failure", () => {
    show([view()]);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names the groups with no teacher identified", () => {
    show([view()], [{ ...CLASS, codigo: "FIS-200", nombre: "Fisica" }]);

    expect(
      screen.getByText(
        "No teacher is identified for: FIS-200 · Fisica, group 2. No notice is sent for those subjects.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a teacher email that is missing as not set", () => {
    show([view({ correo: null })]);

    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
