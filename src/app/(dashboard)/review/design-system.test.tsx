import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

// Task 4.10: pins for docs/design-system.md on the review screens (tokens only,
// the type scale, the spacing steps, the alert pattern, 44px targets, the
// dialog spec and 360px). Class-level on purpose, as the intake pins are: jsdom
// has no layout or computed styles for these utilities. The real check is the
// manual harness walk at 1280px and 360px (task 4.11).

vi.mock("@/app/(dashboard)/review/[id]/actions", () => ({
  decideAction: vi.fn(),
}));

import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import { DecisionDialog } from "@/app/(dashboard)/review/[id]/decision-dialog";
import {
  DocumentsSection,
  HistorySection,
  RequestSection,
  Section,
} from "@/app/(dashboard)/review/[id]/request-sections";

const ROOT = process.cwd();
const REVIEW_DIR = join(ROOT, "src/app/(dashboard)/review");

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

// Production modules of the screens, plus the sidebar entry's file.
const modules = filesUnder(REVIEW_DIR)
  .filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path))
  .filter((path) => !path.endsWith("test-support.tsx"))
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

describe("design system: tokens only (docs/design-system.md §2, §3, §4.1)", () => {
  it("scans the production modules of the review screens", () => {
    expect(modules.length).toBeGreaterThanOrEqual(8);
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

  it("gives the page title and the sections the headline and title steps", () => {
    renderIntl(
      <Section id="s" title="Section">
        <p>x</p>
      </Section>,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass(
      "text-headline",
    );
  });
});

describe("design system: status pills (§2.5, §5 Badge, §7)", () => {
  it.each([
    ["en_plazo", "bg-muted", "text-muted-foreground"],
    ["por_vencer", "bg-warning/10", "text-warning-ink"],
    ["vencida", "bg-destructive/10", "text-destructive-ink"],
  ] as const)(
    "draws %s as a pill with a tint and its ink, and always with text",
    (status, tint, ink) => {
      renderIntl(<DeadlineBadge status={status} label="Label text" />);

      const pill = screen.getByText("Label text");
      expect(pill).toHaveClass("rounded-full", tint, ink);
    },
  );
});

describe("design system: cards and sections (§4.1, §5 Card)", () => {
  it("frames a section as a card: surface, 1px border, soft shadow, 12px radius, 24px padding", () => {
    renderIntl(
      <Section id="s" title="Section">
        <p>x</p>
      </Section>,
    );

    expect(screen.getByRole("region", { name: "Section" })).toHaveClass(
      "bg-card",
      "border",
      "border-border",
      "shadow-soft",
      "rounded-xl",
      "p-6",
    );
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
        deadline={null}
      />,
    );

    expect(
      screen.getByText(messages.en.review.detail.fields.cause),
    ).toHaveClass("text-label", "text-muted-foreground");
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

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("h-11");
    }
  });
});

describe("design system: decision dialogs (§5 two-step confirmation, §4.1 elevation)", () => {
  const dec = messages.en.review.decision;
  const TEMPLATES = {
    aprobada: [{ codigo: "aprobacion.general", motivo: null, texto: "Hola" }],
    rechazada: [{ codigo: "rechazo.general", motivo: null, texto: "Hola" }],
    devuelta: [
      {
        codigo: "devolucion.documento_ilegible",
        motivo: "documento_ilegible",
        texto: "Hola",
      },
    ],
  };

  function show(kind: "aprobada" | "rechazada" | "devuelta") {
    renderIntl(
      <DecisionDialog
        kind={kind}
        solicitudId={1}
        templates={TEMPLATES[kind]}
      />,
    );
  }

  it.each([
    ["aprobada", dec.approve.trigger, "bg-primary"],
    ["devuelta", dec.return.trigger, "border-primary"],
    ["rechazada", dec.reject.trigger, "bg-secondary"],
  ] as const)(
    "draws the %s trigger at 44px with its hierarchy (reject is secondary, never destructive)",
    (kind, name, token) => {
      show(kind);

      const trigger = screen.getByRole("button", { name });
      expect(trigger).toHaveClass("h-11", token);
      expect(trigger).not.toHaveClass("text-destructive-ink");
    },
  );

  it("makes only the reject confirm destructive, with a ghost cancel, all at 44px", async () => {
    show("rechazada");
    await userEvent.click(
      screen.getByRole("button", { name: dec.reject.trigger }),
    );
    const dialog = await screen.findByRole("alertdialog");

    const confirm = within(dialog).getByRole("button", {
      name: dec.reject.confirm,
    });
    const cancel = within(dialog).getByRole("button", { name: dec.cancel });
    expect(confirm).toHaveClass(
      "h-11",
      "bg-destructive/10",
      "text-destructive-ink",
    );
    expect(cancel).toHaveClass("h-11", "hover:bg-muted");
    expect(cancel).not.toHaveClass("border-primary");
  });

  it.each(["aprobada", "devuelta"] as const)(
    "keeps the %s confirm primary, not destructive",
    async (kind) => {
      show(kind);
      await userEvent.click(
        screen.getByRole("button", {
          name: kind === "aprobada" ? dec.approve.trigger : dec.return.trigger,
        }),
      );
      const dialog = await screen.findByRole("alertdialog");

      const confirm = within(dialog).getByRole("button", {
        name: kind === "aprobada" ? dec.approve.confirm : dec.return.confirm,
      });
      expect(confirm).toHaveClass("h-11", "bg-primary");
      expect(confirm).not.toHaveClass("text-destructive-ink");
    },
  );

  it("uses the dialog surface: soft shadow, 12px radius, 24px padding", async () => {
    show("aprobada");
    await userEvent.click(
      screen.getByRole("button", { name: dec.approve.trigger }),
    );

    expect(await screen.findByRole("alertdialog")).toHaveClass(
      "shadow-soft",
      "rounded-xl",
      "p-6",
    );
  });

  it("gives radio rows a 44px target and the message a visible focus state", async () => {
    show("rechazada");
    await userEvent.click(
      screen.getByRole("button", { name: dec.reject.trigger }),
    );
    const dialog = await screen.findByRole("alertdialog");

    expect(within(dialog).getByRole("radio").closest("label")).toHaveClass(
      "min-h-11",
      "items-center",
    );
    expect(
      within(dialog).getByRole("textbox", { name: dec.textLabel }),
    ).toHaveClass(
      "rounded-lg",
      "focus-visible:ring-3",
      "focus-visible:border-primary",
    );
  });

  it("writes field errors in the destructive ink and the banner as the catalog alert", async () => {
    const { decideAction } =
      await import("@/app/(dashboard)/review/[id]/actions");
    vi.mocked(decideAction).mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "text_required" }],
    });
    show("rechazada");
    await userEvent.click(
      screen.getByRole("button", { name: dec.reject.trigger }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: dec.reject.confirm }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveClass(
      "text-destructive-ink",
    );

    // The confirm is disabled while the first answer settles.
    const confirm = await within(dialog).findByRole("button", {
      name: dec.reject.confirm,
    });
    await vi.waitFor(() => expect(confirm).toBeEnabled());
    vi.mocked(decideAction).mockResolvedValue({
      ok: false,
      reason: "conflict",
    });
    await userEvent.click(confirm);
    const banner = await vi.waitFor(
      () => {
        const found = within(dialog)
          .getAllByRole("alert")
          .find((el) => el.textContent?.includes(dec.errors.conflict));
        expect(found).toBeDefined();
        return found as HTMLElement;
      },
      { timeout: 4000 },
    );
    expect(banner).toHaveClass(
      "border-l-4",
      "border-l-destructive",
      "bg-destructive/8",
      "text-destructive-ink",
    );
  });
});

