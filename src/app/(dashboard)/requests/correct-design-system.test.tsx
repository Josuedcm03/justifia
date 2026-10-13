import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  renderIntl,
} from "@/app/(dashboard)/requests/new/test-support";
import type { Draft } from "@/lib/data/solicitudes";

// Task 6.11: pins for docs/design-system.md on the correction screens (tokens
// only, the type scale, the spacing steps, the alert pattern, 44px targets, the
// dialog hierarchy) and the RNF-11 guard at 360px. Class-level on purpose, as
// the intake, review and student pins are: jsdom has no layout or computed
// styles for these utilities. The real check is the manual walk at 360px
// (task 6.14).

const { requireRole, getLiveDraft, listEnrollmentFailSoft } = vi.hoisted(
  () => ({
    requireRole: vi.fn(),
    getLiveDraft: vi.fn(),
    listEnrollmentFailSoft: vi.fn(),
  }),
);

vi.mock("@/lib/auth/dal", () => ({ requireRole }));
vi.mock("@/lib/data/solicitudes", () => ({ getLiveDraft }));
vi.mock("@/lib/data/enrollment", () => ({ listEnrollmentFailSoft }));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: () => ({}) }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: messages.en,
      namespace: namespace as "intake",
    }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));
vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  saveDetailsAction: vi.fn(),
  saveSubjectsAction: vi.fn(),
  finalizeDocumentAction: vi.fn(),
  removeDocumentAction: vi.fn(),
  submitRequestAction: vi.fn(),
  discardDraftAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/requests/[id]/correct/actions", () => ({
  saveCorrectionDetailsAction: vi.fn(),
  saveCorrectionSubjectsAction: vi.fn(),
  finalizeCorrectionDocumentAction: vi.fn(),
  removeCorrectionDocumentAction: vi.fn(),
  resubmitCorrectionAction: vi.fn(),
}));

import CorrectRequestPage from "@/app/(dashboard)/requests/[id]/correct/page";
import { ResubmitDialog } from "@/app/(dashboard)/requests/new/resubmit-dialog";

const ROOT = process.cwd();
const MODULES = [
  "src/app/(dashboard)/requests/[id]/correct/page.tsx",
  "src/app/(dashboard)/requests/[id]/correct/actions.ts",
  "src/app/(dashboard)/requests/new/flow-steps.tsx",
  "src/app/(dashboard)/requests/new/resubmit-dialog.tsx",
].map((path) => ({
  path,
  text: existsSync(join(ROOT, path))
    ? readFileSync(join(ROOT, path), "utf8")
    : "",
}));

const ALLOWED_SPACING = new Set([0, 1, 2, 3, 4, 6, 8, 10, 12, 16]); // x4px
const SPACING =
  /(?<![\w-])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?)(?![\w.[%/])/g;
const PALETTE =
  /(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow|accent|caret)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)(?:-\d+)?(?![\w-])/g;
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g;
const OFF_SCALE_TYPE =
  /(?<![\w-])text-(?:h[1-6]|lg|xl|2xl|3xl|4xl|5xl)(?![\w-])/g;

const hits = (text: string, pattern: RegExp) => [...text.matchAll(pattern)];

