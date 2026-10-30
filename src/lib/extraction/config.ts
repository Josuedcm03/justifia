// Extraction server configuration (DE-12, RNF-02, RNF-03). Pure: reads the
// values it is given and never touches the environment itself. The address and
// the key are secrets: they are never logged and never echoed in a failure.

export interface ExtractionEnv {
  EXTRACTION_API_URL?: string;
  EXTRACTION_API_KEY?: string;
}

export type ExtractionConfig =
  { ok: true; baseUrl: string; apiKey?: string } | { ok: false };

export type ConfigLogger = (event: "extraction_config_invalid") => void;

let invalidLogged = false;

/** Logs the fixed code once per process, so a cron run does not repeat it. */
const logInvalidOnce: ConfigLogger = (event) => {
  if (invalidLogged) return;
  invalidLogged = true;
  console.error(event);
};

const LOOPBACK_IPV4 = /^127(\.\d{1,3}){3}$/;

/** `localhost`, `127.0.0.0/8` and `::1`; anything else is a remote host. */
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    LOOPBACK_IPV4.test(hostname)
  );
}

function parseBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // Credentials belong in the key variable, not inside the address.
  if (url.username !== "" || url.password !== "") return null;
  const allowed =
    url.protocol === "https:" ||
    (url.protocol === "http:" && isLoopbackHost(url.hostname));
  if (!allowed) return null;
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/**
 * `https:` is always accepted; `http:` only toward a loopback host (the local
 * model container). An absent address is simply "not configured"; a present
 * but unusable one is "not configured" and logs `extraction_config_invalid`.
 */
export function resolveExtractionConfig(
  env: ExtractionEnv,
  log: ConfigLogger = logInvalidOnce,
): ExtractionConfig {
  const raw = env.EXTRACTION_API_URL?.trim();
  if (!raw) return { ok: false };

  const baseUrl = parseBaseUrl(raw);
  if (baseUrl === null) {
    log("extraction_config_invalid");
    return { ok: false };
  }

  const apiKey = env.EXTRACTION_API_KEY?.trim();
  return apiKey ? { ok: true, baseUrl, apiKey } : { ok: true, baseUrl };
}
