import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";
import { CredentialsDownload } from "@/app/(dashboard)/catalog/import/credentials-download";
import { buildCredentialsCsv } from "@/lib/import/credentials-csv";
import type { TemporaryCredential } from "@/lib/import/types";

const CLAVE_A = "ZK9TQ2M4XW7HB3PD";
const CLAVE_B = "QW8RT5NH2KJ6MX4C";
const CREDENTIALS: TemporaryCredential[] = [
  { login: "ana.lopez@uni.edu", nombreCompleto: "Ana López", clave: CLAVE_A },
  { login: "luis.paz@uni.edu", nombreCompleto: "Luis Paz", clave: CLAVE_B },
];

// jsdom implements neither method.
const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();

beforeEach(() => {
  let n = 0;
  createObjectURL.mockReset().mockImplementation(() => `blob:cred-${++n}`);
  revokeObjectURL.mockReset();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderDownload(
  credentials: TemporaryCredential[],
  locale: "en" | "es" = "en",
  strict = false,
) {
  const tree = (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : esMessages}
    >
      <CredentialsDownload credentials={credentials} />
    </NextIntlClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("CredentialsDownload (IAP: Export accompanies the successful apply)", () => {
  it("offers the credentials as an in-memory CSV Blob that starts with the UTF-8 BOM", async () => {
    renderDownload(CREDENTIALS);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toMatch(/^text\/csv/);
    const bytes = await readBytes(blob);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text).toBe(buildCredentialsCsv(CREDENTIALS));
    expect(text).toContain(CLAVE_A);
    expect(text).toContain(CLAVE_B);
  });

  it.each([
    ["en", enMessages],
    ["es", esMessages],
  ] as const)(
    "renders a download link to the object URL, named in %s",
    (locale, messages) => {
      renderDownload(CREDENTIALS, locale);

      const link = screen.getByRole("link", {
        name: messages.catalog.import.credentials.download,
      });
      expect(link).toHaveAttribute("href", "blob:cred-1");
      expect(link.getAttribute("download")).toMatch(/\.csv$/);
    },
  );

  it("warns that the file is shown once and says how many accounts it holds", () => {
    renderDownload(CREDENTIALS);

    expect(
      screen.getByText(enMessages.catalog.import.credentials.notice),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 accounts/i)).toBeInTheDocument();
  });

  it("revokes the object URL when it unmounts", () => {
    const { unmount } = renderDownload(CREDENTIALS);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cred-1");
  });

  it("leaks no object URL under StrictMode's double effect run", () => {
    const { unmount } = renderDownload(CREDENTIALS, "en", true);

    // Mount, simulated unmount, mount again: the first URL is released and
    // the link points at the live one.
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cred-1");
    expect(screen.getByRole("link")).toHaveAttribute("href", "blob:cred-2");

    unmount();
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:cred-2");
  });
});

describe("CredentialsDownload keeps credentials in memory only (D9)", () => {
  it("makes no request and writes no cookie or web storage", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const cookieBefore = document.cookie;

    const { unmount } = renderDownload(CREDENTIALS);
    unmount();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("never prints a password, nor puts one in a hidden input or the URL", () => {
    const { container } = renderDownload(CREDENTIALS);

    expect(container.textContent).not.toContain(CLAVE_A);
    expect(container.textContent).not.toContain(CLAVE_B);
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
    expect(container.innerHTML).not.toContain(CLAVE_A);
    expect(screen.getByRole("link").getAttribute("href")).toBe("blob:cred-1");
  });

  it("shows nothing after a remount without credentials", () => {
    const first = renderDownload(CREDENTIALS);
    first.unmount();
    createObjectURL.mockClear();

    const { container } = renderDownload([]);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link")).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
