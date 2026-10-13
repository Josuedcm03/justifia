import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetNavigationMock,
  router,
  setPathname,
} from "@/test/navigation-mock";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation-mock")).module,
);
vi.mock(
  "next/link",
  async () => (await import("@/test/navigation-mock")).linkModule,
);

function Probe() {
  const current = useRouter();
  return (
    <>
      <p data-testid="path">{usePathname()}</p>
      <button type="button" onClick={() => current.push("/probe")}>
        go
      </button>
    </>
  );
}

beforeEach(() => {
  resetNavigationMock();
});

describe("navigation mock: router and pathname", () => {
  it("hands every component the same hoisted router with spies", async () => {
    render(<Probe />);

    await userEvent.click(screen.getByRole("button", { name: "go" }));

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/probe");
    for (const method of [
      "push",
      "replace",
      "refresh",
      "prefetch",
      "back",
      "forward",
    ] as const) {
      expect(vi.isMockFunction(router[method]), method).toBe(true);
    }
  });

  it("reports the pathname a test sets and resets it with the spies", () => {
    setPathname("/catalog/docentes");
    const { unmount } = render(<Probe />);
    expect(screen.getByTestId("path")).toHaveTextContent("/catalog/docentes");
    unmount();

    router.push("/elsewhere");
    resetNavigationMock();

    expect(router.push).not.toHaveBeenCalled();
    render(<Probe />);
    expect(screen.getByTestId("path")).toHaveTextContent("/");
  });
});

describe("navigation mock: next/link stand-in", () => {
  it("renders a real anchor with the given href", () => {
    render(<Link href="/users?page=2">next</Link>);

    expect(screen.getByRole("link", { name: "next" })).toHaveAttribute(
      "href",
      "/users?page=2",
    );
  });

  it("calls onNavigate on a plain click and honours preventDefault", async () => {
    const onNavigate = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    render(
      <Link href="/users?page=2" onNavigate={onNavigate} scroll={false}>
        next
      </Link>,
    );

    await userEvent.click(screen.getByRole("link", { name: "next" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("pushes with the scroll flag when onNavigate does not cancel", async () => {
    const onNavigate = vi.fn();
    render(
      <Link href="/users?page=2" onNavigate={onNavigate} scroll={false}>
        next
      </Link>,
    );

    await userEvent.click(screen.getByRole("link", { name: "next" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/users?page=2", {
      scroll: false,
    });
  });

  it("replaces instead of pushing for a replace link", async () => {
    render(
      <Link href="/users?size=25" replace>
        size
      </Link>,
    );

    await userEvent.click(screen.getByRole("link", { name: "size" }));

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("leaves a modifier-key click to the browser, like the real link", async () => {
    const onNavigate = vi.fn();
    render(
      <Link href="/users?page=2" onNavigate={onNavigate}>
        next
      </Link>,
    );
    const link = screen.getByRole("link", { name: "next" });
    link.addEventListener("click", (event) => event.preventDefault());

    await userEvent.keyboard("{Control>}");
    await userEvent.click(link);
    await userEvent.keyboard("{/Control}");

    expect(onNavigate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
