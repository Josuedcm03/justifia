import "server-only";

import { listGrupoDias } from "@/lib/data/grupo-dias";
import { createVercelBlobStore } from "@/lib/intake/adapters/vercel-blob-store";
import { createWeekdaySchedule } from "@/lib/intake/adapters/weekday-schedule";
import type { DocumentStore, GroupScheduleProvider } from "@/lib/intake/ports";

export type IntakeDeps = {
  store: DocumentStore;
  schedule: GroupScheduleProvider;
};

/**
 * The single wiring point of the intake ports (hexagonal composition root).
 * Routes and actions call this; tests `vi.mock` this module with
 * `createFakeIntakeDeps()` from `./fakes`, so no network or real store is
 * needed (supporting-documents: Storage behind a port).
 */
export function getIntakeDeps(): IntakeDeps {
  return {
    store: createVercelBlobStore(),
    schedule: createWeekdaySchedule(listGrupoDias),
  };
}
