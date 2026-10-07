import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import type {
  ApplyState,
  PreviewState,
} from "@/app/(dashboard)/catalog/import/actions";
import { MAX_FILE_BYTES } from "@/lib/import/limits";
import { SHEETS } from "@/lib/import/sheets";
import type { EntityCounts, RowError } from "@/lib/import/types";

const { previewAction, applyAction } = vi.hoisted(() => ({
  previewAction: vi.fn(),
  applyAction: vi.fn(),
}));

vi.mock("@/app/(dashboard)/catalog/import/actions", () => ({
  previewAction,
  applyAction,
}));

import { ImportForm } from "@/app/(dashboard)/catalog/import/import-form";

type PreviewArm = Extract<PreviewState, { kind: "preview" }>;

const zero: EntityCounts = {
  create: 0,
  update: 0,
  unchanged: 0,
  deactivate: 0,
  error: 0,
};
const HASH = "c".repeat(64);
const PREVIEW: PreviewArm = {
  kind: "preview",
  counts: {
    Asignatura: { ...zero, create: 1 },
    Usuario: { ...zero, create: 1 },
    Grupo: { ...zero, create: 1 },
  },
  accountsToCreate: 1,
  asignaturasToReactivate: 0,
  manualGruposToDeactivate: 0,
  errors: [],
  fileSha256: HASH,
};
const APPLIED: ApplyState = {
  kind: "applied",
  summary: {
    actor: "secretaria1",
    at: "2026-10-03T12:00:00.000Z",
    fileSha256: HASH,
    counts: PREVIEW.counts,
    accountsCreated: 1,
    accountsUpdated: 0,
    asignaturasReactivated: 0,
    manualGruposDeactivated: 0,
  },
  credentials: [
    { login: "ana@uni.edu", nombreCompleto: "Ana", clave: "ZK9TQ2M4XW7HB3PD" },
  ],
};

const en = enMessages.catalog.import;
const es = esMessages.catalog.import;

function renderForm(locale: "en" | "es" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : esMessages}
      // A missing key must fail the test instead of rendering its path.
      onError={(error) => {
        throw error;
      }}
    >
      <ImportForm />
    </NextIntlClientProvider>,
  );
}

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const WORKBOOK = new File(["PK-bytes"], "catalogo.xlsx", { type: XLSX_TYPE });
const SECOND = new File(["PK-second-file"], "segundo.xlsx", {
  type: XLSX_TYPE,
});

const scrollIntoView = vi.fn();
const zone = () => screen.getByTestId("import-dropzone");
const drop = (...files: File[]) =>
  fireEvent.drop(zone(), { dataTransfer: { files } });

/** Picks the workbook through the file input: that alone runs the preview. */
async function previewWorkbook(locale: "en" | "es" = "en") {
  const copy = locale === "en" ? en : es;
  const user = userEvent.setup();
  renderForm(locale);
  await user.upload(screen.getByLabelText(copy.upload.dropTitle), WORKBOOK);
  return user;
}

