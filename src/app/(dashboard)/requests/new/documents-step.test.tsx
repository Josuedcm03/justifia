import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderIntl,
  stubObjectUrls,
} from "@/app/(dashboard)/requests/new/test-support";
import { MAX_DOCUMENT_BYTES } from "@/lib/intake/limits";

const { upload, finalizeDocumentAction, removeDocumentAction, refresh } =
  vi.hoisted(() => ({
    upload: vi.fn(),
    finalizeDocumentAction: vi.fn(),
    removeDocumentAction: vi.fn(),
    refresh: vi.fn(),
  }));

vi.mock("@vercel/blob/client", () => ({ upload }));
vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  finalizeDocumentAction,
  removeDocumentAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DocumentsStep } from "@/app/(dashboard)/requests/new/documents-step";

const DOC = (id: number, nombreOriginal: string, tamanoBytes = 2048) => ({
  id,
  nombreOriginal,
  tipo: "pdf",
  tamanoBytes,
});

function ui(documents: ReturnType<typeof DOC>[] = [], fromReview = false) {
  return (
    <DocumentsStep draftId={42} documents={documents} fromReview={fromReview} />
  );
}

const PDF = new File(["%PDF-1.7"], "justificante.pdf", {
  type: "application/pdf",
});
const input = () => screen.getByLabelText("Adjuntar documento");

// The picker's `accept` would hide the files these tests need to reject.
const user = () => userEvent.setup({ applyAccept: false });

