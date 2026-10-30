// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { envMock } = vi.hoisted(() => ({
  envMock: {
    RESEND_API_KEY: "re_test_key" as string | undefined,
    MAIL_FROM: "Justifia UAM <justificaciones@uam.edu.ni>" as
      string | undefined,
  },
}));
vi.mock("@/env", () => ({ env: envMock }));

import { createResendMailSender } from "@/lib/intake/adapters/resend-mail-sender";
import type { MailMessage } from "@/lib/intake/ports";

function message(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    to: "ana@uam.edu.ni",
    cc: ["estudiante@uam.edu.ni"],
    subject: "Justificar la inasistencia de Carlos Ruiz",
    text: "Buenos días",
    attachments: [
      {
        filename: "constancia.pdf",
        contentType: "application/pdf",
        content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      },
    ],
    idempotencyKey: "remision-5-0123456789abcdef",
    ...overrides,
  };
}

function reply(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createResendMailSender (TR-9)", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    envMock.RESEND_API_KEY = "re_test_key";
    envMock.MAIL_FROM = "Justifia UAM <justificaciones@uam.edu.ni>";
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("request shape", () => {
    it("posts JSON to the Resend emails endpoint with bearer auth and the idempotency key", async () => {
      fetchMock.mockResolvedValue(reply(200, { id: "49a3999c" }));
      await createResendMailSender(fetchMock).send(message());

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer re_test_key");
      expect(headers.get("Idempotency-Key")).toBe(
        "remision-5-0123456789abcdef",
      );
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("sends from, to, cc, subject, text and base64 attachments", async () => {
      fetchMock.mockResolvedValue(reply(200, { id: "49a3999c" }));
      await createResendMailSender(fetchMock).send(message());

      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body).toEqual({
        from: "Justifia UAM <justificaciones@uam.edu.ni>",
        to: ["ana@uam.edu.ni"],
        cc: ["estudiante@uam.edu.ni"],
        subject: "Justificar la inasistencia de Carlos Ruiz",
        text: "Buenos días",
        attachments: [{ filename: "constancia.pdf", content: "JVBERg==" }],
      });
    });

    it("sends the HTML part beside the text, and an inline image with its content id and type", async () => {
      fetchMock.mockResolvedValue(reply(200, { id: "49a3999c" }));
      await createResendMailSender(fetchMock).send(
        message({
          html: '<p>Hola <img src="cid:logo"></p>',
          attachments: [
            {
              filename: "logo.png",
              contentType: "image/png",
              content: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
              contentId: "logo",
            },
          ],
        }),
      );

      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body.text).toBe("Buenos días");
      expect(body.html).toBe('<p>Hola <img src="cid:logo"></p>');
      expect(body.attachments).toEqual([
        {
          filename: "logo.png",
          content: "iVBORw==",
          content_id: "logo",
          content_type: "image/png",
        },
      ]);
    });

    it("sends no html field and no content id for a plain-text message with a document", async () => {
      fetchMock.mockResolvedValue(reply(200, { id: "49a3999c" }));
      await createResendMailSender(fetchMock).send(message());

      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(Object.keys(body)).not.toContain("html");
      expect(Object.keys(body.attachments[0])).toEqual(["filename", "content"]);
    });

    it("sends an empty attachments list when there are none", async () => {
      fetchMock.mockResolvedValue(reply(200, { id: "x" }));
      await createResendMailSender(fetchMock).send(
        message({ attachments: [] }),
      );
      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body.attachments).toEqual([]);
    });

    it("bounds the call with a 20 second timeout signal", async () => {
      const timeout = vi.spyOn(AbortSignal, "timeout");
      fetchMock.mockResolvedValue(reply(200, { id: "x" }));
      await createResendMailSender(fetchMock).send(message());

      expect(timeout).toHaveBeenCalledWith(20_000);
      expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("result mapping", () => {
    it("maps a 2xx to ok with the provider message id", async () => {
      fetchMock.mockResolvedValue(reply(200, { id: "49a3999c" }));
      await expect(
        createResendMailSender(fetchMock).send(message()),
      ).resolves.toEqual({ ok: true, providerId: "49a3999c" });
    });

    it("still reports a sent message when a 2xx body has no id", async () => {
      fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
      await expect(
        createResendMailSender(fetchMock).send(message()),
      ).resolves.toEqual({ ok: true, providerId: "unknown" });
    });

    it.each([400, 401, 403, 422])("maps a %i to rejected", async (status) => {
      fetchMock.mockResolvedValue(
        reply(status, { message: "bad ana@uam.edu.ni" }),
      );
      await expect(
        createResendMailSender(fetchMock).send(message()),
      ).resolves.toEqual({ ok: false, code: "rejected" });
    });

    it.each([408, 409, 429, 500, 502, 503])(
      "maps a retryable %i to unavailable",
      async (status) => {
        fetchMock.mockResolvedValue(reply(status));
        await expect(
          createResendMailSender(fetchMock).send(message()),
        ).resolves.toEqual({ ok: false, code: "unavailable" });
      },
    );

    it("maps a network failure to unavailable", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      await expect(
        createResendMailSender(fetchMock).send(message()),
      ).resolves.toEqual({ ok: false, code: "unavailable" });
    });

    it("maps a timeout abort to unavailable", async () => {
      fetchMock.mockRejectedValue(
        new DOMException("The operation timed out.", "TimeoutError"),
      );
      await expect(
        createResendMailSender(fetchMock).send(message()),
      ).resolves.toEqual({ ok: false, code: "unavailable" });
    });

    it("never returns the provider's error text", async () => {
      fetchMock.mockResolvedValue(
        reply(422, { message: "invalid recipient ana@uam.edu.ni" }),
      );
      const result = await createResendMailSender(fetchMock).send(message());
      expect(JSON.stringify(result)).not.toContain("ana@uam.edu.ni");
    });
  });

  describe("configuration is asserted at send, never at construction", () => {
    it("constructs without any mail configuration", () => {
      envMock.RESEND_API_KEY = undefined;
      envMock.MAIL_FROM = undefined;
      expect(() => createResendMailSender(fetchMock)).not.toThrow();
    });

    it("returns not_configured without an API key and calls nothing", async () => {
      envMock.RESEND_API_KEY = undefined;
      await expect(
        createResendMailSender(fetchMock).send(message()),
      ).resolves.toEqual({ ok: false, code: "not_configured" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns not_configured without a sender address and calls nothing", async () => {
      envMock.MAIL_FROM = undefined;
      await expect(
        createResendMailSender(fetchMock).send(message()),
      ).resolves.toEqual({ ok: false, code: "not_configured" });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
