import { describe, expect, it } from "vitest";

import {
  MAX_AUTO_ATTEMPTS,
  MAX_REMISSION_ATTACHMENT_BYTES,
  exceedsAttachmentLimit,
} from "./limits";

describe("remission limits (D3, TR-10)", () => {
  it("caps the raw attachment total at 25 MiB", () => {
    expect(MAX_REMISSION_ATTACHMENT_BYTES).toBe(25 * 1024 * 1024);
  });

  it("allows a total exactly at the limit", () => {
    expect(
      exceedsAttachmentLimit([MAX_REMISSION_ATTACHMENT_BYTES - 10, 10]),
    ).toBe(false);
  });

  it("refuses a total one byte over the limit", () => {
    expect(
      exceedsAttachmentLimit([MAX_REMISSION_ATTACHMENT_BYTES - 10, 11]),
    ).toBe(true);
  });

  it("allows no attachments at all", () => {
    expect(exceedsAttachmentLimit([])).toBe(false);
  });

  it("bounds automatic retries at eight attempts", () => {
    expect(MAX_AUTO_ATTEMPTS).toBe(8);
  });
});
