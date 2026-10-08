import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import type {
  ApplyState,
  PreviewState,
} from "@/app/(dashboard)/catalog/import/actions";
import {
  ImportPreview,
  ImportResult,
} from "@/app/(dashboard)/catalog/import/import-preview";
import type { EntityCounts, RowError } from "@/lib/import/types";

type PreviewArm = Extract<PreviewState, { kind: "preview" }>;
type AppliedArm = Extract<ApplyState, { kind: "applied" }>;

const zero: EntityCounts = {
  create: 0,
  update: 0,
  unchanged: 0,
  deactivate: 0,
  error: 0,
};
const HASH = "a".repeat(64);
const PREVIEW: PreviewArm = {
  kind: "preview",
  counts: {
    Asignatura: { ...zero, create: 2, update: 1, unchanged: 3 },
    Usuario: { ...zero, create: 3, unchanged: 1 },
    Grupo: { ...zero, create: 4, deactivate: 2 },
  },
  accountsToCreate: 3,
  asignaturasToReactivate: 0,
  manualGruposToDeactivate: 0,
  errors: [],
  fileSha256: HASH,
};
const withErrors = (errors: RowError[]): PreviewArm => ({
  ...PREVIEW,
  errors,
});
const APPLIED: AppliedArm = {
  kind: "applied",
  summary: {
    actor: "secretaria1",
    at: "2026-10-03T12:00:00.000Z",
    fileSha256: HASH,
    counts: PREVIEW.counts,
    accountsCreated: 3,
    accountsUpdated: 1,
    asignaturasReactivated: 0,
    manualGruposDeactivated: 0,
  },
  credentials: [
    { login: "ana@uni.edu", nombreCompleto: "Ana", clave: "ZK9TQ2M4XW7HB3PD" },
  ],
};

const en = enMessages.catalog.import;
const es = esMessages.catalog.import;

function renderUi(ui: ReactElement, locale: "en" | "es" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : esMessages}
      // A missing key must fail the test instead of rendering its path.
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

const cellsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      Array.from(row.querySelectorAll("th, td")).map(
        (cell) => cell.textContent,
      ),
    );

