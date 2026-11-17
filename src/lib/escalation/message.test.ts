import { describe, expect, it } from "vitest";

import {
  REASON_LABELS,
  buildEscalationMessage,
  type EscalationMessageInput,
} from "./message";

function input(
  overrides: Partial<EscalationMessageInput> = {},
): EscalationMessageInput {
  return {
    to: "coord1@uam.edu.ni",
    cc: [],
    solicitudId: 42,
    escalamientoId: 7,
    tipo: "sospecha_documento",
    estudianteNombre: "Carlos Ruiz",
    estudianteCif: "2021-0042",
    carreraNombre: "Ingeniería de Sistemas",
    nota: "La firma del médico no coincide con el sello.",
    baseUrl: "https://justifia.example.edu",
    ...overrides,
  };
}

describe("buildEscalationMessage (ES-10, E6)", () => {
  it("is addressed to the first recipient with the rest in copy", () => {
    const message = buildEscalationMessage(
      input({ cc: ["coord2@uam.edu.ni", "coord3@uam.edu.ni"] }),
    );
    expect(message.to).toBe("coord1@uam.edu.ni");
    expect(message.cc).toEqual(["coord2@uam.edu.ni", "coord3@uam.edu.ni"]);
  });

  it("holds the request number, the student, the career, the reason and the note", () => {
    const { text } = buildEscalationMessage(input());
    expect(text).toContain("Solicitud: 42");
    expect(text).toContain("Estudiante: Carlos Ruiz (CIF 2021-0042)");
    expect(text).toContain("Carrera: Ingeniería de Sistemas");
    expect(text).toContain("Motivo: Sospecha sobre un documento");
    expect(text).toContain(
      "Nota: La firma del médico no coincide con el sello.",
    );
  });

  it("names the excess-absence reason and carries the report note when given", () => {
    const { text } = buildEscalationMessage(
      input({ tipo: "exceso_inasistencias", nota: "Supera el límite." }),
    );
    expect(text).toContain("Motivo: Exceso de inasistencias");
    expect(text).toContain("Nota: Supera el límite.");
  });

  it("leaves the note line out when there is no note", () => {
    const { text } = buildEscalationMessage(
      input({ tipo: "exceso_inasistencias", nota: null }),
    );
    expect(text).not.toContain("Nota:");
    expect(text).toContain("Motivo: Exceso de inasistencias");
  });

  it("links to the escalation page with no token and tolerates a trailing slash", () => {
    const plain = buildEscalationMessage(input());
    const slash = buildEscalationMessage(
      input({ baseUrl: "https://justifia.example.edu/" }),
    );
    expect(plain.text).toContain("https://justifia.example.edu/coordination/7");
    expect(slash.text).toContain("https://justifia.example.edu/coordination/7");
    expect(slash.text).not.toContain("//coordination");
    expect(plain.text).not.toMatch(/[?&#]/);
  });

  it("subject names the request number only, one subject per kind", () => {
    const sospecha = buildEscalationMessage(input()).subject;
    const exceso = buildEscalationMessage(
      input({ tipo: "exceso_inasistencias" }),
    ).subject;
    expect(sospecha).toBe("Justifia: solicitud 42 escalada a coordinación");
    expect(exceso).toBe("Justifia: aviso sobre la solicitud 42");
    expect(sospecha).not.toContain("Carlos");
  });

  it("collapses line breaks and control characters in names and notes", () => {
    const { text } = buildEscalationMessage(
      input({
        estudianteNombre: "Carlos\nRuiz",
        nota: "Primera línea.\r\n\u0007Segunda línea.",
      }),
    );
    expect(text).toContain("Estudiante: Carlos Ruiz (CIF 2021-0042)");
    expect(text).toContain("Nota: Primera línea. Segunda línea.");
  });

  it("has no attachment, cause, date, teacher, document or answer wording", () => {
    const { text, subject } = buildEscalationMessage(input());
    const all = `${subject}\n${text}`.toLowerCase();
    for (const word of [
      "causa",
      "fecha",
      "docente",
      "profesor",
      "documento:",
      "adjunt",
      "respuesta",
      "token",
    ]) {
      expect(all).not.toContain(word);
    }
  });

  it("greets the coordination without a time of day and signs as the secretary", () => {
    const { text } = buildEscalationMessage(input());
    const lines = text.split("\n");
    expect(lines[0]).toBe("Estimada coordinación:");
    expect(lines.slice(-2)).toEqual(["Atentamente,", "Secretaría Académica"]);
    expect(text.toLowerCase()).not.toMatch(/buenos días|buenas tardes/);
  });

  it("labels every reason in Spanish", () => {
    expect(REASON_LABELS).toEqual({
      sospecha_documento: "Sospecha sobre un documento",
      caso_especial: "Caso especial",
      exceso_inasistencias: "Exceso de inasistencias",
    });
  });

  it("names a special case in the reason line and keeps the escalation subject (E18)", () => {
    const message = buildEscalationMessage(
      input({ tipo: "caso_especial", nota: "Fallecimiento de un familiar." }),
    );
    expect(message.text).toContain("Motivo: Caso especial");
    expect(message.text).toContain("Nota: Fallecimiento de un familiar.");
    expect(message.subject).toBe(
      "Justifia: solicitud 42 escalada a coordinación",
    );
  });

  it("keeps the whole plain-text part as it was before the HTML part existed", () => {
    expect(buildEscalationMessage(input()).text).toBe(
      [
        "Estimada coordinación:",
        "",
        "La secretaría escaló a coordinación una solicitud de justificación para su revisión.",
        "",
        "Solicitud: 42",
        "Estudiante: Carlos Ruiz (CIF 2021-0042)",
        "Carrera: Ingeniería de Sistemas",
        "Motivo: Sospecha sobre un documento",
        "Nota: La firma del médico no coincide con el sello.",
        "",
        "Para consultarla, inicie sesión en el sistema y abra: https://justifia.example.edu/coordination/7",
        "",
        "Atentamente,",
        "Secretaría Académica",
      ].join("\n"),
    );
  });
});

describe("buildEscalationMessage HTML part (E6, E18)", () => {
  const LINK = "https://justifia.example.edu/coordination/7";
  const html = (overrides: Partial<EscalationMessageInput> = {}) =>
    buildEscalationMessage(input(overrides)).html;

  it("is a complete, email-safe Spanish document: tables, inline styles, 600 px", () => {
    const doc = html();
    expect(doc.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(doc).toContain('<html lang="es"');
    expect(doc).toContain('<meta charset="utf-8"');
    expect(doc).toContain('role="presentation"');
    expect(doc).toContain("max-width:600px");
    expect(doc).toContain('width="600"');
    expect(doc).toMatch(/font-family:[^;"]*Arial/);
    expect(doc).not.toMatch(/<style|<link|<script|<iframe|<form|<video/i);
    expect(doc).not.toMatch(/\sclass=/);
  });

  it("holds the title bar, the greeting and the introduction", () => {
    const doc = html();
    expect(doc).toContain("Solicitud escalada a coordinación");
    expect(doc).toContain("Estimada coordinación:");
    expect(doc).toContain(
      "La secretaría escaló a coordinación una solicitud de justificación para su revisión.",
    );
  });

  it("shows request, student with CIF, career, reason and note in a summary table", () => {
    const doc = html();
    for (const [label, value] of [
      ["Solicitud", "42"],
      ["Estudiante", "Carlos Ruiz (CIF 2021-0042)"],
      ["Carrera", "Ingeniería de Sistemas"],
      ["Motivo", "Sospecha sobre un documento"],
      ["Nota", "La firma del médico no coincide con el sello."],
    ]) {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(doc).toMatch(
        new RegExp(`>${label}</td>\\s*<td[^>]*>${escaped}</td>`),
      );
    }
  });

  it("shows the special-case reason and leaves the note row out when there is no note", () => {
    const doc = html({ tipo: "caso_especial", nota: null });
    expect(doc).toContain(">Caso especial</td>");
    expect(doc).not.toContain(">Nota</td>");
  });

  it("escapes every value that comes from data", () => {
    const doc = html({
      estudianteNombre: 'Ana <script>alert("x")</script> & Cía',
      estudianteCif: "<b>2021</b>",
      carreraNombre: "Ingeniería <i>&</i> Arquitectura",
      nota: "Ver <img src=x onerror=alert(1)> y 'comillas' & \"dobles\"",
    });
    expect(doc).not.toContain("<script");
    expect(doc).not.toContain("<img src=x");
    expect(doc).not.toContain("<b>2021");
    expect(doc).not.toContain("<i>&</i>");
    expect(doc).toContain(
      "Ana &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Cía",
    );
    expect(doc).toContain("&lt;b&gt;2021&lt;/b&gt;");
    expect(doc).toContain("Ingeniería &lt;i&gt;&amp;&lt;/i&gt; Arquitectura");
    expect(doc).toContain(
      "Ver &lt;img src=x onerror=alert(1)&gt; y &#39;comillas&#39; &amp; &quot;dobles&quot;",
    );
  });

  it("collapses line breaks in names and notes, as the text part does", () => {
    const doc = html({ nota: "Primera línea.\r\n\u0007Segunda línea." });
    expect(doc).toContain("Primera línea. Segunda línea.");
  });

  it("has a button to the coordinator page and the same link as plain text below it", () => {
    const { text, html: doc } = buildEscalationMessage(input());
    expect(text).toContain(LINK);
    const hrefs = [...doc.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([LINK, LINK]);
    expect(doc).toMatch(/<a [^>]*href="[^"]+"[^>]*>Revisar solicitud<\/a>/);
    expect(doc).toContain(`>${LINK}</a>`);
  });

  it("tolerates a trailing slash in the base URL for the link in both parts", () => {
    const { html: doc } = buildEscalationMessage(
      input({ baseUrl: "https://justifia.example.edu/" }),
    );
    expect([...doc.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual([
      LINK,
      LINK,
    ]);
  });

  it("references the brand image by content id and attaches it inline", () => {
    const message = buildEscalationMessage(input());
    expect(message.html).toContain('src="cid:uam-fia-logo"');
    expect(message.html).toMatch(
      /<img [^>]*alt="Universidad Americana \(UAM\)[^"]*Facultad de Ingeniería y Arquitectura"/,
    );
    expect(message.attachments).toHaveLength(1);
    const [logo] = message.attachments;
    expect(logo.contentId).toBe("uam-fia-logo");
    expect(logo.contentType).toBe("image/png");
    expect(logo.filename).toBe("uam-fia-logo.png");
    // PNG signature.
    expect([...logo.content.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("loads nothing from the network: no remote image, script or tracking pixel", () => {
    const doc = html();
    expect(doc).not.toMatch(/src="(?!cid:)/);
    expect(doc).not.toMatch(/url\(/);
    expect(doc).not.toMatch(/<img[^>]*(width|height)="1"/);
  });

  it("ends with the institutional footer and the automatic-notice line", () => {
    const doc = html();
    expect(doc).toContain(
      "Secretaría Académica · Facultad de Ingeniería y Arquitectura · Universidad Americana (UAM)",
    );
    expect(doc).toContain(
      "Este es un aviso automático de Justifia; no responda a este correo.",
    );
    expect(doc.indexOf("Secretaría Académica")).toBeGreaterThan(
      doc.indexOf("Revisar solicitud"),
    );
  });

  it("gives the excess-absence notice its own title and a notice button, not an answer prompt", () => {
    const doc = html({ tipo: "exceso_inasistencias", nota: null });
    expect(doc).toContain("Aviso de exceso de inasistencias");
    expect(doc).not.toContain("Solicitud escalada a coordinación");
    expect(doc).toMatch(/<a [^>]*>Ver aviso<\/a>/);
    expect(doc).not.toContain("Revisar solicitud");
    expect(doc).toContain(
      "La secretaría registró un aviso informativo sobre una solicitud de justificación aprobada.",
    );
  });

  it("carries no cause, date, teacher, document, health data or answer wording", () => {
    const text = html()
      .replace(/<[^>]*>/g, " ")
      .toLowerCase();
    for (const word of [
      "causa",
      "fecha",
      "docente",
      "profesor",
      "documento:",
      "adjunt",
      "respuesta",
      "token",
    ]) {
      expect(text).not.toContain(word);
    }
  });

  it("leaves the subject as it was for every kind", () => {
    expect(buildEscalationMessage(input()).subject).toBe(
      "Justifia: solicitud 42 escalada a coordinación",
    );
    expect(
      buildEscalationMessage(input({ tipo: "exceso_inasistencias" })).subject,
    ).toBe("Justifia: aviso sobre la solicitud 42");
  });
});
