import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth/dal";
import { canFileRequests } from "@/lib/auth/permissions";
import { getUploadContext } from "@/lib/data/documentos";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_DRAFT,
  UPLOAD_TOKEN_TTL_MINUTES,
} from "@/lib/intake/limits";
import { isUnderDraftPrefix, solicitudIdOf } from "@/lib/intake/pathnames";

// Inbound adapter of the Vercel upload-token protocol (A4, D2). The proxy
// never sees `/api`, so this handler authenticates itself on every call
// (RNF-01): session, role, then ownership of a non-expired draft or of a
// returned (`devuelta`) request named in the pathname. Files go
// from the browser to the private store; they never cross this function (C1).
//
// No `onUploadCompleted`: the callback cannot reach localhost and is not
// trusted for validation anyway (C15, D3). Finalize reads the stored bytes.

/** Reason codes surfaced to the client; nothing else leaves this route. */
class UploadDenied extends Error {
  constructor(
    readonly reason: "no_draft" | "not_allowed" | "too_many_documents",
  ) {
    super(reason);
  }
}

function json(status: number, body: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json(401, { error: "unauthorized" });
  // A flagged account must change its password before doing anything else.
  if (user.debeCambiarClave === true || !canFileRequests(user.rol)) {
    return json(403, { error: "forbidden" });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json(400, { error: "bad_request" });
  }

  const userId = Number(user.sub);
  try {
    const result = await handleUpload({
      token: env.BLOB_READ_WRITE_TOKEN,
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const now = new Date();
        // A correction names its request in the pathname; a draft is found
        // through the session. The data layer re-checks owner and state.
        const claimed = solicitudIdOf(pathname);
        const draft =
          (claimed !== null &&
            (await getUploadContext(userId, now, {
              kind: "correction",
              solicitudId: claimed,
            }))) ||
          (await getUploadContext(userId, now, { kind: "draft" }));
        if (!draft) throw new UploadDenied("no_draft");
        if (!isUnderDraftPrefix(pathname, draft.solicitudId)) {
          throw new UploadDenied("not_allowed");
        }
        // D12: counts pendiente + valido, retired excluded; finalize re-checks
        // under a row lock.
        if (draft.documentCount >= MAX_DOCUMENTS_PER_DRAFT) {
          throw new UploadDenied("too_many_documents");
        }
        return {
          allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_DOCUMENT_BYTES,
          validUntil: now.getTime() + UPLOAD_TOKEN_TTL_MINUTES * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof UploadDenied)
      return json(400, { error: error.reason });
    return json(400, { error: "bad_request" });
  }
}
