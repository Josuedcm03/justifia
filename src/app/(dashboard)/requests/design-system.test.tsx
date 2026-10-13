import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestCard } from "@/app/(dashboard)/requests/request-card";
import { StatePill } from "@/app/(dashboard)/requests/state-pill";
import {
  DecisionSection,
  DocumentsSection,
  HistorySection,
  RequestSection,
  SubjectsSection,
} from "@/app/(dashboard)/requests/[id]/detail-sections";
import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

// Task 5.7: pins for docs/design-system.md on the student list and detail
// (tokens only, the type scale, the spacing steps, pills, cards, 44px targets)
// and the RNF-11 guard at 360px. Class-level on purpose, as the intake and
// review pins are: jsdom has no layout or computed styles for these utilities.
// The real check is the manual walk at 360px (task 5.8). The screens render no
// alert, so the catalog alert pattern has nothing to pin here.

const ROOT = process.cwd();
const REQUESTS_DIR = join(ROOT, "src/app/(dashboard)/requests");

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // The intake flow and the correction flow have their own pins.
      return ["new", "correct"].includes(entry.name) ? [] : filesUnder(path);
    }
    return [path];
  });
}

const modules = filesUnder(REQUESTS_DIR)
  .filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path))
  .map((path) => ({
    path: relative(ROOT, path).replace(/\\/g, "/"),
    text: readFileSync(path, "utf8"),
  }));

const ALLOWED_SPACING = new Set([0, 1, 2, 3, 4, 6, 8, 10, 12, 16]); // x4px
const SPACING =
  /(?<![\w-])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?)(?![\w.[%/])/g;
const PALETTE =
  /(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow|accent|caret)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)(?:-\d+)?(?![\w-])/g;
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g;
const OFF_SCALE_TYPE =
  /(?<![\w-])text-(?:h[1-6]|lg|xl|2xl|3xl|4xl|5xl)(?![\w-])/g;

function matches(text: string, pattern: RegExp): RegExpExecArray[] {
  return [...text.matchAll(pattern)];
}

