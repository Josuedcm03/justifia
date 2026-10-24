import "server-only";

import { getIntakeDeps } from "@/lib/intake/deps";

import { createNuExtractHttpExtractor } from "./adapters/nuextract-http-extractor";
import { createSharpUnpdfPreparer } from "./adapters/sharp-unpdf-preparer";
import { extractionEnv } from "./configured";
import type { ExtractionDeps } from "./run";

/**
 * The single wiring point of the extraction ports (hexagonal composition
 * root). The document store is the intake one, so the bytes are read from the
 * same private store they were uploaded to. The model server is judged at use:
 * building the dependencies never fails because the address is unset (DE-12).
 * The `queue` entry joins in S5b, once its adapter exists.
 */
export function getExtractionDeps(): ExtractionDeps {
  return {
    store: getIntakeDeps().store,
    preparer: createSharpUnpdfPreparer(),
    extractor: createNuExtractHttpExtractor({ env: extractionEnv }),
  };
}
