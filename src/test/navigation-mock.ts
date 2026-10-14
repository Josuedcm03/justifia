import { createElement, type ComponentProps, type MouseEvent } from "react";
import { vi } from "vitest";

/**
 * One router for the whole test file: `useRouter()` returns this object, so a
 * test asserts on `router.push` without reaching into a component. Install
 * with
 *
 *   vi.mock("next/navigation", async () =>
 *     (await import("@/test/navigation-mock")).module);
 *
 * and, for components that render `next/link`,
 *
 *   vi.mock("next/link", async () =>
 *     (await import("@/test/navigation-mock")).linkModule);
 *
 * Why the link needs a stand-in: under Vitest `next/link` resolves to the
 * pages implementation, which returns early without a pages router and never
 * calls `onNavigate` (apply-progress 0.9). The stand-in keeps the two real
 * behaviours the table kit relies on (N7): `onNavigate` runs only for a plain
 * client-side click and `preventDefault()` cancels the navigation.
 */
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
};

const DEFAULT_PATHNAME = "/";
let currentPathname = DEFAULT_PATHNAME;

export function setPathname(pathname: string) {
  currentPathname = pathname;
}

/** Call from `beforeEach`: clears every spy and restores the pathname. */
export function resetNavigationMock() {
  for (const spy of Object.values(router)) spy.mockReset();
  currentPathname = DEFAULT_PATHNAME;
}

const navigationModule = {
  useRouter: () => router,
  usePathname: () => currentPathname,
};

export { navigationModule as module };

type NavigateEvent = { preventDefault: () => void };

type LinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  onNavigate?: (event: NavigateEvent) => void;
  scroll?: boolean;
  replace?: boolean;
  prefetch?: boolean | null;
};

function isModifiedClick(event: MouseEvent) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

function MockLink({
  href,
  onNavigate,
  scroll,
  replace,
  prefetch,
  onClick,
  children,
  ...anchor
}: LinkProps) {
  void prefetch;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || isModifiedClick(event)) return;

    // A client-side navigation never lets the browser follow the href.
    event.preventDefault();
    let cancelled = false;
    onNavigate?.({
      preventDefault: () => {
        cancelled = true;
      },
    });
    if (cancelled) return;
    const options = scroll === undefined ? undefined : { scroll };
    const go = replace ? router.replace : router.push;
    if (options) go(href, options);
    else go(href);
  }

  return createElement(
    "a",
    {
      ...anchor,
      href,
      // Not rendered by the real link; exposed so a test can assert the flag.
      "data-scroll": scroll === undefined ? undefined : String(scroll),
      onClick: handleClick,
    },
    children,
  );
}

export const linkModule = { default: MockLink };