describe("ImportPreview (CEI: Dry-run report persists nothing)", () => {
  const confirm = vi.fn();
  beforeEach(() => confirm.mockReset());

  function renderPreview(
    state: PreviewArm,
    locale: "en" | "es" = "en",
    pending = false,
    busy = false,
  ) {
    return renderUi(
      <ImportPreview
        state={state}
        fileName="catalogo.xlsx"
        action={confirm}
        pending={pending}
        busy={busy}
      />,
      locale,
    );
  }

  const reactivating = (count: number): PreviewArm => ({
    ...PREVIEW,
    asignaturasToReactivate: count,
  });
  const manual = (count: number, deactivate: number): PreviewArm => ({
    ...PREVIEW,
    manualGruposToDeactivate: count,
    counts: { ...PREVIEW.counts, Grupo: { ...zero, deactivate } },
  });

  it("states the reactivation count before the confirm control, and nothing at 0 (CEI-PREV)", () => {
    const { unmount } = renderPreview(reactivating(2));
    const notice = screen.getByText(
      /^2 inactive subjects in the workbook will be reactivated./,
    );
    const button = screen.getByRole("button", { name: en.preview.confirm });
    expect(notice.compareDocumentPosition(button)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    unmount();

    renderPreview(reactivating(0));
    expect(screen.queryByText(/will be reactivated/)).toBeNull();
  });

  it.each([
    [1, 4, /^1 of the groups that will be deactivated was created by hand./],
    [4, 4, /^4 of the groups that will be deactivated were created by hand./],
  ])(
    "warns about %i manual of %i deactivated groups and still offers confirm",
    (count, deactivate, text) => {
      renderPreview(manual(count, deactivate));

      const warning = screen.getByText(text);
      const button = screen.getByRole("button", { name: en.preview.confirm });
      expect(warning.compareDocumentPosition(button)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(button).toBeEnabled();
    },
  );

  it.each([
    [0, 0],
    [0, 4],
  ])(
    "shows no manual-group warning for %i manual of %i deactivated",
    (c, d) => {
      renderPreview(manual(c, d));

      expect(screen.queryByText(/created by hand/)).toBeNull();
    },
  );

  it("says on every preview that manual edits may be replaced, errors or not", () => {
    const { unmount } = renderPreview(PREVIEW);
    expect(screen.getByText(en.preview.replacedEdits)).toBeInTheDocument();
    unmount();

    renderPreview({
      ...PREVIEW,
      errors: [{ sheet: "Grupos", row: 2, reason: "asignatura.inactive" }],
    });
    expect(screen.getByText(en.preview.replacedEdits)).toBeInTheDocument();
  });

  it("explains a busy catalog and keeps the confirm control (CEI-BUSY)", () => {
    renderPreview(PREVIEW, "en", false, true);

    expect(screen.getByRole("alert")).toHaveTextContent(en.preview.busy);
    expect(en.preview.busy).toMatch(/busy.*Nothing was applied.*cancel/);
    expect(
      screen.getByRole("button", { name: en.preview.confirm }),
    ).toBeEnabled();
  });

  it("shows no busy notice by default", () => {
    renderPreview(PREVIEW);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lists the create/update/unchanged/deactivate/error counts per entity under real headers", () => {
    renderPreview(PREVIEW);

    const table = screen.getByRole("table", { name: en.preview.countsCaption });
    expect(cellsOf(table)).toEqual([
      [
        en.preview.columns.entity,
        en.preview.columns.create,
        en.preview.columns.update,
        en.preview.columns.unchanged,
        en.preview.columns.deactivate,
        en.preview.columns.error,
      ],
      [en.entities.Asignatura, "2", "1", "3", "0", "0"],
      [en.entities.Usuario, "3", "0", "1", "0", "0"],
      [en.entities.Grupo, "4", "0", "0", "2", "0"],
    ]);
  });

  it("says plainly that nothing was written and names the previewed file", () => {
    renderPreview(PREVIEW);

    expect(screen.getByText(en.preview.notSaved)).toBeInTheDocument();
    expect(screen.getByText("File: catalogo.xlsx")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: en.preview.title }),
    ).toBeInTheDocument();
  });

  it("names the deactivations explicitly, and says so when there are none", () => {
    const { unmount } = renderPreview(PREVIEW);
    expect(
      screen.getByText(
        "2 groups missing from the workbook will be deactivated.",
      ),
    ).toBeInTheDocument();
    unmount();

    renderPreview({
      ...PREVIEW,
      counts: { ...PREVIEW.counts, Grupo: { ...zero, create: 4 } },
    });
    expect(
      screen.getByText("No group will be deactivated."),
    ).toBeInTheDocument();
  });

  it("shows the new-account count and the cost of creating them", () => {
    renderPreview(PREVIEW);

    expect(
      screen.getByText("3 new teacher accounts will be created."),
    ).toBeInTheDocument();
    expect(screen.getByText(en.preview.accountsCost)).toBeInTheDocument();
  });

  it("omits the cost note when no account will be created", () => {
    renderPreview({ ...PREVIEW, accountsToCreate: 0 });

    expect(
      screen.getByText("No new teacher accounts will be created."),
    ).toBeInTheDocument();
    expect(screen.queryByText(en.preview.accountsCost)).toBeNull();
  });

  it("renders the same report in Spanish", () => {
    renderPreview(PREVIEW, "es");

    expect(screen.getByText(es.preview.notSaved)).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: es.preview.countsCaption }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Se desactivarán 2 grupos que no aparecen en el libro."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: es.preview.confirm }),
    ).toBeInTheDocument();
  });
});

