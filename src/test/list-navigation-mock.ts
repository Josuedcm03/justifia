import { vi } from "vitest";

/**
 * A controllable stand-in for `useListNavigation()`, for unit tests of the
 * list controls that only need to observe `navigate` and to set `pending`.
 * Install with
 *
 *   vi.mock("@/components/tables/list-navigation", async () =>
 *     (await import("@/test/list-navigation-mock")).module);
 *
 * The real provider and transition are covered by `list-navigation.test.tsx`
 * and by the `ListTable` integration test.
 */
export const listNavigation = {
  pending: false,
  navigate: vi.fn(),
};

/** Call from `beforeEach`. */
export function resetListNavigation() {
  listNavigation.pending = false;
  listNavigation.navigate.mockReset();
}

const listNavigationModule = {
  useListNavigation: () => listNavigation,
};

export { listNavigationModule as module };