beforeEach(() => {
  previewAction.mockReset().mockResolvedValue(PREVIEW);
  applyAction.mockReset().mockResolvedValue(APPLIED);
  scrollIntoView.mockReset();
  // jsdom does not implement it.
  Element.prototype.scrollIntoView = scrollIntoView;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:form-1"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

describe("ImportForm upload step (CEI: Contract shown before upload)", () => {
  it("shows the three sheets in order with their columns, before any file is chosen", () => {
    renderForm();

    const contract = screen.getByRole("region", { name: en.contract.title });
    const sheetList = contract.querySelector("ol") as HTMLElement;
    const sheets = within(sheetList).getAllByRole("heading", { level: 3 });
    expect(sheets.map((h) => h.textContent)).toEqual([
      "Asignaturas",
      "Docentes",
      "Grupos",
    ]);
    expect(sheets.map((h) => h.textContent)).toEqual(SHEETS.map((s) => s.name));

    for (const sheet of SHEETS) {
      const table = within(contract).getByRole("table", {
        name: en.contract.columnsCaption.replace("{sheet}", sheet.name),
      });
      for (const column of [...sheet.required, ...sheet.optional]) {
        expect(
          within(table).getByRole("columnheader", {
            name: new RegExp(`^${column}\\b`),
          }),
        ).toBeInTheDocument();
      }
      for (const column of sheet.optional) {
        expect(
          within(table).getByRole("columnheader", {
            name: new RegExp(`^${column}\\b`),
          }),
        ).toHaveTextContent(en.contract.optional);
      }
    }
    expect(previewAction).not.toHaveBeenCalled();
  });

  it("lists the five validation rules", () => {
    renderForm();

    for (const rule of Object.values(en.contract.rules)) {
      expect(screen.getByText(rule)).toBeInTheDocument();
    }
    expect(Object.keys(en.contract.rules)).toHaveLength(5);
  });

  it("puts the dropzone inside the structure card, after the contract and the rules", () => {
    const { container } = renderForm();

    const contract = screen.getByRole("region", { name: en.contract.title });
    expect(contract.tagName).toBe("SECTION");
    const input = screen.getByLabelText(en.upload.dropTitle);
    expect(contract).toContainElement(input);
    expect(contract).toContainElement(zone());

    const before = [
      ...within(contract).getAllByRole("table"),
      within(contract).getByText(en.contract.legend),
      within(contract).getByRole("heading", {
        level: 3,
        name: en.contract.rulesTitle,
      }),
      ...Object.values(en.contract.rules).map((rule) =>
        within(contract).getByText(rule),
      ),
    ];
    for (const node of before) {
      expect(
        node.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    // One column: the two-column grid and its sticky wrapper are gone.
    expect(container.innerHTML).not.toContain("grid-cols");
    expect(container.innerHTML).not.toContain("sticky");
  });

  it("draws the zone as an inset area, not as a second white card", () => {
    renderForm();

    expect(zone()).toHaveClass("bg-background", "border-dashed", "rounded-xl");
    expect(zone()).not.toHaveClass("bg-card");
  });

  it.each([
    ["en", en],
    ["es", es],
  ] as const)(
    "labels a file input that accepts only .xlsx in %s",
    (locale, copy) => {
      renderForm(locale);

      const input = screen.getByLabelText(copy.upload.dropTitle);
      expect(input).toHaveAttribute("type", "file");
      expect(input).toHaveAttribute("name", "file");
      expect(input).toHaveAttribute("accept", ".xlsx");
      expect(
        screen.getByRole("region", { name: copy.contract.title }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          copy.upload.fileHint.replace(
            "{size}",
            String(MAX_FILE_BYTES / 1024 / 1024),
          ),
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: copy.upload.choose }),
      ).toBeInTheDocument();
    },
  );

  it("offers the template through the guarded route", () => {
    renderForm();

    expect(
      screen.getByRole("link", { name: en.contract.template }),
    ).toHaveAttribute("href", "/api/catalog/template");
  });

  it("has no separate preview button and never uses the current-location marker", () => {
    const { container } = renderForm();

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(container.querySelector('[type="submit"]')).toBeNull();
    expect(container.innerHTML).not.toContain("is-current");
  });
});

describe("ImportForm dropzone (a taken file is previewed at once)", () => {
  it("previews a dropped workbook without any button press", async () => {
    renderForm();

    drop(WORKBOOK);

    expect(
      await screen.findByRole("heading", { level: 2, name: en.preview.title }),
    ).toBeInTheDocument();
    expect(previewAction).toHaveBeenCalledTimes(1);
    const [prev, sent] = previewAction.mock.calls[0] as [unknown, FormData];
    expect(prev).toEqual({ kind: "idle" });
    expect([...sent.keys()]).toEqual(["file"]);
    expect((sent.get("file") as File).name).toBe("catalogo.xlsx");
    expect(applyAction).not.toHaveBeenCalled();
  });

  it("previews only the first of several dropped files", async () => {
    renderForm();

    drop(WORKBOOK, SECOND);

    await screen.findByRole("heading", { level: 2, name: en.preview.title });
    expect(previewAction).toHaveBeenCalledTimes(1);
    const sent = previewAction.mock.calls[0][1] as FormData;
    expect(sent.getAll("file")).toHaveLength(1);
    expect((sent.get("file") as File).name).toBe("catalogo.xlsx");
  });

  it.each([
    ["dropped", (file: File) => drop(file)],
    [
      "picked",
      (file: File) =>
        fireEvent.change(screen.getByLabelText(en.upload.dropTitle), {
          target: { files: [file] },
        }),
    ],
  ] as const)(
    "rejects a %s .csv on the spot and sends nothing",
    (_how, take) => {
      renderForm();

      take(new File(["a,b"], "catalogo.csv", { type: "text/csv" }));

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(en.errors.wrongExtension);
      const input = screen.getByLabelText(en.upload.dropTitle);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input.getAttribute("aria-describedby")).toContain(alert.id);
      // Directly under the zone, inside the structure card.
      expect(zone().nextElementSibling).toBe(alert);
      expect(
        screen.getByRole("region", { name: en.contract.title }),
      ).toContainElement(alert);
      expect(previewAction).not.toHaveBeenCalled();
    },
  );

  it("accepts the .xlsx extension in any case", async () => {
    renderForm();

    drop(new File(["PK"], "CATALOGO.XLSX", { type: XLSX_TYPE }));

    await screen.findByRole("heading", { level: 2, name: en.preview.title });
    expect(previewAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects an oversized workbook on the spot and sends nothing", () => {
    renderForm();
    const big = new File(["PK"], "grande.xlsx", { type: XLSX_TYPE });
    Object.defineProperty(big, "size", { value: MAX_FILE_BYTES + 1 });

    drop(big);

    expect(screen.getByRole("alert")).toHaveTextContent(en.errors.tooLarge);
    expect(previewAction).not.toHaveBeenCalled();
  });

  it("accepts a workbook of exactly the maximum size", async () => {
    renderForm();
    const edge = new File(["PK"], "justo.xlsx", { type: XLSX_TYPE });
    Object.defineProperty(edge, "size", { value: MAX_FILE_BYTES });

    drop(edge);

    await screen.findByRole("heading", { level: 2, name: en.preview.title });
    expect(previewAction).toHaveBeenCalledTimes(1);
  });

  it("clears the on-the-spot error once a valid file is taken", async () => {
    renderForm();
    drop(new File(["a,b"], "catalogo.csv", { type: "text/csv" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    drop(WORKBOOK);

    // The preview round-trips a mocked action; give a loaded pool room.
    await screen.findByRole(
      "heading",
      { level: 2, name: en.preview.title },
      { timeout: 5000 },
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("changes the title text while a file is dragged over the zone", () => {
    renderForm();

    fireEvent.dragEnter(zone(), { dataTransfer: { files: [] } });

    expect(screen.getByText(en.upload.dropActive)).toBeInTheDocument();
    expect(screen.queryByText(en.upload.dropTitle)).toBeNull();
  });

  it("names the file being analysed and disables the picker meanwhile", async () => {
    let finish!: (state: ApplyState) => void;
    previewAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderForm();

    drop(WORKBOOK);

    const status = await screen.findByText(
      en.upload.analysing.replace("{name}", "catalogo.xlsx"),
    );
    expect(status).toHaveAttribute("role", "status");
    expect(
      screen.getByRole("button", { name: en.upload.choose }),
    ).toBeDisabled();
    // A second file is not queued behind the running analysis.
    drop(SECOND);
    expect(previewAction).toHaveBeenCalledTimes(1);

    // An unsettled action would keep React's transition queue busy for the
    // tests that follow.
    await act(async () => finish(PREVIEW));
    expect(
      screen.getByRole("button", { name: en.upload.change }),
    ).toBeEnabled();
    expect(
      screen.getByText(/catalogo\.xlsx.*KB/, { selector: '[role="status"]' }),
    ).toBeInTheDocument();
  });

  it("moves focus to the preview heading and scrolls it into view, once", async () => {
    const user = await previewWorkbook();

    const heading = await screen.findByRole("heading", {
      level: 2,
      name: en.preview.title,
    });
    expect(heading).toHaveAttribute("tabindex", "-1");
    // Focus moves in an effect: await it instead of reading it synchronously.
    await waitFor(() => expect(heading).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(scrollIntoView.mock.contexts[0]).toBe(heading);
    // A clean preview has no warning block.
    expect(screen.queryByRole("region", { name: /errors? found/i })).toBeNull();
    expect(
      screen.queryByRole("table", { name: en.errorsPanel.caption }),
    ).toBeNull();

    // A re-render that brings no new state must not steal focus again.
    await user.tab();
    fireEvent.dragEnter(zone(), { dataTransfer: { files: [] } });
    expect(heading).not.toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("hides the previous preview while a new file is analysed", async () => {
    await previewWorkbook();
    await screen.findByRole("button", { name: en.preview.confirm });

    let answer!: (state: PreviewArm) => void;
    previewAction.mockImplementationOnce(
      () => new Promise<PreviewArm>((resolve) => (answer = resolve)),
    );
    drop(SECOND);
    await waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2));

    // The counts on screen belong to the first file: showing them under the
    // second file's name would describe a workbook nobody analysed.
    expect(
      screen.queryByRole("heading", { level: 2, name: en.preview.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.preview.confirm }),
    ).not.toBeInTheDocument();

    await act(async () => answer(PREVIEW));
    expect(
      await screen.findByRole("button", { name: en.preview.confirm }),
    ).toBeInTheDocument();
  });

  it("replaces the kept file when a new one is taken over a preview", async () => {
    const user = await previewWorkbook();
    await screen.findByRole("button", { name: en.preview.confirm });

    drop(SECOND);
    await waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2));
    expect(
      (previewAction.mock.calls[1][1] as FormData).get("file"),
    ).toHaveProperty("name", "segundo.xlsx");
    await screen.findByText(en.preview.file.replace("{name}", "segundo.xlsx"));

    await user.click(screen.getByRole("button", { name: en.preview.confirm }));

    expect(applyAction).toHaveBeenCalledTimes(1);
    const file = (applyAction.mock.calls[0][1] as FormData).get("file") as File;
    expect(file.name).toBe("segundo.xlsx");
    expect(file.size).toBe(SECOND.size);
  });

  it("keeps the previewed file for confirm when a later file is rejected on the spot", async () => {
    const user = await previewWorkbook();
    await screen.findByRole("button", { name: en.preview.confirm });

    drop(new File(["a,b"], "catalogo.csv", { type: "text/csv" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      en.errors.wrongExtension,
    );

    await user.click(screen.getByRole("button", { name: en.preview.confirm }));

    const sent = applyAction.mock.calls[0][1] as FormData;
    expect((sent.get("file") as File).name).toBe("catalogo.xlsx");
    expect(sent.get("fileSha256")).toBe(HASH);
  });
});

describe("ImportForm flow (preview, then confirm)", () => {
  it("sends the chosen file to the preview action with no previous state", async () => {
    await previewWorkbook();

    expect(
      await screen.findByRole("heading", { level: 2, name: en.preview.title }),
    ).toBeInTheDocument();
    expect(previewAction).toHaveBeenCalledTimes(1);
    const [prev, sent] = previewAction.mock.calls[0] as [unknown, FormData];
    expect(prev).toEqual({ kind: "idle" });
    const file = sent.get("file") as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("catalogo.xlsx");
    expect(applyAction).not.toHaveBeenCalled();
  });

  it("re-submits the same file with the hidden digest when confirming", async () => {
    const user = await previewWorkbook();
    await screen.findByRole("button", { name: en.preview.confirm });

    await user.click(screen.getByRole("button", { name: en.preview.confirm }));

    expect(applyAction).toHaveBeenCalledTimes(1);
    const [prev, sent] = applyAction.mock.calls[0] as [unknown, FormData];
    expect(prev).toEqual({ kind: "idle" });
    expect(sent.get("fileSha256")).toBe(HASH);
    const file = sent.get("file") as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("catalogo.xlsx");
    expect(file.size).toBe(WORKBOOK.size);
  });

  it("shows the summary and the credentials download after the apply", async () => {
    const user = await previewWorkbook();
    await user.click(
      await screen.findByRole("button", { name: en.preview.confirm }),
    );

    expect(
      await screen.findByRole("heading", { level: 2, name: en.result.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.credentials.download }),
    ).toHaveAttribute("href", "blob:form-1");
    expect(
      screen.queryByRole("button", { name: en.preview.confirm }),
    ).toBeNull();
  });

  it("never sends the applied state (credentials) back to the server", async () => {
    const user = await previewWorkbook();
    await user.click(
      await screen.findByRole("button", { name: en.preview.confirm }),
    );
    await screen.findByRole("heading", { level: 2, name: en.result.title });

    await user.upload(screen.getByLabelText(en.upload.dropTitle), WORKBOOK);

    await waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2));
    expect(previewAction.mock.calls[1][0]).toEqual({ kind: "idle" });
    expect(JSON.stringify(previewAction.mock.calls)).not.toContain(
      "ZK9TQ2M4XW7HB3PD",
    );
    await screen.findByRole("heading", { level: 2, name: en.preview.title });
  });

  it("shows a fresh preview when the apply answers with one (digest mismatch)", async () => {
    const fresh: PreviewArm = { ...PREVIEW, fileSha256: "d".repeat(64) };
    applyAction.mockResolvedValue(fresh);
    const user = await previewWorkbook();
    await user.click(
      await screen.findByRole("button", { name: en.preview.confirm }),
    );

    await waitFor(() =>
      expect(document.querySelector('input[name="fileSha256"]')).toHaveValue(
        "d".repeat(64),
      ),
    );
    expect(screen.queryByRole("heading", { name: en.result.title })).toBeNull();
  });

  it("keeps the preview and the confirm control when the catalog is busy, and a retry applies (CEI-BUSY)", async () => {
    applyAction.mockResolvedValueOnce({ kind: "busy" });
    const user = await previewWorkbook();
    await user.click(
      await screen.findByRole("button", { name: en.preview.confirm }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(en.preview.busy);
    expect(
      screen.getByRole("heading", { level: 2, name: en.preview.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: en.result.title })).toBeNull();

    // The same file and digest go out again: the screen kept them.
    await user.click(screen.getByRole("button", { name: en.preview.confirm }));
    expect(
      await screen.findByRole("heading", { level: 2, name: en.result.title }),
    ).toBeInTheDocument();
    expect(applyAction).toHaveBeenCalledTimes(2);
    const retry = applyAction.mock.calls[1][1] as FormData;
    expect(retry.get("fileSha256")).toBe(HASH);
    expect((retry.get("file") as File).name).toBe("catalogo.xlsx");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces a failure, ties it to the file input and offers no confirm", async () => {
    previewAction.mockResolvedValue({
      kind: "error",
      message: en.errors.wrongExtension,
    });
    await previewWorkbook();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.errors.wrongExtension);
    const input = screen.getByLabelText(en.upload.dropTitle);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
    expect(
      screen.queryByRole("button", { name: en.preview.confirm }),
    ).toBeNull();
  });

  it("works in Spanish end to end", async () => {
    const user = await previewWorkbook("es");

    expect(
      await screen.findByRole("heading", { level: 2, name: es.preview.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: es.upload.change }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: es.preview.confirm }));
    expect(
      await screen.findByRole("heading", { level: 2, name: es.result.title }),
    ).toBeInTheDocument();
  });
});

describe("ImportForm warning block (CEI: Preview with errors blocks confirmation)", () => {
  const ONE: RowError[] = [
    { sheet: "Grupos", row: 4, reason: "periodo.invalid", value: "2026-S3" },
  ];
  const SEVERAL: RowError[] = [
    ...ONE,
    { sheet: "Docentes", row: 9, reason: "correo.duplicate" },
  ];
  const failing = (errors: RowError[]): PreviewArm => ({ ...PREVIEW, errors });

  it.each([
    ["en", ONE, "1 error found in the workbook"],
    ["en", SEVERAL, "2 errors found in the workbook"],
    ["es", ONE, "Se encontró 1 error en el libro"],
    ["es", SEVERAL, "Se encontraron 2 errores en el libro"],
  ] as const)(
    "counts the errors in the warning heading, in %s (%#)",
    async (locale, errors, title) => {
      const copy = locale === "en" ? en : es;
      previewAction.mockResolvedValue(failing([...errors]));
      await previewWorkbook(locale);

      const block = await screen.findByRole("region", { name: title });
      expect(
        within(block).getByRole("heading", { level: 2, name: title }),
      ).toBeInTheDocument();
      expect(
        within(block).getByText(copy.errorsPanel.help),
      ).toBeInTheDocument();
    },
  );

  it("places the warning block after the structure card and before the preview", async () => {
    previewAction.mockResolvedValue(failing(SEVERAL));
    await previewWorkbook();

    const block = await screen.findByRole("region", {
      name: "2 errors found in the workbook",
    });
    const contract = screen.getByRole("region", { name: en.contract.title });
    const preview = screen.getByRole("region", { name: en.preview.title });

    expect(contract.nextElementSibling).toBe(block);
    expect(block.nextElementSibling).toBe(preview);
    expect(contract).not.toContainElement(block);
    expect(preview).not.toContainElement(block);
  });

  it("lists sheet, row and translated reason, and offers no confirm", async () => {
    previewAction.mockResolvedValue(failing(SEVERAL));
    const { container } = renderForm();
    drop(WORKBOOK);

    const table = await screen.findByRole("table", {
      name: en.errorsPanel.caption,
    });
    const rows = within(table)
      .getAllByRole("row")
      .map((row) =>
        Array.from(row.querySelectorAll("th, td")).map(
          (cell) => cell.textContent,
        ),
      );
    expect(rows.slice(1)).toEqual([
      ["Grupos", "4", en.reasons.periodo.invalid, "2026-S3"],
      ["Docentes", "9", en.reasons.correo.duplicate, ""],
    ]);
    // The preview still reports the counts.
    expect(
      screen.getByRole("table", { name: en.preview.countsCaption }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: en.preview.confirm }),
    ).toBeNull();
    expect(container.querySelector('[type="submit"]')).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(document.querySelector('input[name="fileSha256"]')).toBeNull();
    expect(applyAction).not.toHaveBeenCalled();
    expect(container.innerHTML).not.toContain("is-current");
  });

  it("moves focus to the warning heading instead of the preview heading, once", async () => {
    previewAction.mockResolvedValue(failing(SEVERAL));
    const user = await previewWorkbook();

    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "2 errors found in the workbook",
    });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading).toHaveFocus();
    expect(heading.className).toContain("scroll-mt-20");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(scrollIntoView.mock.contexts[0]).toBe(heading);
    expect(
      screen.getByRole("heading", { level: 2, name: en.preview.title }),
    ).not.toHaveFocus();

    // A re-render that brings no new state must not steal focus again.
    await user.tab();
    fireEvent.dragEnter(zone(), { dataTransfer: { files: [] } });
    expect(heading).not.toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("hides the previous warning block and preview while a new file is analysed", async () => {
    previewAction.mockResolvedValue(failing(SEVERAL));
    await previewWorkbook();
    await screen.findByRole("table", { name: en.errorsPanel.caption });

    let answer!: (state: PreviewArm) => void;
    previewAction.mockImplementationOnce(
      () => new Promise<PreviewArm>((resolve) => (answer = resolve)),
    );
    drop(SECOND);
    await waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2));

    // Those errors belong to the first file, not to the one being analysed.
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "2 errors found in the workbook",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: en.errorsPanel.caption }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: en.preview.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: en.preview.countsCaption }),
    ).not.toBeInTheDocument();

    // The corrected file comes back clean: no warning, and confirm is offered.
    await act(async () => answer(PREVIEW));
    expect(
      await screen.findByRole("button", { name: en.preview.confirm }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: en.errorsPanel.caption }),
    ).toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: en.preview.title }),
    ).toHaveFocus();
  });

  it("keeps heading levels in order: one h2 per block under the page title", async () => {
    previewAction.mockResolvedValue(failing(ONE));
    await previewWorkbook();
    await screen.findByRole("table", { name: en.errorsPanel.caption });

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      en.contract.title,
      "1 error found in the workbook",
      en.preview.title,
    ]);
    expect(screen.queryByRole("heading", { level: 4 })).toBeNull();
  });
});