describe("ImportPreview confirmation (CEI: Preview with errors blocks confirmation)", () => {
  const confirm = vi.fn();
  beforeEach(() => confirm.mockReset());

  const renderPreview = (state: PreviewArm, pending = false) =>
    renderUi(
      <ImportPreview
        state={state}
        fileName="catalogo.xlsx"
        action={confirm}
        pending={pending}
      />,
    );

  it("offers confirm for a clean preview, with the digest as a hidden field", async () => {
    const { container } = renderPreview(PREVIEW);
    const user = userEvent.setup();

    const hidden = container.querySelector('input[type="hidden"]');
    expect(hidden).toHaveAttribute("name", "fileSha256");
    expect(hidden).toHaveValue(HASH);

    await user.click(screen.getByRole("button", { name: en.preview.confirm }));

    expect(confirm).toHaveBeenCalledTimes(1);
    const sent = confirm.mock.calls[0][0] as FormData;
    expect(sent.get("fileSha256")).toBe(HASH);
  });

  it("keeps the counts but offers no confirm, and leaves the errors to their own block", () => {
    renderPreview(
      withErrors([
        {
          sheet: "Grupos",
          row: 4,
          reason: "periodo.invalid",
          value: "2026-S3",
        },
        { sheet: "Docentes", row: 9, reason: "correo.duplicate" },
      ]),
    );

    expect(
      screen.getByRole("table", { name: en.preview.countsCaption }),
    ).toBeInTheDocument();
    // The row errors are shown by ImportErrors, above this section.
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.queryByText(en.reasons.periodo.invalid)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.preview.confirm }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.preview.confirming }),
    ).toBeNull();
    expect(document.querySelector("form")).toBeNull();
    expect(document.querySelector('input[name="fileSha256"]')).toBeNull();
  });

  it.each(["en", "es"] as const)(
    "a single dias.invalid row error offers no confirm control, so the apply is not reachable, in %s (CEI-DIAS-3)",
    (locale) => {
      renderUi(
        <ImportPreview
          state={{
            ...withErrors([
              {
                sheet: "Grupos",
                row: 5,
                reason: "dias.invalid",
                value: "Funday",
              },
            ]),
            counts: { ...PREVIEW.counts, Grupo: { ...zero, error: 1 } },
          }}
          fileName="catalogo.xlsx"
          action={confirm}
          pending={false}
        />,
        locale,
      );

      const copy = locale === "en" ? en : es;
      expect(screen.queryByRole("button")).toBeNull();
      expect(
        screen.queryByRole("button", { name: copy.preview.confirm }),
      ).toBeNull();
      expect(document.querySelector("form")).toBeNull();
      expect(document.querySelector('input[name="fileSha256"]')).toBeNull();
      expect(confirm).not.toHaveBeenCalled();
    },
  );

  it("disables confirmation while the apply is running", () => {
    renderPreview(PREVIEW, true);

    expect(
      screen.getByRole("button", { name: en.preview.confirming }),
    ).toBeDisabled();
  });
});

describe("ImportResult (CEI: result screen shows the per-entity summary)", () => {
  beforeEach(() => {
    let n = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => `blob:result-${++n}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it("shows the applied counts, the account totals and the credentials download", () => {
    renderUi(<ImportResult state={APPLIED} />);

    expect(
      screen.getByRole("heading", { level: 2, name: en.result.title }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", { name: en.result.countsCaption });
    expect(cellsOf(table)[1]).toEqual([
      en.entities.Asignatura,
      "2",
      "1",
      "3",
      "0",
      "0",
    ]);
    expect(
      screen.getByText("3 new accounts were created."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 existing account was updated."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.credentials.download }),
    ).toHaveAttribute("href", "blob:result-1");
  });

  it("shows the two result lines, zero included (CEI-COPY)", () => {
    const { unmount } = renderUi(<ImportResult state={APPLIED} />);
    expect(
      screen.getByText("No inactive subject was reactivated."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No group created by hand was deactivated."),
    ).toBeInTheDocument();
    unmount();

    renderUi(
      <ImportResult
        state={{
          ...APPLIED,
          summary: {
            ...APPLIED.summary,
            asignaturasReactivated: 2,
            manualGruposDeactivated: 1,
          },
        }}
      />,
      "es",
    );
    expect(
      screen.getByText("Se reactivaron 2 asignaturas inactivas."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Se desactivó 1 grupo creado a mano."),
    ).toBeInTheDocument();
  });

  it("offers no download when the apply created no account", () => {
    renderUi(
      <ImportResult
        state={{
          ...APPLIED,
          summary: { ...APPLIED.summary, accountsCreated: 0 },
          credentials: [],
        }}
      />,
    );

    expect(screen.getByText("No new account was created.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