describe("design system: 360px (RNF-11, §4.3)", () => {
  const VIEWPORT = 360;
  const PAGE_MARGIN = 16 * 2;
  const queue =
    modules.find((m) => m.path.endsWith("review/page.tsx"))?.text ?? "";

  it("sets no fixed width wider than the 360px content box", () => {
    const widest = modules.flatMap((m) =>
      matches(m.text, FIXED_WIDTH).map((hit) => ({
        file: m.path,
        px: hit[1] ? Number(hit[1]) : Number(hit[2]) * 4,
      })),
    );

    expect(widest.filter((w) => w.px > VIEWPORT - PAGE_MARGIN)).toEqual([]);
  });

  it("stacks the queue as cards below md and shows the table from md", () => {
    expect(queue).toContain("md:hidden");
    expect(queue).toMatch(/hidden[^"]*md:block/);
    expect(queue).toMatch(/w-full sm:w-auto/);
  });

  it("lets long file names and notes wrap instead of widening the page", () => {
    renderIntl(
      <DocumentsSection
        documents={[
          {
            id: 3,
            nombreOriginal: `${"constancia-medica-".repeat(8)}.pdf`,
            tipoDetectado: null,
            tamanoBytes: 10,
            creadoEn: new Date(),
          },
        ]}
      />,
    );

    expect(screen.getByText(/constancia-medica-/)).toHaveClass("break-all");
    const links = screen.getAllByRole("link");
    expect(links[0].parentElement).toHaveClass("flex-col", "sm:flex-row");
  });

  it("wraps decision text and keeps history entries from overflowing", () => {
    renderIntl(
      <HistorySection
        decisions={[
          {
            id: 1,
            tipo: "rechazada",
            plantillaCodigo: "rechazo.general",
            motivoCodigo: null,
            texto: "x".repeat(300),
            revisionId: null,
            secretariaNombre: "Rosa Mena",
            decididaEn: new Date("2026-10-09T15:00:00Z"),
          },
        ]}
        revisions={[]}
        retired={[]}
      />,
    );

    expect(screen.getByText("x".repeat(300))).toHaveClass(
      "break-words",
      "whitespace-pre-wrap",
    );
  });
});
