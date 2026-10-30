import { describe, expect, it } from "vitest";

import {
  ENGINE_ID,
  NUEXTRACT_TEMPLATE,
  buildChatRequest,
  type PreparedDocument,
} from "./template";

const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]); // base64 "/9j/"
const OTHER_BYTES = new Uint8Array([0x01, 0x02, 0x03]); // base64 "AQID"

describe("NUEXTRACT_TEMPLATE (DE-8)", () => {
  it("asks for exactly the six RF-11 fields with their types", () => {
    expect(NUEXTRACT_TEMPLATE).toEqual({
      student_name: "verbatim-string",
      issuer: "verbatim-string",
      issue_date: "date",
      rest_from: "date",
      rest_to: "date",
      rest_days: "integer",
    });
  });

  it("keeps the key order of the contract", () => {
    expect(Object.keys(NUEXTRACT_TEMPLATE)).toEqual([
      "student_name",
      "issuer",
      "issue_date",
      "rest_from",
      "rest_to",
      "rest_days",
    ]);
  });
});

describe("ENGINE_ID", () => {
  it("names the model and the image mode recorded in the row", () => {
    expect(ENGINE_ID).toBe("nuextract3-4b/image");
  });
});

describe("buildChatRequest (DE-8)", () => {
  const prepared: PreparedDocument = {
    kind: "images",
    images: [JPEG_MAGIC, OTHER_BYTES],
  };

  it("sends one image_url part per page, in page order, as JPEG data URLs", () => {
    const request = buildChatRequest(prepared);

    expect(request.messages).toEqual([
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64,/9j/" },
          },
          {
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64,AQID" },
          },
        ],
      },
    ]);
  });

  it("orders the parts by the order of the pages, not by content", () => {
    const reversed = buildChatRequest({
      kind: "images",
      images: [OTHER_BYTES, JPEG_MAGIC],
    });

    expect(
      reversed.messages[0].content.map((part) => part.image_url.url),
    ).toEqual(["data:image/jpeg;base64,AQID", "data:image/jpeg;base64,/9j/"]);
  });

  it("uses temperature 0.2, 512 tokens, no streaming and no reasoning", () => {
    const request = buildChatRequest(prepared);

    expect(request.temperature).toBe(0.2);
    expect(request.max_tokens).toBe(512);
    expect(request.stream).toBe(false);
    expect(request.chat_template_kwargs.enable_thinking).toBe(false);
  });

  it("passes the template as a 4-space JSON string in the chat template kwargs", () => {
    const request = buildChatRequest(prepared);

    expect(request.chat_template_kwargs.template).toBe(
      JSON.stringify(NUEXTRACT_TEMPLATE, null, 4),
    );
    expect(request.chat_template_kwargs.template).toContain(
      '\n    "student_name": "verbatim-string"',
    );
  });

  it("does not put the template or any option inside the message text", () => {
    const request = buildChatRequest(prepared);

    expect(JSON.stringify(request.messages)).not.toContain("student_name");
  });
});
