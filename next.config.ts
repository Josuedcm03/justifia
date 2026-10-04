import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { SERVER_ACTION_BODY_LIMIT } from "./src/lib/import/limits";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Raised only as far as the import's upload cap needs (5 MiB + multipart
    // framing); every other Server Action keeps the default.
    serverActions: { bodySizeLimit: SERVER_ACTION_BODY_LIMIT },
  },
};

export default withNextIntl(nextConfig);
