import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { LEGACY_GRUPOS_REDIRECTS } from "./src/lib/catalog/legacy-redirects";
import { SERVER_ACTION_BODY_LIMIT } from "./src/lib/import/limits";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Raised only as far as the import's upload cap needs (5 MiB + multipart
    // framing); every other Server Action keeps the default.
    serverActions: { bodySizeLimit: SERVER_ACTION_BODY_LIMIT },
  },
  // The retired `/catalog/grupos/new` URL (CM-RTE-1). Pure string rewrites that
  // read no data; the destination applies its own access rules.
  async redirects() {
    return LEGACY_GRUPOS_REDIRECTS;
  },
};

export default withNextIntl(nextConfig);
