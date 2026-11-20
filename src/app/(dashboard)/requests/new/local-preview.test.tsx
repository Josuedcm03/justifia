import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderIntl,
  stubObjectUrls,
} from "@/app/(dashboard)/requests/new/test-support";
import {
  LocalPreview,
  previewKind,
} from "@/app/(dashboard)/requests/new/local-preview";

// FE-17, RF-08 (a): the preview is made in the browser from the file the
// student chose. It reads no server route, so it can write no audit row.

const PDF = new File(["%PDF-1.7"], "justificante.pdf", {
  type: "application/pdf",
});
const PNG = new File(["png"], "foto.png", { type: "image/png" });
const EXE = new File(["MZ"], "scan.pdf", { type: "application/x-msdownload" });

function sized(file: File, size: number) {
  Object.defineProperty(file, "size", { value: size });
  return file;
}

let urls: ReturnType<typeof stubObjectUrls>;

beforeEach(() => {
  urls = stubObjectUrls();
});

describe("previewKind", () => {
  it.each([
    ["application/pdf", "pdf"],
    ["image/png", "image"],
    ["image/jpeg", "image"],
    ["image/gif", null],
    ["image/svg+xml", null],
    ["text/html", null],
    ["application/x-msdownload", null],
    ["", null],
  ])("gives %j the kind %j", (type, kind) => {
    expect(previewKind({ type })).toBe(kind);
  });
});

describe("LocalPreview: what is mounted (FE-17)", () => {
  it("mounts an iframe for a PDF, titled with the name and holding a blob URL", () => {
    const { container } = renderIntl(
      <LocalPreview file={PDF} name="justificante.pdf" />,
    );

    const frame = screen.getByTitle("justificante.pdf");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe("blob:preview-1");
    expect(urls.createObjectURL).toHaveBeenCalledTimes(1);
    expect(urls.createObjectURL).toHaveBeenCalledWith(PDF);
    expect(container.querySelector("img")).toBeNull();
  });

  it.each([
    ["image/png", "foto.png"],
    ["image/jpeg", "foto.jpg"],
  ])("mounts an img for a %s, with the name as its alt", (type, name) => {
    const { container } = renderIntl(
      <LocalPreview file={new File(["x"], name, { type })} name={name} />,
    );

    const image = screen.getByRole("img", { name });
    expect(image.getAttribute("src")).toBe("blob:preview-1");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("shows the file name and the size next to the preview", () => {
    renderIntl(
      <LocalPreview file={sized(PDF, 2048)} name="justificante.pdf" />,
    );
    expect(screen.getByText("justificante.pdf · 2,0 KB")).toBeInTheDocument();
  });

  it("formats the size in the locale of the page", () => {
    renderIntl(
      <LocalPreview file={sized(PNG, 3_145_728)} name="foto.png" />,
      "en",
    );
    expect(screen.getByText("foto.png · 3.0 MB")).toBeInTheDocument();
  });

  it("shows the name and size only, with no broken preview, for a file the browser cannot render", () => {
    const { container } = renderIntl(
      <LocalPreview file={sized(EXE, 4096)} name="scan.pdf" />,
    );

    expect(screen.getByText("scan.pdf · 4,0 KB")).toBeInTheDocument();
    expect(container.querySelector("iframe, img, object, embed")).toBeNull();
    expect(urls.createObjectURL).not.toHaveBeenCalled();
  });
});

describe("LocalPreview: object URLs are always revoked (RNF-06)", () => {
  it("revokes the exact URL it created when it unmounts", () => {
    const { unmount } = renderIntl(
      <LocalPreview file={PDF} name="justificante.pdf" />,
    );
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();

    unmount();

    expect(urls.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
  });

  it("leaves no URL unrevoked after a StrictMode double mount", () => {
    const { unmount } = renderIntl(
      <LocalPreview file={PDF} name="justificante.pdf" />,
      "es",
      true,
    );

    // The first effect run was cleaned up before the second one began.
    expect(urls.createObjectURL).toHaveBeenCalledTimes(2);
    expect(urls.revokeObjectURL.mock.calls).toEqual([["blob:preview-1"]]);
    expect(screen.getByTitle("justificante.pdf").getAttribute("src")).toBe(
      "blob:preview-2",
    );

    unmount();

    expect(urls.revokeObjectURL.mock.calls).toEqual([
      ["blob:preview-1"],
      ["blob:preview-2"],
    ]);
  });

  it("revokes the old URL and shows the new file when the file changes", () => {
    const { rerender } = renderIntl(
      <LocalPreview file={PDF} name="justificante.pdf" />,
    );

    rerender(<LocalPreview file={PNG} name="foto.png" />);

    expect(urls.revokeObjectURL.mock.calls).toEqual([["blob:preview-1"]]);
    expect(urls.createObjectURL).toHaveBeenLastCalledWith(PNG);
  });
});

describe("LocalPreview: no server read, no route (FE-17, RNF-06)", () => {
  it("never calls fetch and never names the document route", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    for (const file of [PDF, PNG, EXE]) {
      const { container, unmount } = renderIntl(
        <LocalPreview file={file} name={file.name} />,
      );
      expect(container.innerHTML).not.toContain("/api/intake/documents/");
      unmount();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("LocalPreview: 360 px (FE-17)", () => {
  it("sets no fixed width and lets the image and the frame shrink to the row", () => {
    const { container, rerender } = renderIntl(
      <LocalPreview file={PNG} name={`${"foto-larga-".repeat(12)}.png`} />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveClass("max-w-full");
    expect(container.innerHTML).not.toMatch(/\b(?:min-)?w-\[\d+(?:px|rem)\]/);
    expect(screen.getByText(/foto-larga-/, { selector: "p" })).toHaveClass(
      "break-words",
    );

    rerender(<LocalPreview file={PDF} name="justificante.pdf" />);
    expect(container.querySelector("iframe")).toHaveClass("w-full");
  });
});