describe("design system: tokens only (docs/design-system.md §2, §3, §4.1)", () => {
  it("scans the production modules of the student screens", () => {
    expect(modules.length).toBeGreaterThanOrEqual(7);
    expect(modules.some((m) => m.path.includes("/new/"))).toBe(false);
  });

  it("uses no hard-coded colour and no raw palette colour", () => {
    const offenders = modules.flatMap((m) =>
      [...matches(m.text, RAW_COLOUR), ...matches(m.text, PALETTE)].map(
        (hit) => `${m.path}: ${hit[0]}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("uses only the defined type steps (no text-h3, no larger sizes)", () => {
    const offenders = modules.flatMap((m) =>
      matches(m.text, OFF_SCALE_TYPE).map((hit) => `${m.path}: ${hit[0]}`),
    );

    expect(offenders).toEqual([]);
  });

  it("uses only the spacing steps 4 8 12 16 24 32 40 48 64", () => {
    const offenders = modules.flatMap((m) =>
      matches(m.text, SPACING)
        .filter((hit) => !ALLOWED_SPACING.has(Number(hit[1])))
        .map((hit) => `${m.path}: ${hit[0]}`),
    );

    expect(offenders).toEqual([]);
  });

  it("gives the sections the headline step and the history groups the title step", () => {
    renderIntl(
      <HistorySection
        decisions={[
          {
            id: 1,
            tipo: "devuelta",
            motivoCodigo: null,
            texto: "x",
            decididaEn: new Date("2026-10-09T15:00:00Z"),
          },
        ]}
        revisions={[]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass(
      "text-headline",
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("text-title");
  });
});

describe("design system: state pills (§2.5, §5 Badge, §7)", () => {
  it.each([
    ["pendiente", "bg-muted", "text-muted-foreground"],
    ["en_revision_coordinacion", "bg-muted", "text-muted-foreground"],
    ["devuelta", "bg-warning/10", "text-warning-ink"],
    ["aprobada", "bg-success/10", "text-success-ink"],
    ["rechazada", "bg-destructive/10", "text-destructive-ink"],
  ] as const)(
    "draws %s as a pill with a tint and its ink, and always with text",
    (estado, tint, ink) => {
      renderIntl(<StatePill estado={estado} />);

      const pill = screen.getByText(messages.en.requests.states[estado]);
      expect(pill).toHaveClass("rounded-full", tint, ink);
    },
  );
});

describe("design system: cards, targets and sections (§4.1, §5, §7)", () => {
  const request = {
    id: 12,
    estado: "devuelta",
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    presentadaEn: new Date("2026-10-08T15:00:00Z"),
    reenviadaEn: null,
  };

  it("frames a request as a card: surface, 1px border, soft shadow, 12px radius", () => {
    renderIntl(
      <ul>
        <RequestCard request={request} />
      </ul>,
    );

    expect(screen.getByRole("listitem")).toHaveClass(
      "bg-card",
      "border",
      "border-border",
      "shadow-soft",
      "rounded-xl",
    );
  });

  it("gives the view link a 44px target on the outline variant", () => {
    renderIntl(
      <ul>
        <RequestCard request={request} />
      </ul>,
    );

    expect(screen.getByRole("link")).toHaveClass("h-11", "border-primary");
  });

  it("draws Correct request as the primary 44px action", () => {
    renderIntl(
      <DecisionSection decision={null} correctHref="/requests/12/correct" />,
    );

    expect(
      screen.getByRole("link", {
        name: messages.en.requests.detail.decision.correct,
      }),
    ).toHaveClass("h-11", "bg-primary");
  });

  it("gives the document actions 44px targets", () => {
    renderIntl(
      <DocumentsSection
        documents={[
          {
            id: 3,
            nombreOriginal: "constancia.pdf",
            tipoDetectado: null,
            tamanoBytes: 10,
            creadoEn: new Date(),
          },
        ]}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveClass("h-11");
  });

  it("labels facts with the label step and muted ink", () => {
    renderIntl(
      <RequestSection
        detail={
          {
            id: 1,
            estado: "pendiente",
            causa: "medica",
            fechaInicio: "2026-10-01",
            fechaFin: "2026-10-02",
            presentadaEn: new Date("2026-10-03T15:00:00Z"),
            reenviadaEn: null,
          } as never
        }
      />,
    );

    expect(
      screen.getByText(messages.en.requests.detail.fields.cause),
    ).toHaveClass("text-label", "text-muted-foreground");
  });
});

describe("design system: 360px (RNF-11, §4.3)", () => {
  const VIEWPORT = 360;
  const REM = 16;
  const SPACING_PX = 4;
  const PAGE_MARGIN = 16 * 2;
  const FIXED_WIDTH =
    /(?<![\w-])(?:min-|max-)?w-\[(\d+)px\]|(?<![\w-])w-(\d+)(?![\w./-])/g;
  const LONG_NAME = `${"constancia-medica-".repeat(8)}.pdf`;

  /** Width in px a base (non-breakpoint) width utility forces, or null. */
  function fixedWidth(token: string): number | null {
    const arbitrary = /^(?:min-)?w-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(token);
    if (arbitrary) {
      const value = Number(arbitrary[1]);
      return arbitrary[2] === "rem" ? value * REM : value;
    }
    const scale = /^(?:min-)?w-(\d+)$/.exec(token);
    return scale ? Number(scale[1]) * SPACING_PX : null;
  }

  function tooWide(root: ParentNode): string[] {
    return [...root.querySelectorAll("[class]")].flatMap((element) =>
      element.className
        .toString()
        .split(/\s+/)
        .filter((token) => (fixedWidth(token) ?? 0) > VIEWPORT),
    );
  }

  const request = {
    id: 12,
    estado: "devuelta",
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    presentadaEn: new Date("2026-10-08T15:00:00Z"),
    reenviadaEn: null,
  };

  it("flags a fixed width above the viewport and passes the ones below", () => {
    const { container } = render(
      <div>
        <div className="w-[400px]" />
        <div className="min-w-[30rem] sm:w-96" />
        <div className="w-[320px] w-full max-w-md sm:w-auto" />
      </div>,
    );

    expect(tooWide(container)).toEqual(["w-[400px]", "min-w-[30rem]"]);
  });

  it("sets no fixed width wider than the content box, and draws no table", () => {
    const widest = modules.flatMap((m) =>
      matches(m.text, FIXED_WIDTH).map((hit) => ({
        file: m.path,
        px: hit[1] ? Number(hit[1]) : Number(hit[2]) * SPACING_PX,
      })),
    );

    expect(widest.filter((w) => w.px > VIEWPORT - PAGE_MARGIN)).toEqual([]);
    expect(modules.filter((m) => /<table|<DataTable/.test(m.text))).toEqual([]);
  });

  it("stacks the list card and gives its action the full row", () => {
    renderIntl(
      <ul>
        <RequestCard request={request} />
      </ul>,
    );

    expect(screen.getByRole("link")).toHaveClass("w-full", "sm:w-auto");
    expect(tooWide(document.body)).toEqual([]);
  });

  it("gives Correct request the full row", () => {
    renderIntl(
      <DecisionSection decision={null} correctHref="/requests/12/correct" />,
    );

    expect(
      screen.getByRole("link", {
        name: messages.en.requests.detail.decision.correct,
      }),
    ).toHaveClass("w-full", "sm:w-auto");
  });

  it("lets long file names wrap and stacks the document actions", () => {
    renderIntl(
      <DocumentsSection
        documents={[
          {
            id: 3,
            nombreOriginal: LONG_NAME,
            tipoDetectado: null,
            tamanoBytes: 10,
            creadoEn: new Date(),
          },
        ]}
      />,
    );

    expect(screen.getByText(LONG_NAME)).toHaveClass("min-w-0", "break-all");
    const links = screen.getAllByRole("link");
    expect(links[0].parentElement).toHaveClass("flex-col", "sm:flex-row");
    expect(tooWide(document.body)).toEqual([]);
  });

  it("wraps decision text, subject names and history entries instead of widening the page", () => {
    renderIntl(
      <>
        <DecisionSection
          decision={{
            id: 1,
            tipo: "rechazada",
            motivoCodigo: null,
            texto: "x".repeat(300),
            decididaEn: new Date("2026-10-09T15:00:00Z"),
          }}
          correctHref={null}
        />
        <SubjectsSection
          classes={[
            {
              asignaturaId: 1,
              codigo: "MAT-101",
              nombre: "Calculo diferencial e integral para ingenieria",
              numeroGrupo: "1",
              docenteNombre: "Ana Maria de los Angeles Perez Castellon",
            },
          ]}
        />
      </>,
    );

    expect(screen.getByText("x".repeat(300))).toHaveClass(
      "break-words",
      "whitespace-pre-wrap",
    );
    expect(screen.getByText(/Calculo diferencial/)).toHaveClass("break-words");
    expect(tooWide(document.body)).toEqual([]);
  });
});
