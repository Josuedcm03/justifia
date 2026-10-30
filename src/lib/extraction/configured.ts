import "server-only";

import { env } from "@/env";

import { resolveExtractionConfig, type ExtractionEnv } from "./config";

// The light half of the extraction composition root (DE-4, DE-12): it knows
// only the two variables and the pure config rule. It imports neither the
// preparer (sharp, unpdf, canvas) nor the HTTP adapter, so a page that only
// asks "is extraction configured?" does not load them.

/** The two extraction variables, read at call time and nothing else of `env`. */
export function extractionEnv(): ExtractionEnv {
  return {
    EXTRACTION_API_URL: env.EXTRACTION_API_URL,
    EXTRACTION_API_KEY: env.EXTRACTION_API_KEY,
  };
}

/** True when a usable address is set; an unusable one logs its fixed code. */
export function isExtractionConfigured(): boolean {
  return resolveExtractionConfig(extractionEnv()).ok;
}
