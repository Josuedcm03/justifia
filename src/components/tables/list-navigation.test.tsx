import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense, use, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ListNavigationProvider,
  useListNavigation,
} from "@/components/tables/list-navigation";
import { resetNavigationMock, router } from "@/test/navigation-mock";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation-mock")).module,
);

beforeEach(() => {
  resetNavigationMock();
});

function Controls() {
  const { navigate, pending } = useListNavigation();
  return (
    <>
      <button type="button" onClick={() => navigate("/users?page=2", "push")}>
        push
      </button>
      <button
        type="button"
        onClick={() => navigate("/users?sort=name&dir=asc", "replace")}
      >
        replace
      </button>
      <output>{pending ? "pending" : "idle"}</output>
    </>
  );
}

describe("ListNavigationProvider (DT-NAV-1)", () => {
  it("pushes without scrolling to the top", async () => {
    render(
      <ListNavigationProvider>
        <Controls />
      </ListNavigationProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "push" }));

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/users?page=2", {
      scroll: false,
    });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces without scrolling to the top", async () => {
    render(
      <ListNavigationProvider>
        <Controls />
      </ListNavigationProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "replace" }));

    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      "/users?sort=name&dir=asc",
      { scroll: false },
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("passes the href through untouched, never building one", async () => {
    function Hostile() {
      const { navigate } = useListNavigation();
      return (
        <button type="button" onClick={() => navigate("/x?a=%20&b=1", "push")}>
          go
        </button>
      );
    }
    render(
      <ListNavigationProvider>
        <Hostile />
      </ListNavigationProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "go" }));

    expect(router.push).toHaveBeenCalledWith("/x?a=%20&b=1", {
      scroll: false,
    });
  });
});

describe("ListNavigationProvider (DT-PEND-1)", () => {
  it("is pending while the navigation is in flight and idle after", async () => {
    // A server navigation keeps the transition open until the new tree
    // arrives; a suspending child inside the transition reproduces that.
    let release!: () => void;
    const arrival = new Promise<void>((resolve) => {
      release = resolve;
    });

    function Arrival({ href }: { href: string | null }) {
      if (href) use(arrival);
      return <p data-testid="shown">{href ?? "initial"}</p>;
    }

    function Harness() {
      const [href, setHref] = useState<string | null>(null);
      router.push.mockImplementation((next: string) => setHref(next));
      return (
        <ListNavigationProvider>
          <Controls />
          <Suspense fallback={<p>skeleton</p>}>
            <Arrival href={href} />
          </Suspense>
        </ListNavigationProvider>
      );
    }

    render(<Harness />);
    expect(screen.getByRole("status")).toHaveTextContent("idle");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "push" }));
    });

    expect(screen.getByRole("status")).toHaveTextContent("pending");
    // Previous content stays; the skeleton fallback never replaces it.
    expect(screen.getByTestId("shown")).toHaveTextContent("initial");
    expect(screen.queryByText("skeleton")).toBeNull();

    await act(async () => {
      release();
    });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("idle"),
    );
    expect(screen.getByTestId("shown")).toHaveTextContent("/users?page=2");
  });

  it("keeps the controls enabled while pending", async () => {
    let release!: () => void;
    const arrival = new Promise<void>((resolve) => {
      release = resolve;
    });
    function Arrival({ wait }: { wait: boolean }) {
      if (wait) use(arrival);
      return null;
    }
    function Harness() {
      const [wait, setWait] = useState(false);
      router.push.mockImplementation(() => setWait(true));
      return (
        <ListNavigationProvider>
          <Controls />
          <Suspense fallback={null}>
            <Arrival wait={wait} />
          </Suspense>
        </ListNavigationProvider>
      );
    }
    render(<Harness />);

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "push" }));
    });

    expect(screen.getByRole("status")).toHaveTextContent("pending");
    expect(screen.getByRole("button", { name: "push" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "replace" })).toBeEnabled();

    await act(async () => {
      release();
    });
  });
});

describe("useListNavigation outside the provider", () => {
  it("throws a clear error", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      expect(() => render(<Controls />)).toThrow(/ListNavigationProvider/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
