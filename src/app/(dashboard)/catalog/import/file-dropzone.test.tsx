import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import {
  FileDropzone,
  formatFileSize,
} from "@/app/(dashboard)/catalog/import/file-dropzone";
import { MAX_FILE_BYTES } from "@/lib/import/limits";

const en = enMessages.catalog.import.upload;
const es = esMessages.catalog.import.upload;

const WORKBOOK = new File(["PK-bytes"], "catalogo.xlsx");
const OTHER = new File(["PK-other"], "otro.xlsx");

type Props = ComponentProps<typeof FileDropzone>;

function renderZone(props: Partial<Props> = {}, locale: "en" | "es" = "en") {
  const onFile = vi.fn();
  const view = render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : esMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <FileDropzone
        phase="idle"
        file={null}
        error={null}
        onFile={onFile}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onFile, ...view };
}

const zone = () => screen.getByTestId("import-dropzone");
const hint = (copy: typeof en) =>
  copy.fileHint.replace("{size}", String(MAX_FILE_BYTES / 1024 / 1024));

describe("FileDropzone idle state", () => {
  it.each([
    ["en", en],
    ["es", es],
  ] as const)(
    "labels a hidden .xlsx file input with the zone title in %s",
    (locale, copy) => {
      renderZone({}, locale);

      const input = screen.getByLabelText(copy.dropTitle);
      expect(input).toHaveAttribute("type", "file");
      expect(input).toHaveAttribute("name", "file");
      expect(input).toHaveAttribute("id", "import-file");
      expect(input).toHaveAttribute("accept", ".xlsx");
      expect(input.className).toContain("sr-only");
      // The visible button is the keyboard path; the hidden input would be an
      // invisible tab stop.
      expect(input).toHaveAttribute("tabindex", "-1");
      expect(screen.getByText(hint(copy))).toBeInTheDocument();
      expect(input.getAttribute("aria-describedby")).toBe("import-file-hint");
      expect(input).not.toHaveAttribute("aria-invalid");
      expect(
        screen.getByRole("button", { name: copy.choose }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("opens the picker from the button and from the zone itself", async () => {
    const user = userEvent.setup();
    renderZone();
    const input = screen.getByLabelText(en.dropTitle) as HTMLInputElement;
    const click = vi.spyOn(input, "click");

    await user.click(screen.getByRole("button", { name: en.choose }));
    expect(click).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText(hint(en)));
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("gives the button a 44px target and never uses the current-location marker", () => {
    const { container } = renderZone();

    expect(screen.getByRole("button", { name: en.choose }).className).toContain(
      "h-11",
    );
    expect(container.innerHTML).not.toContain("is-current");
  });

  it("sits on the page surface so it reads as an inset area inside a card", () => {
    renderZone();

    expect(zone()).toHaveClass("bg-background", "border-dashed", "rounded-xl");
    expect(zone()).not.toHaveClass("bg-card");

    fireEvent.dragEnter(zone(), { dataTransfer: { files: [] } });
    expect(zone()).toHaveClass("border-primary", "bg-accent");
    expect(zone()).not.toHaveClass("bg-background");
  });
});

describe("FileDropzone taking a file", () => {
  it("hands over a dropped file", () => {
    const { onFile } = renderZone();

    fireEvent.drop(zone(), { dataTransfer: { files: [WORKBOOK] } });

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(WORKBOOK);
  });

  it("uses the first file when several are dropped", () => {
    const { onFile } = renderZone();

    fireEvent.drop(zone(), { dataTransfer: { files: [WORKBOOK, OTHER] } });

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(WORKBOOK);
  });

  it("ignores a drop that carries no file", () => {
    const { onFile } = renderZone();

    fireEvent.drop(zone(), { dataTransfer: { files: [] } });

    expect(onFile).not.toHaveBeenCalled();
  });

  it("cancels the browser default on dragover and drop", () => {
    renderZone();

    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.dragOver(zone(), { dataTransfer: { files: [] } })).toBe(
      false,
    );
    expect(
      fireEvent.drop(zone(), { dataTransfer: { files: [WORKBOOK] } }),
    ).toBe(false);
  });

  it("hands over a picked file and lets the same file be picked again", async () => {
    const user = userEvent.setup();
    const { onFile } = renderZone();
    const input = screen.getByLabelText(en.dropTitle) as HTMLInputElement;

    await user.upload(input, WORKBOOK);
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenLastCalledWith(WORKBOOK);
    expect(input.value).toBe("");

    await user.upload(input, WORKBOOK);
    expect(onFile).toHaveBeenCalledTimes(2);
  });

  it("changes the title text while a file is dragged over it", () => {
    renderZone();

    fireEvent.dragEnter(zone(), { dataTransfer: { files: [] } });
    expect(screen.getByText(en.dropActive)).toBeInTheDocument();
    expect(screen.queryByText(en.dropTitle)).toBeNull();
    expect(zone().className).toContain("border-primary");
    expect(zone().className).toContain("bg-accent");

    fireEvent.dragLeave(zone());
    expect(screen.getByText(en.dropTitle)).toBeInTheDocument();
    expect(screen.queryByText(en.dropActive)).toBeNull();
    expect(zone().className).not.toContain("border-primary");
  });

  it("returns to the idle title after the drop", () => {
    renderZone();

    fireEvent.dragEnter(zone(), { dataTransfer: { files: [] } });
    fireEvent.drop(zone(), { dataTransfer: { files: [WORKBOOK] } });

    expect(screen.getByText(en.dropTitle)).toBeInTheDocument();
  });
});

describe("FileDropzone analysing, loaded and error states", () => {
  it("announces the analysis by file name and takes no other file meanwhile", () => {
    const { onFile } = renderZone({ phase: "analysing", file: WORKBOOK });

    expect(screen.getByRole("status")).toHaveTextContent(
      en.analysing.replace("{name}", "catalogo.xlsx"),
    );
    expect(screen.getByRole("button", { name: en.choose })).toBeDisabled();

    fireEvent.dragEnter(zone(), { dataTransfer: { files: [] } });
    expect(screen.queryByText(en.dropActive)).toBeNull();
    fireEvent.drop(zone(), { dataTransfer: { files: [OTHER] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it("names the loaded file with its size and offers to change it", () => {
    const { onFile } = renderZone({ phase: "loaded", file: WORKBOOK });

    expect(screen.getByRole("status")).toHaveTextContent(
      en.selected
        .replace("{name}", "catalogo.xlsx")
        .replace("{size}", formatFileSize(WORKBOOK.size, "en")),
    );
    expect(screen.getByRole("button", { name: en.change })).toBeEnabled();
    expect(screen.queryByRole("button", { name: en.choose })).toBeNull();

    fireEvent.drop(zone(), { dataTransfer: { files: [OTHER] } });
    expect(onFile).toHaveBeenCalledWith(OTHER);
  });

  it("keeps the status line empty while idle", () => {
    renderZone();

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows the error as an alert tied to the input and the button", () => {
    renderZone({ error: "The file is not a workbook" });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The file is not a workbook");
    expect(alert).toHaveAttribute("id", "import-error");
    const input = screen.getByLabelText(en.dropTitle);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(
      "import-file-hint import-error",
    );
    expect(
      screen
        .getByRole("button", { name: en.choose })
        .getAttribute("aria-describedby"),
    ).toBe("import-file-hint import-error");
    // Directly under the zone.
    expect(zone().nextElementSibling).toBe(alert);
  });
});

describe("formatFileSize", () => {
  it("uses KB below one MB and MB above, with one decimal", () => {
    expect(formatFileSize(0, "en")).toBe("0.0 KB");
    expect(formatFileSize(1536, "en")).toBe("1.5 KB");
    expect(formatFileSize(1024 * 1024, "en")).toBe("1.0 MB");
    expect(formatFileSize(2.5 * 1024 * 1024, "en")).toBe("2.5 MB");
  });

  it("uses the locale's decimal separator", () => {
    expect(formatFileSize(1536, "es")).toBe("1,5 KB");
  });
});
