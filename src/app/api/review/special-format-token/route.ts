import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth/dal";
import { canReviewRequests } from "@/lib/auth/permissions";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { getSpecialFormatContext } from "@/lib/data/special-format";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_DOCUMENT_BYTES,
  UPLOAD_TOKEN_TTL_MINUTES,
} from "@/lib/intake/limits";
import { isUnderDraftPrefix, solicitudIdOf } from "@/lib/intake/pathnames";

// Token issuer for the special format of RN-19 (teacher-remission, TR-15). The
// proxy never sees `/api`, so this handler authenticates itself on every call
// (RNF-01): session, password change, reviewer role, the caller's facultad
// scope and then the request named in the pathname. Everything that touches
// the request answers one `400 not_allowed`, so the route is no oracle for
// which requests exist, are marked, are approved or already have a format.
// The bytes go from the browser to the private store and never cross here.
//
// No `onUploadCompleted`: the callback is not trusted and cannot reach
// localhost; the attach action reads the stored bytes (as intake finalize).

class UploadDenied extends Error {}

function json(status: number, body: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

const NOT_ALLOWED = () => json(400, { error: "not_allowed" });

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json(401, { error: "unauthorized" });
  // A flagged account must change its password before doing anything else.
  if (user.debeCambiarClave === true) return json(403, { error: "forbidden" });
  if (!canReviewRequests(user.rol)) return NOT_ALLOWED();

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
        const solicitudId = solicitudIdOf(pathname);
        if (
          solicitudId === null ||
          !isUnderDraftPrefix(pathname, solicitudId)
        ) {
          throw new UploadDenied();
        }
        const scope = await resolveRequestScope(userId, user.rol);
        if (scope.kind === "none") throw new UploadDenied();
        if (!(await getSpecialFormatContext(solicitudId, scope))) {
          throw new UploadDenied();
        }
        return {
          allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_DOCUMENT_BYTES,
          validUntil: Date.now() + UPLOAD_TOKEN_TTL_MINUTES * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof UploadDenied) return NOT_ALLOWED();
    return json(400, { error: "bad_request" });
  }
}
