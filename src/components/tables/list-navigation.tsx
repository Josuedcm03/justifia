"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";

export type NavigationMode = "push" | "replace";

type ListNavigation = {
  /** True while a list navigation is in flight (DT-PEND-1). */
  pending: boolean;
  /**
   * Go to `href`: `push` for changes of content (page, filter, search),
   * `replace` for re-arrangements of the same result set (sort, page size)
   * (DT-NAV-1). The href is never built here; callers pass one produced by the
   * pure list-href builders from parsed, whitelisted state (N5).
   */
  navigate: (href: string, mode: NavigationMode, controlId?: string) => void;
};

/**
 * The control that started the navigation in flight, remembered so focus can
 * return to it when the route skeleton replaced the list (DT-SORT-2). Browser
 * only: it is written from event handlers and read from effects, never while
 * rendering, so the server never touches it. `path` keeps a navigation to
 * another page from pulling focus into a list it did not come from.
 */
let activeControl: { id: string; path: string } | null = null;

const CONTROL_ATTR = "data-list-control";

/** Marks an element as a list control that focus can return to. */
export function listControlProps(id: string) {
  return { [CONTROL_ATTR]: id };
}

/** The stable id of the sort header of a column. */
export function sortControlId(columnId: string): string {
  return `sort:${columnId}`;
}

function restoreControlFocus() {
  const target = activeControl;
  activeControl = null;
  if (!target || target.path !== window.location.pathname) return;
  // Only when nothing else took focus: the removed control left it on body.
  const focused = document.activeElement;
  if (focused && focused !== document.body) return;
  for (const element of document.querySelectorAll<HTMLElement>(
    `[${CONTROL_ATTR}]`,
  )) {
    if (element.getAttribute(CONTROL_ATTR) === target.id) {
      element.focus();
      return;
    }
  }
}

const ListNavigationContext = createContext<ListNavigation | null>(null);

/**
 * One transition shared by every control of a list, so a sort header, a
 * paging link and the search form all report the same pending flag.
 */
export function ListNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, mode: NavigationMode, controlId?: string) => {
      // A navigation not started by a control forgets the previous one.
      activeControl = controlId
        ? { id: controlId, path: window.location.pathname }
        : null;
      startTransition(() => {
        if (mode === "push") router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      });
    },
    [router],
  );

  // Runs after the list below it has mounted, so a list that replaced the
  // route skeleton gets its control focused once, then forgets it.
  useEffect(restoreControlFocus, []);
  // A navigation that settled without remounting leaves nothing to restore.
  useEffect(() => {
    if (!pending) activeControl = null;
  }, [pending]);

  const value = useMemo(() => ({ pending, navigate }), [pending, navigate]);

  return (
    <ListNavigationContext.Provider value={value}>
      {children}
    </ListNavigationContext.Provider>
  );
}

export function useListNavigation(): ListNavigation {
  const value = useContext(ListNavigationContext);
  if (!value) {
    throw new Error(
      "useListNavigation must be used inside a ListNavigationProvider",
    );
  }
  return value;
}
