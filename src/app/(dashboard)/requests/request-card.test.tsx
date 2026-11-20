import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestCard } from "@/app/(dashboard)/requests/request-card";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";
import type { OwnRequestListItem } from "@/lib/data/student-requests";

// FE-14 and FE-15 (RF-07 c, RN-16, RN-17; RNF-01, RNF-11): the card of the
// student's list names the request, writes the absence dates with the month
// name, lists the subject codes and, for a returned or rejected request, shows
// the reason. An approved card shows none (owner decision 2026-11-20).

function item(overrides: Partial<OwnRequestListItem> = {}): OwnRequestListItem {
  return {
    id: 12,
    estado: "pendiente",
    causa: "medica",
    fechaInicio: "2026-10-29",
    fechaFin: "2026-10-30",
    presentadaEn: new Date("2026-10-31T15:00:00Z"),
    reenviadaEn: null,
    asignaturas: [{ codigo: "MAT101", nombre: "Matematica I" }],
    decision: null,
    ...overrides,
  };
}

function show(request: OwnRequestListItem, locale: "en" | "es" = "en") {
  return renderIntl(
    <ul>
      <RequestCard request={request} />
    </ul>,
    locale,
  );
}

const en = messages.en.requests;
const codes = (...list: string[]) =>
  list.map((codigo) => ({ codigo, nombre: `Nombre ${codigo}` }));

describe("RequestCard identifies the request (FE-14)", () => {
  it("shows the number, the state as text and the presentation date", () => {
    show(item({ estado: "devuelta" }));

    const card = screen.getByRole("listitem");
    expect(card).toHaveTextContent("Request 12");
    expect(card).toHaveTextContent(en.states.devuelta);
    expect(card).toHaveTextContent("Presented Oct 31, 2026");
  });

  it("writes the absence range under its label with the month name", () => {
    show(item());

    const line = screen.getByText(/^Absence dates:/);
    expect(line).toHaveTextContent(
      "Absence dates: Oct 29, 2026 to Oct 30, 2026",
    );
    expect(line.textContent).not.toMatch(/\d{1,2}[/-]\d{1,2}/);
  });

  it("writes a one-day absence as a single date", () => {
    show(item({ fechaInicio: "2026-11-01", fechaFin: "2026-11-01" }));

    const line = screen.getByText(/^Absence dates:/);
    expect(line).toHaveTextContent("Absence dates: Nov 1, 2026");
    expect(line.textContent).not.toContain(" to ");
  });

  it("writes the absence dates in Spanish with the month name", () => {
    show(item({ fechaInicio: "2026-11-01", fechaFin: "2026-11-03" }), "es");

    expect(screen.getByText(/^Fechas de ausencia:/)).toHaveTextContent(
      "Fechas de ausencia: 1 nov 2026 al 3 nov 2026",
    );
  });

  it("shows no absence line when the dates are missing", () => {
    show(item({ fechaInicio: null, fechaFin: null }));

    expect(screen.queryByText(/^Absence dates:/)).toBeNull();
  });

  it.each([
    [["MAT101"], "Subjects: MAT101"],
    [["MAT101", "FIS201", "QUI110"], "Subjects: MAT101, FIS201, QUI110"],
    [
      ["MAT101", "FIS201", "QUI110", "BIO100", "ZOO300"],
      "Subjects: MAT101, FIS201, QUI110 and 2 more",
    ],
    [["A1", "A2", "A3", "A4"], "Subjects: A1, A2, A3 and 1 more"],
  ])("lists the first three subject codes: %j", (list, expected) => {
    show(item({ asignaturas: codes(...list) }));

    expect(screen.getByText(/^Subjects:/)).toHaveTextContent(expected);
  });

  it("lists the subjects in Spanish", () => {
    show(item({ asignaturas: codes("A1", "A2", "A3", "A4", "A5") }), "es");

    expect(screen.getByText(/^Asignaturas:/)).toHaveTextContent(
      "Asignaturas: A1, A2, A3 y 2 más",
    );
  });

  it("shows no subject line for a request without subjects", () => {
    show(item({ asignaturas: [] }));

    expect(screen.queryByText(/^Subjects:/)).toBeNull();
  });

  it("keeps the neutral label for a request in coordination", () => {
    show(item({ estado: "en_revision_coordinacion" }));

    expect(screen.getByRole("listitem")).toHaveTextContent(
      en.states.en_revision_coordinacion,
    );
  });
});

