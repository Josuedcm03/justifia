import { z } from "zod";

import {
  resolveExtractionConfig,
  type ExtractionConfig,
  type ExtractionEnv,
} from "../config";
import {
  COLD_START_RETRY_DELAY_MS,
  MAX_MODEL_RESPONSE_BYTES,
  MIN_DOCUMENT_BUDGET_MS,
} from "../limits";
import type { ExtractResult, FieldExtractor } from "../ports";
import { buildChatRequest } from "../template";

// HTTP extractor (DE-7, DE-8, DE-12): sends the prepared pages to the
// OpenAI-compatible NuExtract3 server and returns the raw fields. Every outcome
// is a closed-set code; the address, the key, the response body and any
// exception message stay inside this file (RNF-02, RNF-04). It never logs.

const TIMEOUT: ExtractResult = { ok: false, code: "timeout" };
const MODEL_ERROR: ExtractResult = { ok: false, code: "model_error" };
const INVALID_RESPONSE: ExtractResult = { ok: false, code: "invalid_response" };

/** Statuses a model server answers while its GPU instance is still starting. */
const COLD_START_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

const CHAT_PATH = "/v1/chat/completions";

// Each key is a string, a number or null; a missing key is the same as null and
// keys outside the template are dropped. Anything else is not an answer.
const fieldValue = z.union([z.string(), z.number(), z.null()]).optional();

const answerSchema = z.object({
  student_name: fieldValue,
  issuer: fieldValue,
  issue_date: fieldValue,
  rest_from: fieldValue,
  rest_to: fieldValue,
  rest_days: fieldValue,
});

const completionSchema = z.object({ choices: z.array(z.unknown()).min(1) });
const choiceSchema = z.object({ message: z.object({ content: z.string() }) });

const CODE_FENCE = /^```[A-Za-z]*[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/;

export interface NuExtractHttpExtractorOptions {
  /** Read at use, so the configuration is judged when it is needed (DE-12). */
  env: () => ExtractionEnv;
  /** Injectable for tests; defaults to the global `fetch`, read at call time. */
  fetch?: typeof fetch;
}

type Attempt =
  | { kind: "response"; response: Response }
  | { kind: "network" }
  | { kind: "aborted" };

/** Releases the connection of a response whose body is not going to be read. */
async function discard(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

/**
 * The body as text, or null when it is longer than the cap. Reading stops as
 * soon as the cap is passed, so an endless response cannot be drained.
 */
async function readBounded(response: Response): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_MODEL_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function jsonOrUndefined(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The model's text, without the code fence it sometimes wraps around JSON. */
function unfence(content: string): string {
  const trimmed = content.trim();
  const match = CODE_FENCE.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function parseAnswer(body: string): ExtractResult {
  const completion = completionSchema.safeParse(jsonOrUndefined(body));
  if (!completion.success) return INVALID_RESPONSE;
  const choice = choiceSchema.safeParse(completion.data.choices[0]);
  if (!choice.success) return INVALID_RESPONSE;
  const answer = answerSchema.safeParse(
    jsonOrUndefined(unfence(choice.data.message.content)),
  );
  return answer.success ? { ok: true, raw: answer.data } : INVALID_RESPONSE;
}

export function createNuExtractHttpExtractor(
  options: NuExtractHttpExtractorOptions,
): FieldExtractor {
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function attempt(
    config: Extract<ExtractionConfig, { ok: true }>,
    body: string,
    signal: AbortSignal,
  ): Promise<Attempt> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // The bearer travels only when a key is configured (RNF-03).
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    try {
      const response = await send(`${config.baseUrl}${CHAT_PATH}`, {
        method: "POST",
        headers,
        body,
        // A redirect could carry the document to another host (RNF-03).
        redirect: "error",
        signal,
      });
      return { kind: "response", response };
    } catch {
      return signal.aborted ? { kind: "aborted" } : { kind: "network" };
    }
  }

  function isColdStart(result: Attempt): boolean {
    return (
      result.kind === "network" ||
      (result.kind === "response" &&
        COLD_START_STATUSES.has(result.response.status))
    );
  }

  async function interpret(
    result: Attempt,
    signal: AbortSignal,
  ): Promise<ExtractResult> {
    if (result.kind === "aborted") return TIMEOUT;
    if (result.kind === "network") return MODEL_ERROR;
    const { response } = result;
    if (!response.ok) {
      await discard(response);
      return MODEL_ERROR;
    }
    try {
      const body = await readBounded(response);
      return body === null ? INVALID_RESPONSE : parseAnswer(body);
    } catch {
      return signal.aborted ? TIMEOUT : MODEL_ERROR;
    }
  }

  return {
    isConfigured() {
      return resolveExtractionConfig(options.env()).ok;
    },

    async extract(prepared, { timeoutMs }) {
      // A spent budget is an immediate timeout, not a call (the use case hands
      // over 0 when less than 10 s remain).
      if (timeoutMs <= 0) return TIMEOUT;
      const config = resolveExtractionConfig(options.env());
      if (!config.ok) return MODEL_ERROR;

      const startedAt = Date.now();
      // One deadline for the whole call, retry included.
      const signal = AbortSignal.timeout(timeoutMs);
      const body = JSON.stringify(buildChatRequest(prepared));

      let result = await attempt(config, body, signal);
      if (isColdStart(result)) {
        // One retry, same attempt of the same document, and only if the budget
        // that is left after the wait still covers a document.
        const left =
          timeoutMs - (Date.now() - startedAt) - COLD_START_RETRY_DELAY_MS;
        if (left >= MIN_DOCUMENT_BUDGET_MS) {
          if (result.kind === "response") await discard(result.response);
          await sleep(COLD_START_RETRY_DELAY_MS);
          result = await attempt(config, body, signal);
        }
      }
      return interpret(result, signal);
    },
  };
}