function fileOfSize(name: string, type: string, size: number) {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

beforeEach(() => {
  for (const mock of [upload, finalizeDocumentAction, removeDocumentAction]) {
    mock.mockReset();
  }
  refresh.mockReset();
  upload.mockResolvedValue({});
  finalizeDocumentAction.mockResolvedValue({ ok: true, documentId: 9 });
  removeDocumentAction.mockResolvedValue({ ok: true });
});

describe("DocumentsStep: what is shown (RF-02, D12)", () => {
  it("explains the limits and says nothing is attached yet", () => {
    renderIntl(ui());
    expect(
      screen.getByRole("heading", { level: 2, name: "Documentos de respaldo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("PDF, PNG o JPEG de hasta 10 MB. Máximo 5 documentos."),
    ).toBeInTheDocument();
    expect(screen.getByText("0 de 5 documentos")).toBeInTheDocument();
    expect(
      screen.getByText("Aún no has adjuntado documentos."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Adjuntar documento" }),
    ).toBeEnabled();
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/new?step=2",
    );
  });

  it("links each document to its inline view in a new tab", () => {
    renderIntl(ui([DOC(5, "receta.pdf"), DOC(6, "foto.png")]));
    const view = screen.getByRole("link", { name: "Ver receta.pdf" });
    expect(view).toHaveAttribute("href", "/api/intake/documents/5");
    expect(view).toHaveAttribute("target", "_blank");
    expect(view).toHaveAttribute("rel", "noopener noreferrer");
    expect(view).toHaveTextContent("Ver");
    expect(screen.getByRole("link", { name: "Ver foto.png" })).toHaveAttribute(
      "href",
      "/api/intake/documents/6",
    );
  });

  it("goes back to the review, not the subjects, when opened from it", () => {
    renderIntl(ui([], true));
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/new?step=4",
    );
  });

  it("continues to the review step (4) even before a document is attached", () => {
    renderIntl(ui());
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      "/requests/new?step=4",
    );
  });

  it("offers the same continue link with documents attached, in English", () => {
    renderIntl(ui([DOC(7, "receta.pdf")]), "en");
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/requests/new?step=4",
    );
  });

  it("lists the attached documents with name, size and a remove button", () => {
    renderIntl(ui([DOC(7, "receta.pdf", 2048), DOC(8, "foto.png", 3_145_728)]));
    expect(screen.getByText("2 de 5 documentos")).toBeInTheDocument();
    expect(screen.getByText("receta.pdf")).toBeInTheDocument();
    expect(screen.getByText("2,0 KB")).toBeInTheDocument();
    expect(screen.getByText("3,0 MB")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quitar receta.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quitar foto.png" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Aún no has adjuntado documentos.")).toBeNull();
  });

  it("blocks adding past five and says why (D12)", () => {
    renderIntl(ui([1, 2, 3, 4, 5].map((i) => DOC(i, `d${i}.pdf`))));
    expect(
      screen.getByRole("button", { name: "Adjuntar documento" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ya adjuntaste el máximo de 5 documentos. Quita uno para subir otro.",
    );
  });
});

describe("DocumentsStep: upload then finalize (D2, D3)", () => {
  it("uploads straight to the store under the draft prefix, then finalizes", async () => {
    renderIntl(ui());
    await user().upload(input(), PDF);

    await waitFor(() => expect(finalizeDocumentAction).toHaveBeenCalled());
    const [pathname, file, options] = upload.mock.calls[0];
    expect(pathname).toMatch(/^intake\/42\/[0-9a-f-]{36}\.pdf$/);
    expect(file).toBe(PDF);
    expect(options).toEqual({
      access: "private",
      handleUploadUrl: "/api/intake/upload-token",
      contentType: "application/pdf",
    });
    // The server learns the path and the original name, never the bytes.
    expect(finalizeDocumentAction).toHaveBeenCalledWith({
      pathname,
      nombreOriginal: "justificante.pdf",
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["image/png", "foto.png", "png"],
    ["image/jpeg", "foto.jpg", "jpeg"],
  ])("names a %s upload with the %s extension", async (type, name, ext) => {
    renderIntl(ui());
    await user().upload(input(), new File(["x"], name, { type }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(upload.mock.calls[0][0]).toMatch(
      new RegExp(`^intake/42/[0-9a-f-]{36}\\.${ext}$`),
    );
  });

  it("shows progress and locks the button while uploading", async () => {
    let finish: (value: object) => void = () => {};
    upload.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderIntl(ui());
    await user().upload(input(), PDF);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Subiendo justificante.pdf…",
    );
    expect(
      screen.getByRole("button", { name: "Adjuntar documento" }),
    ).toBeDisabled();

    finish({});
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: "Adjuntar documento" }),
    ).toBeEnabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it.each([
    ["unsupported_format", "Formato no admitido. Sube un PDF, PNG o JPEG."],
    ["too_large", "El archivo supera los 10 MB."],
    ["empty_file", "El archivo está vacío."],
    ["not_found", "No encontramos el archivo. Inténtalo de nuevo."],
    ["not_allowed", "No tienes permiso para esta operación."],
    [
      "too_many_documents",
      "Ya adjuntaste el máximo de 5 documentos. Quita uno para subir otro.",
    ],
  ])(
    "states the %s reason from the server and lets the student retry",
    async (code, message) => {
      finalizeDocumentAction.mockResolvedValue({
        ok: false,
        errors: [{ field: "documents", key: `intake.errors.${code}` }],
      });
      renderIntl(ui());
      await user().upload(input(), PDF);

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(
        screen.getByRole("button", { name: "Adjuntar documento" }),
      ).toBeEnabled();

      // A retry starts clean.
      finalizeDocumentAction.mockResolvedValue({ ok: true, documentId: 3 });
      await user().upload(input(), PDF);
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    },
  );

  it("reports a failed upload and does not finalize", async () => {
    upload.mockRejectedValue(new Error("Failed to retrieve the client token"));
    renderIntl(ui());
    await user().upload(input(), PDF);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo subir el archivo. Inténtalo de nuevo.",
    );
    expect(finalizeDocumentAction).not.toHaveBeenCalled();
    // The server may know better (expired draft, pending slots): re-read it.
    expect(refresh).toHaveBeenCalled();
  });
});

describe("DocumentsStep: refused before any upload (RN-04)", () => {
  it.each([
    [
      new File(["<html>"], "page.html", { type: "text/html" }),
      "Formato no admitido. Sube un PDF, PNG o JPEG.",
    ],
    [
      new File([], "vacio.pdf", { type: "application/pdf" }),
      "El archivo está vacío.",
    ],
    [
      fileOfSize("grande.pdf", "application/pdf", MAX_DOCUMENT_BYTES + 1),
      "El archivo supera los 10 MB.",
    ],
  ])(
    "%#: shows the reason without touching the store",
    async (file, message) => {
      renderIntl(ui());
      await user().upload(input(), file);

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(upload).not.toHaveBeenCalled();
      expect(finalizeDocumentAction).not.toHaveBeenCalled();
    },
  );

  it("accepts a file of exactly the maximum size", async () => {
    renderIntl(ui());
    await user().upload(
      input(),
      fileOfSize("justo.pdf", "application/pdf", MAX_DOCUMENT_BYTES),
    );
    await waitFor(() => expect(upload).toHaveBeenCalled());
  });
});

describe("DocumentsStep: remove", () => {
  it("removes by id and re-reads the draft", async () => {
    renderIntl(ui([DOC(7, "receta.pdf"), DOC(8, "foto.png")]));
    await userEvent.click(
      screen.getByRole("button", { name: "Quitar foto.png" }),
    );

    await waitFor(() => expect(removeDocumentAction).toHaveBeenCalledWith(8));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows why a removal failed", async () => {
    removeDocumentAction.mockResolvedValue({
      ok: false,
      errors: [{ field: "documents", key: "intake.errors.not_found" }],
    });
    renderIntl(ui([DOC(7, "receta.pdf")]));
    await userEvent.click(
      screen.getByRole("button", { name: "Quitar receta.pdf" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos el archivo. Inténtalo de nuevo.",
    );
  });
});

describe("DocumentsStep: English", () => {
  it("labels the controls in English", () => {
    renderIntl(ui([DOC(7, "receta.pdf")]), "en");
    expect(screen.getByText("1 of 5 documents")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove receta.pdf" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument();
  });
});

describe("DocumentsStep inside another flow (the correction)", () => {
  const finalizeDocument = vi.fn();
  const removeDocument = vi.fn();
  const flow = {
    basePath: "/requests/31/correct",
    actions: { finalizeDocument, removeDocument },
  };
  const correction = (documents: ReturnType<typeof DOC>[] = []) => (
    <DocumentsStep draftId={31} documents={documents} flow={flow} />
  );

  beforeEach(() => {
    finalizeDocument.mockReset().mockResolvedValue({ ok: true, documentId: 9 });
    removeDocument.mockReset().mockResolvedValue({ ok: true });
  });

  it("uploads under the returned request's prefix and finalizes through the flow", async () => {
    renderIntl(correction());

    await user().upload(input(), PDF);

    await waitFor(() => expect(finalizeDocument).toHaveBeenCalledTimes(1));
    const [pathname] = upload.mock.calls[0];
    expect(pathname).toMatch(/^intake\/31\/[0-9a-f-]{36}\.pdf$/);
    expect(finalizeDocument).toHaveBeenCalledWith({
      pathname,
      nombreOriginal: "justificante.pdf",
    });
    expect(finalizeDocumentAction).not.toHaveBeenCalled();
  });

  it("removes through the flow's action", async () => {
    renderIntl(correction([DOC(7, "receta.pdf")]));

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar receta.pdf" }),
    );

    await waitFor(() => expect(removeDocument).toHaveBeenCalledWith(7));
    expect(removeDocumentAction).not.toHaveBeenCalled();
  });

  it("links back and on under the flow's path", () => {
    renderIntl(correction());
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/31/correct?step=2",
    );
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      "/requests/31/correct?step=4",
    );
  });
});

// FE-17, RF-08 (a): a file attached during this visit can be previewed from
// the copy the browser holds. Nothing here may read the document route.
describe("DocumentsStep: local preview of a file attached in this visit (FE-17)", () => {
  const PNG = new File(["png"], "foto.png", { type: "image/png" });
  const view = (name: string) => screen.queryByRole("link", { name });
  const previewButton = (name: string, open = false) =>
    screen.getByRole("button", {
      name: `${open ? "Ocultar vista previa de" : "Vista previa de"} ${name}`,
    });
  // The row's name also has the file name as its title, so pick the iframe.
  const maybeFrame = () =>
    screen
      .queryAllByTitle("justificante.pdf")
      .find((element) => element.tagName === "IFRAME") ?? null;
  const frame = () => {
    const found = maybeFrame();
    if (!found) throw new Error("no preview iframe is mounted");
    return found;
  };
  let urls: ReturnType<typeof stubObjectUrls>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    urls = stubObjectUrls();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Attach `file` as document 9, then show the list the refresh would bring. */
  async function attached(file = PDF, extra: ReturnType<typeof DOC>[] = []) {
    const shown = renderIntl(ui(extra));
    await user().upload(input(), file);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    shown.rerender(ui([...extra, DOC(9, file.name)]));
    return shown;
  }

  it("offers the preview, closed, instead of Ver for the file just attached", async () => {
    await attached();

    const toggle = previewButton("justificante.pdf");
    expect(toggle).toHaveTextContent("Vista previa");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(view("Ver justificante.pdf")).toBeNull();
    expect(maybeFrame()).toBeNull();
    expect(urls.createObjectURL).not.toHaveBeenCalled();
  });

  it("opens an iframe for a PDF from the chosen file, with the hint", async () => {
    await attached();
    await userEvent.click(previewButton("justificante.pdf"));

    const toggle = previewButton("justificante.pdf", true);
    expect(toggle).toHaveTextContent("Ocultar vista previa");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const preview = frame();
    expect(preview.getAttribute("src")).toBe("blob:preview-1");
    expect(urls.createObjectURL).toHaveBeenCalledWith(PDF);
    const panel = document.getElementById(
      toggle.getAttribute("aria-controls") ?? "",
    );
    expect(panel).toContainElement(preview);
    expect(
      screen.getByText(
        "Comprueba que este es el documento correcto antes de continuar.",
      ),
    ).toBeInTheDocument();
  });

  it("opens an img for a PNG", async () => {
    await attached(PNG);
    await userEvent.click(previewButton("foto.png"));

    expect(screen.getByRole("img", { name: "foto.png" })).toHaveAttribute(
      "src",
      "blob:preview-1",
    );
  });

  it("unmounts the panel and revokes the URL when it is closed", async () => {
    await attached();
    await userEvent.click(previewButton("justificante.pdf"));
    await userEvent.click(previewButton("justificante.pdf", true));

    expect(maybeFrame()).toBeNull();
    expect(previewButton("justificante.pdf")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(urls.revokeObjectURL.mock.calls).toEqual([["blob:preview-1"]]);
  });

  it("opens each row on its own", async () => {
    const shown = await attached(PDF);
    await userEvent.click(previewButton("justificante.pdf"));
    finalizeDocumentAction.mockResolvedValue({ ok: true, documentId: 10 });
    await user().upload(input(), PNG);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    shown.rerender(ui([DOC(9, "justificante.pdf"), DOC(10, "foto.png")]));

    expect(previewButton("justificante.pdf", true)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(previewButton("foto.png")).toHaveAttribute("aria-expanded", "false");
  });

  it("reads nothing from the server to preview: no fetch, no document route", async () => {
    const { container } = await attached();
    await userEvent.click(previewButton("justificante.pdf"));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.innerHTML).not.toContain("/api/intake/documents/9");
  });

  it("revokes the URL and drops the file when the document is removed", async () => {
    const { rerender } = await attached();
    await userEvent.click(previewButton("justificante.pdf"));

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar justificante.pdf" }),
    );
    await waitFor(() => expect(removeDocumentAction).toHaveBeenCalledWith(9));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));

    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    // The entry is gone: the same id, shown again, has no local file to preview.
    rerender(ui([DOC(9, "justificante.pdf")]));
    expect(screen.queryByRole("button", { name: /vista previa/i })).toBeNull();
    expect(view("Ver justificante.pdf")).toHaveAttribute(
      "href",
      "/api/intake/documents/9",
    );
  });

  it("keeps the preview when the removal fails", async () => {
    removeDocumentAction.mockResolvedValue({
      ok: false,
      errors: [{ field: "documents", key: "intake.errors.not_found" }],
    });
    await attached();
    await userEvent.click(previewButton("justificante.pdf"));

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar justificante.pdf" }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(frame()).toBeInTheDocument();
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revokes the open URL when the step unmounts", async () => {
    const { unmount } = await attached();
    await userEvent.click(previewButton("justificante.pdf"));

    unmount();

    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
  });

  it("keeps Ver, and offers no preview, for a document stored before this visit", async () => {
    await attached(PDF, [DOC(5, "receta.pdf")]);

    expect(view("Ver receta.pdf")).toHaveAttribute(
      "href",
      "/api/intake/documents/5",
    );
    expect(
      screen.queryByRole("button", { name: "Vista previa de receta.pdf" }),
    ).toBeNull();
    expect(previewButton("justificante.pdf")).toBeInTheDocument();
  });

  it("offers no preview, and shows the rejection, for a file that finalize rejects", async () => {
    finalizeDocumentAction.mockResolvedValue({
      ok: false,
      errors: [{ field: "documents", key: "intake.errors.unsupported_format" }],
    });
    const exe = new File(["MZ"], "scan.pdf", { type: "application/pdf" });
    const { rerender } = renderIntl(ui());
    await user().upload(input(), exe);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Formato no admitido. Sube un PDF, PNG o JPEG.",
    );
    // Even if a row with the id finalize never returned showed up, no file is held.
    rerender(ui([DOC(9, "scan.pdf")]));
    expect(screen.queryByRole("button", { name: /vista previa/i })).toBeNull();
    expect(urls.createObjectURL).not.toHaveBeenCalled();
  });

  it("offers no preview when finalize returns no document id", async () => {
    finalizeDocumentAction.mockResolvedValue({ ok: true });
    const { rerender } = renderIntl(ui());
    await user().upload(input(), PDF);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    rerender(ui([DOC(9, "justificante.pdf")]));

    expect(screen.queryByRole("button", { name: /vista previa/i })).toBeNull();
    expect(view("Ver justificante.pdf")).toBeInTheDocument();
  });

  it("labels the controls in English", async () => {
    const { rerender } = renderIntl(ui(), "en");
    await user().upload(screen.getByLabelText("Attach document"), PDF);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    rerender(ui([DOC(9, "justificante.pdf")]));

    await userEvent.click(
      screen.getByRole("button", { name: "Preview of justificante.pdf" }),
    );

    expect(
      screen.getByRole("button", { name: "Hide preview of justificante.pdf" }),
    ).toHaveTextContent("Hide preview");
    expect(
      screen.getByText(
        "Check that this is the right document before you continue.",
      ),
    ).toBeInTheDocument();
  });

  it("previews a file attached through the correction flow too", async () => {
    const finalizeDocument = vi
      .fn()
      .mockResolvedValue({ ok: true, documentId: 9 });
    const flow = {
      basePath: "/requests/31/correct",
      actions: { finalizeDocument, removeDocument: vi.fn() },
    };
    const correction = (documents: ReturnType<typeof DOC>[] = []) => (
      <DocumentsStep draftId={31} documents={documents} flow={flow} />
    );
    const { rerender } = renderIntl(correction());
    await user().upload(input(), PDF);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    rerender(correction([DOC(9, "justificante.pdf")]));

    await userEvent.click(previewButton("justificante.pdf"));

    expect(frame().getAttribute("src")).toBe("blob:preview-1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sets no fixed width on the open panel (360 px)", async () => {
    const { container } = await attached();
    await userEvent.click(previewButton("justificante.pdf"));

    expect(container.innerHTML).not.toMatch(/\b(?:min-)?w-\[\d+(?:px|rem)\]/);
  });
});
