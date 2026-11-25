import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AnswerBanner,
  latestAnswer,
} from "@/app/(dashboard)/review/[id]/answer-banner";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

// FE-3 (request-review), RF-16 c, RF-10 a: the answer of the coordination sits
// above every other section of the staff detail. `latestAnswer` is the pure
// rule of which answer that is; the banner is text only and offers no action.

const en = messages.en.review.detail.answerBanner;
const es = messages.es.review.detail.answerBanner;

type EscalationRecord = {
  motivo: string;
  respuesta: string | null;
  respondidaPorNombre: string | null;
  respondidaEn: Date | null;
};

const OPEN: EscalationRecord = {
  motivo: "sospecha_documento",
  respuesta: null,
  respondidaPorNombre: null,
  respondidaEn: null,
};

function answered(overrides: Partial<EscalationRecord> = {}): EscalationRecord {
  return {
    ...OPEN,
    respuesta: "Verified with the teacher; the document is valid.",
    respondidaPorNombre: "Marta Gomez",
    // 15:00 on 9 October 2026 in America/Managua.
    respondidaEn: new Date("2026-10-09T21:00:00Z"),
    ...overrides,
  };
}

describe("latestAnswer (FE-3)", () => {
  it("gives null for a request that was never escalated", () => {
    expect(latestAnswer([])).toBeNull();
  });

  it("gives null when every escalation record is still unanswered", () => {
    expect(
      latestAnswer([OPEN, { ...OPEN, motivo: "caso_especial" }]),
    ).toBeNull();
  });

  it("gives null for half an answer: a time without a text, or a text without a time", () => {
    expect(latestAnswer([answered({ respuesta: null })])).toBeNull();
    expect(latestAnswer([answered({ respondidaEn: null })])).toBeNull();
  });

  it("gives the text, the author and the instant of an answered escalation", () => {
    expect(latestAnswer([answered()])).toEqual({
      text: "Verified with the teacher; the document is valid.",
      authorName: "Marta Gomez",
      answeredAt: new Date("2026-10-09T21:00:00Z"),
    });
  });

  it("gives the later one when two escalations were answered", () => {
    const earlier = answered({
      respuesta: "First answer.",
      respondidaPorNombre: "Marta Gomez",
      respondidaEn: new Date("2026-10-09T21:00:00Z"),
    });
    const later = answered({
      respuesta: "Second answer.",
      respondidaPorNombre: "Pablo Cruz",
      respondidaEn: new Date("2026-10-12T16:30:00Z"),
    });

    expect(latestAnswer([earlier, later])?.text).toBe("Second answer.");
    expect(latestAnswer([earlier, later])?.authorName).toBe("Pablo Cruz");
  });

  it("skips an unanswered record after an answered one and keeps the answered one", () => {
    expect(
      latestAnswer([answered({ respuesta: "Only answer." }), OPEN])?.text,
    ).toBe("Only answer.");
  });

  it("never takes a notice as the answer, even an answered one (exceso_inasistencias)", () => {
    expect(
      latestAnswer([answered({ motivo: "exceso_inasistencias" })]),
    ).toBeNull();
    expect(
      latestAnswer([
        answered({ respuesta: "Real answer." }),
        answered({ motivo: "exceso_inasistencias", respuesta: "Notice." }),
      ])?.text,
    ).toBe("Real answer.");
  });
});

describe("AnswerBanner (FE-3)", () => {
  const answer = {
    text: "Verified with the teacher; the document is valid.",
    authorName: "Marta Gomez",
    answeredAt: new Date("2026-10-09T21:00:00Z"),
  };

  it("is a region labelled with the text of the answer label, in English", () => {
    renderIntl(<AnswerBanner answer={answer} />);

    const banner = screen.getByRole("region", { name: en.title });
    expect(en.title).toBe("Coordination answer");
    expect(
      screen.getByRole("heading", { level: 2, name: en.title }),
    ).toBeInTheDocument();
    expect(banner).toHaveTextContent(answer.text);
  });

  it("shows the author and the date and time in America/Managua", () => {
    renderIntl(<AnswerBanner answer={answer} />);

    expect(screen.getByRole("region", { name: en.title })).toHaveTextContent(
      "Marta Gomez, Oct 9, 2026, 3:00 PM",
    );
  });

  it("converts an instant that is already the next day in UTC to Managua time", () => {
    renderIntl(
      <AnswerBanner
        answer={{ ...answer, answeredAt: new Date("2026-10-10T03:30:00Z") }}
      />,
    );

    expect(screen.getByRole("region", { name: en.title })).toHaveTextContent(
      "Marta Gomez, Oct 9, 2026, 9:30 PM",
    );
  });

  it("speaks Spanish with the label of the requirement", () => {
    renderIntl(<AnswerBanner answer={answer} />, "es");

    const banner = screen.getByRole("region", {
      name: "Respuesta de coordinación",
    });
    expect(banner).toHaveTextContent("Marta Gomez, 9 oct 2026, 15:00");
    expect(banner).toHaveTextContent(es.hint);
  });

  it("shows an answer of exactly 1000 characters in full", () => {
    const long = `${"a".repeat(499)} ${"b".repeat(500)}`;
    expect(long).toHaveLength(1000);

    renderIntl(<AnswerBanner answer={{ ...answer, text: long }} />);

    const text = screen.getByText(long);
    expect(text.textContent).toHaveLength(1000);
    expect(text).toHaveClass("break-words", "whitespace-pre-wrap");
  });

  it("links to the escalations section of the same page", () => {
    renderIntl(<AnswerBanner answer={answer} />);

    const link = screen.getByRole("link", { name: en.link });
    expect(link).toHaveAttribute("href", "#escalation-title");
  });

  it("offers no action: no button and no form control", () => {
    const { container } = renderIntl(<AnswerBanner answer={answer} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("form, button, input, textarea")).toBeNull();
  });
});

// FE-3 "Not for other viewers", RNF-01: the answer text stays on the staff
// detail. A structural pin, because a banner imported by a student, queue or
// coordination file would leak the answer to a viewer that must not see it.
describe("AnswerBanner reach (FE-3, RNF-01)", () => {
  const ROOT = process.cwd();

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    });
  }

  it("is imported by the staff detail page and by no other module", () => {
    const importers = sourceFiles(join(ROOT, "src"))
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => !/\.test\.(ts|tsx)$/.test(path))
      .filter((path) => !path.endsWith("answer-banner.tsx"))
      .filter((path) => /\/answer-banner["']/.test(readFileSync(path, "utf8")))
      .map((path) => relative(ROOT, path).replace(/\\/g, "/"));

    expect(importers).toEqual(["src/app/(dashboard)/review/[id]/page.tsx"]);
  });
});
