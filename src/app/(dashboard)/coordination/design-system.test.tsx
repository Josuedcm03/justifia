import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

// Task 10.11: pins for docs/design-system.md on the coordinator screens (tokens
// only, the type scale, the spacing steps, the dialog spec, 44 px targets, 360
// px). Class-level on purpose, as the review pins are: jsdom has no layout or
// computed styles for these utilities. The real check is the manual walk.

vi.mock("@/app/(dashboard)/coordination/[id]/actions", () => ({
  answerEscalationAction: vi.fn(),
}));

import { AnswerForm } from "@/app/(dashboard)/coordination/[id]/answer-form";
import { CoordinationNoticeSection } from "@/app/(dashboard)/coordination/[id]/coordination-sections";
import { CoordinationList } from "@/app/(dashboard)/coordination/coordination-list";

const ROOT = process.cwd();
const COORDINATION_DIR = join(ROOT, "src/app/(dashboard)/coordination");

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const modules = filesUnder(COORDINATION_DIR)
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
const FIXED_WIDTH =
  /(?<![\w-])(?:min-|max-)?w-\[(\d+)px\]|(?<![\w-])w-(\d+)(?![\w./-])/g;

function matches(text: string, pattern: RegExp): RegExpExecArray[] {
  return [...text.matchAll(pattern)];
}

describe("coordination design system: tokens only (docs/design-system.md §2, §3, §4.1)", () => {
  it("scans the production modules of the coordinator screens", () => {
    expect(modules.length).toBeGreaterThanOrEqual(6);
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

  it("sets no fixed width wider than the 360px content box", () => {
    const widest = modules.flatMap((m) =>
      matches(m.text, FIXED_WIDTH).map((hit) => ({
        file: m.path,
        px: hit[1] ? Number(hit[1]) : Number(hit[2]) * 4,
      })),
    );

    expect(widest.filter((w) => w.px > 360 - 32)).toEqual([]);
  });
});

describe("coordination design system: list and cards (§4.1, §5 Card, §5 Button)", () => {
  const open = {
    id: 9,
    estudianteNombre: "Ana Lopez",
    estudianteCif: "2020-0001",
    motivo: "sospecha_documento",
    creadoEn: new Date("2026-10-13T15:00:00Z"),
  } as const;

  it("gives the two parts the headline step and each card the card surface", () => {
    renderIntl(<CoordinationList open={[open]} notices={[]} />);

    for (const heading of screen.getAllByRole("heading", { level: 2 })) {
      expect(heading).toHaveClass("text-headline");
    }
    const card = screen.getAllByRole("listitem")[0];
    expect(card).toHaveClass("bg-card", "border-border", "shadow-soft");
  });

  it("draws the attend link as a 44px outline button", () => {
    renderIntl(<CoordinationList open={[open]} notices={[]} />);

    expect(screen.getByRole("link")).toHaveClass("h-11");
  });

  it("labels the notice section with the headline step", () => {
    renderIntl(
      <CoordinationNoticeSection
        detail={{
          kind: "notice",
          id: 12,
          solicitudId: 41,
          estado: "aprobada",
          creadoEn: new Date("2026-10-13T15:00:00Z"),
          estudiante: { nombre: "Ana", cif: "1", carrera: "Arquitectura" },
          docenteNombre: "Marta Ruiz",
          comunicadoEl: "2026-10-12",
          nota: null,
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass(
      "text-headline",
    );
  });
});

describe("coordination design system: the answer dialog (§5 two-step confirmation, §4.1 elevation)", () => {
  const t = messages.en.coordination.answer.dialog;

  it("draws the trigger at 44px and the confirm as the primary action, cancel ghost", async () => {
    renderIntl(<AnswerForm escalamientoId={9} />);

    const trigger = screen.getByRole("button", { name: t.trigger });
    expect(trigger).toHaveClass("h-11");
    await userEvent.click(trigger);
    const confirm = await screen.findByRole("button", { name: t.confirm });
    const cancel = screen.getByRole("button", { name: t.cancel });

    expect(confirm).toHaveClass("h-11", "bg-primary");
    expect(cancel).toHaveClass("h-11", "hover:bg-muted");
  });

  it("labels the textarea and describes it by its hint", async () => {
    renderIntl(<AnswerForm escalamientoId={9} />);
    await userEvent.click(screen.getByRole("button", { name: t.trigger }));

    const field = await screen.findByRole("textbox", { name: t.noteLabel });
    expect(field).toHaveAccessibleDescription(t.noteHint);
  });
});
