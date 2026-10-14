import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense, use, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ListNavigationProvider,
  listControlProps,
  sortControlId,
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

describe("focus restoration after a skeleton remount (DT-SORT-2)", () => {
  const NAME = sortControlId("name");
  const LOGIN = sortControlId("login");

  function Control({ id, label }: { id: string; label: string }) {
    const { navigate } = useListNavigation();
    return (
      <button
        type="button"
        {...listControlProps(id)}
        onClick={() => navigate("/users?sort=x", "replace", id)}
      >
        {label}
      </button>
    );
  }

  function Anonymous() {
    const { navigate } = useListNavigation();
    return (
      <button type="button" onClick={() => navigate("/users?q=a", "push")}>
        anonymous
      </button>
    );
  }

  /**
   * Stands in for the route skeleton: the navigation replaces the whole list
   * (provider included) by a placeholder; `arrive()` mounts a new list.
   */
  function setup() {
    const handle = { arrive: () => undefined as void };
    function Harness() {
      const [phase, setPhase] = useState<"list" | "skeleton">("list");
      useEffect(() => {
        handle.arrive = () => setPhase("list");
      });
      router.replace.mockImplementation(() => setPhase("skeleton"));
      router.push.mockImplementation(() => setPhase("skeleton"));
      return phase === "list" ? (
        <ListNavigationProvider>
          <Control id={NAME} label="Name" />
          <Control id={LOGIN} label="Login" />
          <Anonymous />
        </ListNavigationProvider>
      ) : (
        <p>skeleton</p>
      );
    }
    render(<Harness />);
    return { arrive: () => act(() => handle.arrive()) };
  }

  it("returns focus to the same control after the list remounts", async () => {
    const { arrive } = setup();
    const user = userEvent.setup();

    screen.getByRole("button", { name: "Login" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("skeleton")).toBeInTheDocument();
    expect(document.body).toHaveFocus();

    await arrive();

    expect(screen.getByRole("button", { name: "Login" })).toHaveFocus();
  });

  it("restores once, then forgets the control", async () => {
    const { arrive } = setup();
    const user = userEvent.setup();

    screen.getByRole("button", { name: "Name" }).focus();
    await user.keyboard("{Enter}");
    await arrive();
    expect(screen.getByRole("button", { name: "Name" })).toHaveFocus();

    // A later unrelated mount must not move focus.
    await user.click(document.body);
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "Name" }).blur();
    await act(async () => {
      render(
        <ListNavigationProvider>
          <Control id={NAME} label="Other" />
        </ListNavigationProvider>,
      );
    });
    expect(screen.getByRole("button", { name: "Other" })).not.toHaveFocus();
  });

  it("does not move focus on a mount no control navigated to", () => {
    render(
      <ListNavigationProvider>
        <Control id={NAME} label="Name" />
      </ListNavigationProvider>,
    );

    expect(document.body).toHaveFocus();
  });

  it("does not steal focus the user already moved elsewhere", async () => {
    const { arrive } = setup();
    const user = userEvent.setup();

    screen.getByRole("button", { name: "Name" }).focus();
    await user.keyboard("{Enter}");

    const elsewhere = document.createElement("input");
    document.body.append(elsewhere);
    elsewhere.focus();
    await arrive();

    try {
      expect(elsewhere).toHaveFocus();
      expect(screen.getByRole("button", { name: "Name" })).not.toHaveFocus();
    } finally {
      elsewhere.remove();
    }
  });

  it("forgets the control when a later navigation is not from a control", async () => {
    const { arrive } = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "anonymous" }));
    await arrive();

    expect(document.body).toHaveFocus();
  });

  it("forgets the control when the navigation settled without a remount", async () => {
    render(
      <ListNavigationProvider>
        <Control id={NAME} label="Name" />
      </ListNavigationProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Name" }));
    // router mock does nothing: the transition ends with the list in place.
    await waitFor(() => expect(router.replace).toHaveBeenCalled());

    document.body.focus();
    await act(async () => {
      render(
        <ListNavigationProvider>
          <Control id={NAME} label="Fresh" />
        </ListNavigationProvider>,
      );
    });

    expect(screen.getByRole("button", { name: "Fresh" })).not.toHaveFocus();
  });

  it("does not restore on a different pathname", async () => {
    const { arrive } = setup();
    const user = userEvent.setup();

    screen.getByRole("button", { name: "Name" }).focus();
    await user.keyboard("{Enter}");
    window.history.pushState({}, "", "/elsewhere");
    try {
      await arrive();
      expect(document.body).toHaveFocus();
    } finally {
      window.history.pushState({}, "", "/");
    }
  });
});
