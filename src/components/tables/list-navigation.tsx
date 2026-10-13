"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
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
  navigate: (href: string, mode: NavigationMode) => void;
};

const ListNavigationContext = createContext<ListNavigation | null>(null);

/**
 * One transition shared by every control of a list, so a sort header, a
 * paging link and the search form all report the same pending flag.
 */
export function ListNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, mode: NavigationMode) => {
      startTransition(() => {
        if (mode === "push") router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      });
    },
    [router],
  );

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
