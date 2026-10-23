import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EscalationSection } from "@/app/(dashboard)/review/[id]/escalation-section";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";
import type { DetailEscalation } from "@/lib/data/solicitud-detail";

const en = messages.en.review.escalation;

function escalation(
  overrides: Partial<DetailEscalation> = {},
): DetailEscalation {
  return {
    id: 61,
    motivo: "sospecha_documento",
    nota: "El sello parece alterado.",
    autorNombre: "Rosa Lopez",
    // 09:00 on 8 October 2026 in America/Managua.
    creadoEn: new Date("2026-10-08T15:00:00Z"),
    respuesta: null,
    respondidaPorNombre: null,
    respondidaEn: null,
    notificacionEstado: "pendiente",
    notificacionMotivo: null,
    enviadaEn: null,
    ...overrides,
  };
}

function show(escalations: DetailEscalation[], locale: "en" | "es" = "en") {
  return renderIntl(<EscalationSection escalations={escalations} />, locale);
}

describe("EscalationSection history (RF-10, RN-16)", () => {
  it("lists the reason label, note, author and time of an open escalation", () => {
    show([escalation()]);

    const region = screen.getByRole("region", { name: en.section.title });
    expect(region).toHaveTextContent(en.reasons.sospecha_documento);
    expect(region).toHaveTextContent("El sello parece alterado.");
    expect(region).toHaveTextContent("Rosa Lopez, Oct 8, 2026");
  });

  it("says an open escalation is waiting for the coordination and offers no control", () => {
    show([escalation()]);

    expect(screen.getByText(en.section.waiting)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("lists the answer, the answering user and the time of an answered escalation", () => {
    show([
      escalation({
        respuesta: "El documento es autentico.",
        respondidaPorNombre: "Marta Gomez",
        respondidaEn: new Date("2026-10-09T21:00:00Z"),
      }),
    ]);

    const region = screen.getByRole("region", { name: en.section.title });
    expect(region).toHaveTextContent(en.section.fields.answer);
    expect(region).toHaveTextContent("El documento es autentico.");
    expect(region).toHaveTextContent("Marta Gomez, Oct 9, 2026");
    expect(screen.queryByText(en.section.waiting)).toBeNull();
  });

  it("keeps the earlier answered escalation next to a new open one, in the order given", () => {
    show([
      escalation({
        id: 61,
        nota: "Primera sospecha",
        respuesta: "Primera respuesta",
        respondidaPorNombre: "Marta Gomez",
        respondidaEn: new Date("2026-10-09T21:00:00Z"),
      }),
      escalation({ id: 62, nota: "Segunda sospecha" }),
    ]);

    const items = within(
      screen.getByRole("list", { name: en.section.title }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Primera sospecha");
    expect(items[0]).toHaveTextContent("Primera respuesta");
    expect(items[1]).toHaveTextContent("Segunda sospecha");
    expect(items[1]).toHaveTextContent(en.section.waiting);
  });

  it("renders nothing for a request without escalations", () => {
    const { container } = show([]);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("EscalationSection notification status (RNF-07): text, never colour alone", () => {
  it.each([
    ["pendiente", null, null, en.notification.pendiente],
    ["pendiente", "error_envio", null, en.notification.pendienteFallido],
    ["enviada", null, new Date("2026-10-08T15:05:00Z"), "Sent on Oct 8, 2026"],
    ["bloqueada", "sin_destinatarios", null, en.notification.bloqueada],
  ] as const)(
    "shows the %s notification with reason %s as the text %s",
    (notificacionEstado, notificacionMotivo, enviadaEn, text) => {
      show([escalation({ notificacionEstado, notificacionMotivo, enviadaEn })]);

      const region = screen.getByRole("region", { name: en.section.title });
      expect(within(region).getByText(text)).toBeInTheDocument();
    },
  );

  it("shows exactly one status text per escalation", () => {
    show([
      escalation({ id: 61 }),
      escalation({
        id: 62,
        notificacionEstado: "bloqueada",
        notificacionMotivo: "sin_destinatarios",
      }),
    ]);

    expect(screen.getAllByText(en.notification.pendiente)).toHaveLength(1);
    expect(screen.getAllByText(en.notification.bloqueada)).toHaveLength(1);
  });
});

describe("EscalationSection layout and language", () => {
  it("wraps a long note instead of widening the page at 360px", () => {
    const note = "x".repeat(300);
    show([escalation({ nota: note })]);

    expect(screen.getByText(note)).toHaveClass(
      "break-words",
      "whitespace-pre-wrap",
    );
  });

  it("renders in Spanish with the Spanish catalog", () => {
    show([escalation()], "es");

    const region = screen.getByRole("region", {
      name: messages.es.review.escalation.section.title,
    });
    expect(region).toHaveTextContent(
      messages.es.review.escalation.reasons.sospecha_documento,
    );
    expect(region).toHaveTextContent(
      messages.es.review.escalation.section.waiting,
    );
  });
});