describe("RequestCard reason line (FE-15, RN-17)", () => {
  const LONG = `${"x".repeat(140)}…`;

  it.each([
    [
      "a returned request with its RN-17 code",
      "devuelta",
      { motivoCodigo: "documento_ilegible", texto: "Adjunte una copia." },
      "Reason: The document is not legible",
    ],
    [
      "a returned request with a code and the date label",
      "devuelta",
      { motivoCodigo: "fecha_incorrecta", texto: null },
      "Reason: The date does not match the document",
    ],
    [
      "a returned request without a known code",
      "devuelta",
      { motivoCodigo: null, texto: "Falta el sello." },
      "Reason: Falta el sello.",
    ],
    [
      "a rejected request with a short text",
      "rechazada",
      { motivoCodigo: null, texto: "No corresponde al periodo." },
      "Reason: No corresponde al periodo.",
    ],
    [
      "a rejected request with a cut excerpt",
      "rechazada",
      { motivoCodigo: null, texto: LONG },
      `Reason: ${LONG}`,
    ],
  ] as const)("shows the reason of %s", (_name, estado, decision, expected) => {
    show(item({ estado, decision }));

    expect(screen.getByText(/^Reason:/)).toHaveTextContent(expected);
  });

  it("clamps the reason to 2 lines and lets it wrap", () => {
    show(
      item({
        estado: "rechazada",
        decision: { motivoCodigo: null, texto: LONG },
      }),
    );

    expect(screen.getByText(/^Reason:/)).toHaveClass(
      "line-clamp-2",
      "break-words",
    );
  });

  it("writes the reason in Spanish", () => {
    show(
      item({
        estado: "devuelta",
        decision: { motivoCodigo: "documento_ilegible", texto: null },
      }),
      "es",
    );

    expect(screen.getByText(/^Motivo:/)).toHaveTextContent(
      "Motivo: El documento no es legible",
    );
  });

  it.each([
    [
      "a returned request with neither code nor text",
      "devuelta",
      { motivoCodigo: null, texto: null },
    ],
    ["a rejected request without a decision", "rechazada", null],
    [
      "a pending request, even one resubmitted after a return",
      "pendiente",
      { motivoCodigo: "fecha_alterada", texto: "Texto anterior" },
    ],
    [
      "a request in coordination",
      "en_revision_coordinacion",
      { motivoCodigo: "fecha_alterada", texto: "Texto anterior" },
    ],
  ] as const)("shows no reason line for %s", (_name, estado, decision) => {
    show(item({ estado, decision }));

    expect(screen.queryByText(/^Reason:/)).toBeNull();
    expect(screen.getByRole("listitem")).not.toHaveTextContent(
      "Texto anterior",
    );
  });

  // Owner decision 2026-11-20: approval text is template boilerplate.
  it.each([
    [
      "with a text",
      { motivoCodigo: null, texto: "Su solicitud fue aprobada." },
    ],
    ["with a long text", { motivoCodigo: null, texto: LONG }],
    ["without a decision", null],
  ])(
    "shows no reason and no excerpt on an approved card %s",
    (_name, decision) => {
      show(item({ estado: "aprobada", decision }));

      const card = screen.getByRole("listitem");
      expect(screen.queryByText(/^Reason:/)).toBeNull();
      expect(card).not.toHaveTextContent("Su solicitud fue aprobada.");
      expect(card).not.toHaveTextContent("xxxx");
      expect(card).toHaveTextContent(en.states.aprobada);
    },
  );
});

describe("RequestCard carries nothing but the student's own data (FE-14)", () => {
  const REVEALING =
    /signal|outcome|verdict|suggestion|escalat|motive|SECRET|repeated document|fingerprint/i;

  it("renders no signal, outcome, verdict, motive, note or answer even when the props carry them", () => {
    const hostile = {
      ...item({ estado: "devuelta" }),
      signals: [{ signal: "rn07", outcome: "present" }],
      verdict: "review_carefully",
      escalamientos: [
        {
          motivo: "caso_especial",
          nota: "SECRET NOTE",
          respuesta: "SECRET ANSWER",
        },
      ],
    } as OwnRequestListItem;

    for (const locale of ["en", "es"] as const) {
      const { container, unmount } = show(hostile, locale);

      expect(container.textContent).not.toMatch(REVEALING);
      expect(container.innerHTML).not.toContain("rn07");
      unmount();
    }
  });

  it("links to the detail of its own request", () => {
    show(item({ id: 31 }));

    expect(
      within(screen.getByRole("listitem")).getByRole("link", {
        name: "View request 31",
      }),
    ).toHaveAttribute("href", "/requests/31");
  });
});

describe("RequestCard at 360 px (RNF-11)", () => {
  const VIEWPORT = 360;

  function fixedWidths(root: ParentNode): number[] {
    return [...root.querySelectorAll("[class]")].flatMap((element) =>
      element.className
        .toString()
        .split(/\s+/)
        .flatMap((token) => {
          const px = /^(?:min-)?w-\[(\d+)px\]$/.exec(token);
          return px ? [Number(px[1])] : [];
        }),
    );
  }

  it("lets five long subject codes and a long reason wrap instead of widening the page", () => {
    const long = Array.from(
      { length: 5 },
      (_, i) => `ASIGNATURA-CON-CODIGO-MUY-LARGO-${i}`,
    );
    const { container } = show(
      item({
        estado: "rechazada",
        asignaturas: codes(...long),
        decision: { motivoCodigo: null, texto: "y".repeat(140) },
      }),
    );

    expect(screen.getByText(/^Subjects:/)).toHaveClass("break-words");
    expect(screen.getByText(/^Absence dates:/)).toHaveClass("break-words");
    expect(screen.getByText(/^Reason:/)).toHaveClass("break-words");
    expect(fixedWidths(container).filter((px) => px > VIEWPORT)).toEqual([]);
  });
});