describe("design system: tokens only (docs/design-system.md §2, §3, §4.1)", () => {
  it("scans every production module of the correction screens", () => {
    expect(MODULES.every((m) => m.text.length > 0)).toBe(true);
  });

  it("uses no hard-coded colour and no raw palette colour", () => {
    const offenders = MODULES.flatMap((m) =>
      [...hits(m.text, RAW_COLOUR), ...hits(m.text, PALETTE)].map(
        (hit) => `${m.path}: ${hit[0]}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("uses only the defined type steps", () => {
    const offenders = MODULES.flatMap((m) =>
      hits(m.text, OFF_SCALE_TYPE).map((hit) => `${m.path}: ${hit[0]}`),
    );

    expect(offenders).toEqual([]);
  });

  it("uses only the spacing steps 4 8 12 16 24 32 40 48 64", () => {
    const offenders = MODULES.flatMap((m) =>
      hits(m.text, SPACING)
        .filter((hit) => !ALLOWED_SPACING.has(Number(hit[1])))
        .map((hit) => `${m.path}: ${hit[0]}`),
    );

    expect(offenders).toEqual([]);
  });
});

describe("design system: resubmit dialog (§5 Dialog, §5 Button)", () => {
  it("keeps the trigger primary at 44px and the dialog on the soft shadow", async () => {
    renderIntl(<ResubmitDialog action={vi.fn()} onErrors={vi.fn()} />, "en");

    const trigger = screen.getByRole("button", { name: "Resubmit request" });
    expect(trigger).toHaveClass("h-11", "bg-primary");
    expect(trigger).not.toHaveClass("bg-secondary");

    await userEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveClass("p-6", "shadow-soft");
    expect(dialog).not.toHaveClass("shadow-lg");

    const [cancel, confirm] = screen
      .getAllByRole("button")
      .filter((button) => dialog.contains(button));
    expect(cancel).toHaveClass("h-11", "hover:bg-muted");
    expect(confirm).toHaveClass("h-11", "bg-primary");
    expect(confirm).not.toHaveClass("bg-destructive/10");
  });
});

const RETURNED: Draft = {
  id: 31,
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  actualizadoEn: new Date("2026-10-06T12:00:00Z"),
  subjects: [{ grupoId: 1, asignaturaId: 10 }],
  documents: [
    {
      id: 1,
      nombreOriginal: `${"constancia-medica-".repeat(8)}.pdf`,
      tipo: "pdf",
      tamanoBytes: 2048,
      estado: "valido",
    },
  ],
};
const GROUP = {
  grupoId: 1,
  asignaturaId: 10,
  asignaturaCodigo: "MAT-101",
  asignaturaNombre: "Calculo diferencial e integral para ingenieria",
  periodo: "2026-2",
  numeroGrupo: "1",
  docenteNombre: "Ana Maria de los Angeles Perez Castellon",
};

async function renderStep(step: string | null) {
  const ui = await CorrectRequestPage({
    params: Promise.resolve({ id: "31" }),
    searchParams: Promise.resolve(step === null ? {} : { step }),
  });
  return renderIntl(ui, "en");
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ sub: "7", rol: "estudiante" });
  getLiveDraft.mockReset().mockResolvedValue(RETURNED);
  listEnrollmentFailSoft
    .mockReset()
    .mockResolvedValue({ data: [GROUP], degraded: false });
});

afterEach(cleanup);

describe("design system: the correction page (§4.1, §5, §7)", () => {
  it("draws the load failure as the catalog alert, with text", async () => {
    getLiveDraft.mockRejectedValue(new Error("db down"));

    await renderStep(null);

    expect(screen.getByRole("status")).toHaveClass(
      "border-l-4",
      "border-l-destructive",
      "bg-destructive/8",
      "text-destructive-ink",
      "rounded-lg",
    );
  });

  it("gives the way back to the request a 44px ghost target", async () => {
    await renderStep(null);

    expect(
      screen.getByRole("link", { name: "Back to the request" }),
    ).toHaveClass("h-11", "hover:bg-muted");
  });

  it("sizes the review edit links and the document view link to 44px", async () => {
    await renderStep("4");

    for (const link of screen.getAllByRole("link", { name: /^Edit / })) {
      expect(link).toHaveClass("h-11");
    }
    expect(screen.getByRole("link", { name: /^View / })).toHaveClass("h-11");
  });
});

describe("design system: 360px (RNF-11, §4.3)", () => {
  const VIEWPORT = 360;
  const REM = 16;
  const SPACING_PX = 4;
  const PAGE_MARGIN = 16 * 2;

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

  function tooWide(root: ParentNode, limit = VIEWPORT): string[] {
    return [...root.querySelectorAll("[class]")].flatMap((element) =>
      element.className
        .toString()
        .split(/\s+/)
        .filter((token) => (fixedWidth(token) ?? 0) > limit),
    );
  }

  it("flags a fixed width above the viewport and passes the ones below", () => {
    const { container } = render(
      <div>
        <div className="w-[400px]" />
        <div className="w-[320px] w-full max-w-md sm:w-auto" />
      </div>,
    );

    expect(tooWide(container)).toEqual(["w-[400px]"]);
  });

  it.each(["1", "2", "3", "4"])(
    "step %s sets no fixed width wider than the content box",
    async (step) => {
      const { container } = await renderStep(step);

      expect(tooWide(container, VIEWPORT - PAGE_MARGIN)).toEqual([]);
    },
  );

  it("stacks the footer actions and gives resubmit the full row", async () => {
    await renderStep("4");

    const resubmit = screen.getByRole("button", { name: "Resubmit request" });
    expect(resubmit).toHaveClass("w-full", "sm:w-auto");
    expect(resubmit.parentElement).toHaveClass(
      "flex-col-reverse",
      "sm:flex-row",
    );
  });

  it("lets a long file name shrink instead of widening the page", async () => {
    await renderStep("3");

    const name = screen.getByText(/constancia-medica-/);
    expect(name).toHaveClass("truncate");
    expect(name.parentElement).toHaveClass("min-w-0");
  });
});
