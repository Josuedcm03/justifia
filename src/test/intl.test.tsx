import { screen } from "@testing-library/react";
import { useTranslations } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { keyEchoIntl, renderWithIntl } from "@/test/intl";

function Role({ rol }: { rol: string }) {
  const t = useTranslations("roles");
  return <p>{t(rol as "administrador")}</p>;
}

describe("renderWithIntl (R9)", () => {
  it("renders the real Spanish catalog by default", () => {
    renderWithIntl(<Role rol="administrador" />);

    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("renders the real English catalog when asked", () => {
    renderWithIntl(<Role rol="administrador" />, "en");

    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.queryByText("Administrador")).toBeNull();
  });

  it("throws on a missing key instead of rendering a fallback", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      expect(() => renderWithIntl(<Role rol="notARole" />)).toThrow(/notARole/);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("keyEchoIntl", () => {
  it("echoes the key whatever the namespace", () => {
    const t = keyEchoIntl.useTranslations("tables");

    expect(t("sort.ascending")).toBe("sort.ascending");
    expect(keyEchoIntl.useTranslations()("columns.name")).toBe("columns.name");
  });

  it("echoes the key even when values are passed", () => {
    const t = keyEchoIntl.useTranslations("tables");

    expect(t("pagination.status", { page: 2, pages: 5 })).toBe(
      "pagination.status",
    );
  });
});
