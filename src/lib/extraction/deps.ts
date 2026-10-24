import "server-only";

import { getIntakeDeps } from "@/lib/intake/deps";

import { createAfterQueue } from "./adapters/after-queue";
import { createNuExtractHttpExtractor } from "./adapters/nuextract-http-extractor";
import { createSharpUnpdfPreparer } from "./adapters/sharp-unpdf-preparer";
import { extractionEnv } from "./configured";
import type { ExtractionQueue } from "./ports";
import type { ExtractionDeps } from "./run";

/** The ports the use case runs on, plus the producers' hand-off (DE-5). */
export type ExtractionWiring = ExtractionDeps & { queue: ExtractionQueue };

/**
 * The single wiring point of the extraction ports (hexagonal composition
 * root). The document store is the intake one, so the bytes are read from the
 * same private store they were uploaded to. The model server is judged at use:
 * building the dependencies never fails because the address is unset (DE-12).
 * The queue runs the three ports above; the use case itself never sees it.
 */
export function getExtractionDeps(): ExtractionWiring {
  const ports: ExtractionDeps = {
    store: getIntakeDeps().store,
    preparer: createSharpUnpdfPreparer(),
    extractor: createNuExtractHttpExtractor({ env: extractionEnv }),
  };
  return { ...ports, queue: createAfterQueue(ports) };
}
