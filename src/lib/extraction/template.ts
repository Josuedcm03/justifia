// NuExtract3 request contract (DE-8). Pure: builds the body only; the HTTP
// adapter sends it. The `PreparedDocument` union lives here so this slice does
// not depend on the ports (`ports.ts` re-exports it).

/**
 * The six RF-11 fields. NuExtract3 takes the template through the chat
 * template kwargs, not as message text. `verbatim-string` forces a value that
 * is written in the document; dates are normalised by the model to ISO and are
 * checked again in code.
 */
export const NUEXTRACT_TEMPLATE = {
  student_name: "verbatim-string",
  issuer: "verbatim-string",
  issue_date: "date",
  rest_from: "date",
  rest_to: "date",
  rest_days: "integer",
} as const;

/**
 * Global instructions, sent through the `instructions` chat template kwarg
 * (NuExtract3 model card). Without them the model reads the doctor's name as
 * the issuer on clinic letterheads (breaks RN-14) and copies the absence dates
 * as rest on non-medical documents. Measured on 2026-11-11 over 25 session
 * photos, 3 runs each: invented fields 14-16 -> 0-2, correct 91-92 -> 109-111,
 * no field regressed. Changing this text needs the same check again.
 */
export const NUEXTRACT_INSTRUCTIONS = [
  "Extract only what is written in the document.",
  "- issuer: the institution named in the letterhead or seal (clinic, hospital, health center, company, university office or foundation), not the name of the person who signs. If no institution is named, use the signer's name.",
  "- rest_from, rest_to, rest_days: only when the document explicitly grants medical rest (reposo, incapacidad, descanso médico). A letter or form that only states an absence, a trip, work or an event grants no rest: return null for the three.",
].join("\n");

/** Engine identifier stored in `Motor` (the model and the input mode). */
export const ENGINE_ID = "nuextract3-4b/image";

/**
 * What the preparer hands to the extractor: one JPEG per page, in page order.
 * Text-layer PDFs are rendered like scanned ones (DE-14 gate failed), so there
 * is no text variant.
 */
export type PreparedDocument = {
  kind: "images";
  images: readonly Uint8Array[];
};

export interface ChatImagePart {
  type: "image_url";
  image_url: { url: string };
}

export interface ChatRequest {
  temperature: number;
  max_tokens: number;
  stream: false;
  messages: { role: "user"; content: ChatImagePart[] }[];
  chat_template_kwargs: {
    template: string;
    instructions: string;
    enable_thinking: false;
  };
}

const TEMPERATURE = 0.2;
const MAX_TOKENS = 512;

function toDataUrl(jpeg: Uint8Array): string {
  return `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
}

export function buildChatRequest(prepared: PreparedDocument): ChatRequest {
  return {
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    stream: false,
    messages: [
      {
        role: "user",
        content: prepared.images.map((jpeg) => ({
          type: "image_url" as const,
          image_url: { url: toDataUrl(jpeg) },
        })),
      },
    ],
    chat_template_kwargs: {
      template: JSON.stringify(NUEXTRACT_TEMPLATE, null, 4),
      instructions: NUEXTRACT_INSTRUCTIONS,
      enable_thinking: false,
    },
  };
}
