import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveExtractionConfig } from "./config";

const SECRET_URL = "http://models.internal.example:9000/path?token=hush";
const SECRET_KEY = "key-0123456789-abcdef";

describe("resolveExtractionConfig (DE-12)", () => {
  describe("accepted addresses", () => {
    it.each([
      ["https://models.example.com", "https://models.example.com"],
      ["https://models.example.com/", "https://models.example.com"],
      [
        "https://models.example.com:8443/api/",
        "https://models.example.com:8443/api",
      ],
      ["http://localhost:8080", "http://localhost:8080"],
      ["http://LOCALHOST:8080/", "http://localhost:8080"],
      ["http://127.0.0.1:8080", "http://127.0.0.1:8080"],
      ["http://127.45.6.7", "http://127.45.6.7"],
      ["http://[::1]:8080", "http://[::1]:8080"],
    ])("%s -> ok with base %s", (url, baseUrl) => {
      expect(resolveExtractionConfig({ EXTRACTION_API_URL: url })).toEqual({
        ok: true,
        baseUrl,
      });
    });
  });

  describe("absent configuration", () => {
    it.each([
      [{}],
      [{ EXTRACTION_API_URL: undefined }],
      [{ EXTRACTION_API_URL: "" }],
      [{ EXTRACTION_API_URL: "   " }],
    ])("%j is not configured and logs nothing", (env) => {
      const log = vi.fn();

      expect(resolveExtractionConfig(env, log)).toEqual({ ok: false });
      expect(log).not.toHaveBeenCalled();
    });
  });

  describe("rejected addresses", () => {
    it.each([
      "http://example.com",
      "http://localhost.evil.com",
      "http://127.0.0.1.evil.com",
      "http://10.0.0.5:8080",
      "http://128.0.0.1",
      "http://[::2]",
      "ftp://localhost/models",
      "not a url",
      "//models.example.com",
      "https://user:pass@models.example.com",
    ])("%s is not configured and logs the fixed code once", (url) => {
      const log = vi.fn();

      expect(resolveExtractionConfig({ EXTRACTION_API_URL: url }, log)).toEqual(
        {
          ok: false,
        },
      );
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith("extraction_config_invalid");
    });
  });

  describe("bearer key", () => {
    it("is optional and absent from the result when not set", () => {
      const result = resolveExtractionConfig({
        EXTRACTION_API_URL: "https://models.example.com",
      });

      expect(result).toEqual({
        ok: true,
        baseUrl: "https://models.example.com",
      });
      expect(result).not.toHaveProperty("apiKey");
    });

    it("is returned when set, trimmed", () => {
      expect(
        resolveExtractionConfig({
          EXTRACTION_API_URL: "https://models.example.com",
          EXTRACTION_API_KEY: `  ${SECRET_KEY} `,
        }),
      ).toEqual({
        ok: true,
        baseUrl: "https://models.example.com",
        apiKey: SECRET_KEY,
      });
    });

    it("treats a blank key as no key", () => {
      expect(
        resolveExtractionConfig({
          EXTRACTION_API_URL: "https://models.example.com",
          EXTRACTION_API_KEY: "  ",
        }),
      ).toEqual({ ok: true, baseUrl: "https://models.example.com" });
    });

    it("is never echoed back in a not-ok result", () => {
      const log = vi.fn();
      const result = resolveExtractionConfig(
        { EXTRACTION_API_URL: SECRET_URL, EXTRACTION_API_KEY: SECRET_KEY },
        log,
      );
      const absent = resolveExtractionConfig({
        EXTRACTION_API_KEY: SECRET_KEY,
      });

      expect(result).toEqual({ ok: false });
      expect(absent).toEqual({ ok: false });
      expect(JSON.stringify([result, absent, log.mock.calls])).not.toContain(
        SECRET_KEY,
      );
    });
  });

  describe("default logger", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.resetModules();
    });

    it("logs only the fixed code, once per process, never the address or the key", async () => {
      vi.resetModules();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { resolveExtractionConfig: fresh } = await import("./config");

      fresh({ EXTRACTION_API_URL: SECRET_URL, EXTRACTION_API_KEY: SECRET_KEY });
      fresh({ EXTRACTION_API_URL: SECRET_URL, EXTRACTION_API_KEY: SECRET_KEY });
      fresh({ EXTRACTION_API_URL: "http://other.example.org" });

      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith("extraction_config_invalid");
    });

    it("stays silent for a valid or an absent address", async () => {
      vi.resetModules();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { resolveExtractionConfig: fresh } = await import("./config");

      fresh({ EXTRACTION_API_URL: "https://models.example.com" });
      fresh({});

      expect(error).not.toHaveBeenCalled();
    });
  });
});
