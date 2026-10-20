import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

const { uploadMock, attachMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  attachMock: vi.fn(),
}));
vi.mock("@vercel/blob/client", () => ({ upload: uploadMock }));
vi.mock("@/app/(dashboard)/review/[id]/remission-actions", () => ({
  attachSpecialFormatAction: attachMock,
}));

import { SpecialFormatUpload } from "@/app/(dashboard)/review/[id]/special-format-upload";
import { MAX_DOCUMENT_BYTES } from "@/lib/intake/limits";

const en = messages.en.review.remission.upload;
const es = messages.es.review.remission.upload;
const PATHNAME = /^intake\/12\/[0-9a-f-]{36}\.pdf$/;

function pdf(name = "formato.pdf", size = 2048) {
  const file = new File(["%PDF-1.7"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function show(
  attached: { id: number; nombreOriginal: string } | null = null,
  locale: "en" | "es" = "en",
) {
  return renderIntl(
    <SpecialFormatUpload solicitudId={12} attached={attached} />,
    locale,
  );
}

function picker(): HTMLInputElement {
  return screen.getByLabelText(en.action) as HTMLInputElement;
}

// An upload that never finishes; released so later transitions are not stalled.
const hanging: Array<() => void> = [];

beforeEach(() => {
  uploadMock.mockReset().mockResolvedValue({});
  attachMock
    .mockReset()
    .mockResolvedValue({ ok: true, documentId: 21, remisionIds: [5] });
});

afterEach(() => {
  for (const release of hanging.splice(0)) release();
});

describe("SpecialFormatUpload (RN-19)", () => {
  it("offers one large upload button and a hint with the size limit", () => {
    show();

    expect(screen.getByRole("button", { name: en.action })).toBeEnabled();
    expect(picker().accept).toBe("application/pdf,image/png,image/jpeg");
    expect(screen.getByText(/up to 10 MB/)).toBeInTheDocument();
  });

  it("uploads to the token route under intake/{id}/, then attaches the stored file", async () => {
    show();

    await userEvent.upload(picker(), pdf());

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [pathname, file, options] = uploadMock.mock.calls[0];
    expect(pathname).toMatch(PATHNAME);
    expect(file.name).toBe("formato.pdf");
    expect(options).toEqual({
      access: "private",
      handleUploadUrl: "/api/review/special-format-token",
      contentType: "application/pdf",
    });
    expect(attachMock).toHaveBeenCalledWith(12, {
      pathname,
      nombreOriginal: "formato.pdf",
    });
  });

  it("shows progress while uploading and keeps the control disabled", async () => {
    uploadMock.mockReturnValue(
      new Promise<void>((resolve) => hanging.push(resolve)),
    );
    show();

    await userEvent.upload(picker(), pdf());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Uploading formato.pdf...",
    );
    expect(screen.getByRole("button", { name: en.action })).toBeDisabled();
  });

  it("after success names the format with its download link, says sending is in progress and removes the control", async () => {
    show();

    await userEvent.upload(picker(), pdf());

    expect(await screen.findByRole("status")).toHaveTextContent(en.sending);
    const link = screen.getByRole("link", { name: "formato.pdf" });
    expect(link).toHaveAttribute("href", "/api/intake/documents/21");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["an empty file", pdf("a.pdf", 0), "empty_file"],
    ["a file over 10 MB", pdf("a.pdf", MAX_DOCUMENT_BYTES + 1), "too_large"],
    [
      "a type that is not allowed",
      new File(["x"], "a.exe", { type: "application/x-msdownload" }),
      "unsupported_format",
    ],
  ] as const)(
    "refuses %s before uploading and says why",
    async (_label, file, code) => {
      show();

      await userEvent
        .setup({ applyAccept: false })
        .upload(picker(), file as File);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        en.errors[code],
      );
      expect(uploadMock).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: en.action })).toBeEnabled();
    },
  );

  it.each([
    "already_attached",
    "not_allowed",
    "unexpected",
    "unsupported_format",
  ] as const)(
    "shows the %s answer of the server as an alert and keeps the control",
    async (reason) => {
      attachMock.mockResolvedValue({ ok: false, reason });
      show();

      await userEvent.upload(picker(), pdf());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        en.errors[reason],
      );
      expect(screen.getByRole("button", { name: en.action })).toBeEnabled();
    },
  );

  it("says the upload failed, and attaches nothing, when the store refuses the token", async () => {
    uploadMock.mockRejectedValue(new Error("Vercel Blob: not allowed"));
    show();

    await userEvent.upload(picker(), pdf());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.errors.upload_failed,
    );
    expect(attachMock).not.toHaveBeenCalled();
  });

  it("words its alert in Spanish too", async () => {
    attachMock.mockResolvedValue({ ok: false, reason: "already_attached" });
    show(null, "es");

    await userEvent.upload(screen.getByLabelText(es.action), pdf());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.errors.already_attached,
    );
  });

  it("shows an already attached format by name with its link and no way to replace or remove it", () => {
    show({ id: 30, nombreOriginal: "firmado.png" });

    expect(screen.getByText(en.attached)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "firmado.png" })).toHaveAttribute(
      "href",
      "/api/intake/documents/30",
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText(en.action)).toBeNull();
  });
});
