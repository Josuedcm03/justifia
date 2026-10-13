import { describe, expect, it } from "vitest";

import {
  attachmentDisposition,
  inlineDisposition,
} from "./content-disposition";

describe("attachmentDisposition", () => {
  it("builds an attachment disposition with the same fallback and UTF-8 name", () => {
    expect(attachmentDisposition("Dictamen médico.pdf", "pdf")).toBe(
      "attachment; filename=\"documento.pdf\"; filename*=UTF-8''Dictamen%20m%C3%A9dico.pdf",
    );
  });

  it("differs from the inline form only in the disposition type", () => {
    const name = "scan (1).png";
    expect(attachmentDisposition(name, "png")).toBe(
      inlineDisposition(name, "png").replace(/^inline/, "attachment"),
    );
  });

  it("cannot be used to inject a header or break out of the quoted fallback", () => {
    const header = attachmentDisposition('a"\r\nSet-Cookie: x=1.pdf', "pdf");
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.match(/"/g)).toHaveLength(2);
  });
});

describe("inlineDisposition", () => {
  it("builds an inline disposition with an ASCII fallback and the UTF-8 name", () => {
    expect(inlineDisposition("scan.pdf", "pdf")).toBe(
      "inline; filename=\"documento.pdf\"; filename*=UTF-8''scan.pdf",
    );
  });

  it("percent-encodes non-ASCII and reserved characters (RFC 5987)", () => {
    const header = inlineDisposition("Dictamen médico (1)*.png", "png");
    expect(header).toBe(
      "inline; filename=\"documento.png\"; filename*=UTF-8''Dictamen%20m%C3%A9dico%20%281%29%2A.png",
    );
  });

  it("cannot be used to inject a header or break out of the quoted fallback", () => {
    const header = inlineDisposition('a"\r\nSet-Cookie: x=1.pdf', "pdf");
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.match(/"/g)).toHaveLength(2);
    expect(header).toContain(
      "filename*=UTF-8''a%22%0D%0ASet-Cookie%3A%20x%3D1.pdf",
    );
  });

  it("uses the detected type for the fallback extension, not the stored name", () => {
    expect(inlineDisposition("evil.exe", "jpeg")).toContain(
      'filename="documento.jpeg"',
    );
  });
});
