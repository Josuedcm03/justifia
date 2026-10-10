import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";
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
