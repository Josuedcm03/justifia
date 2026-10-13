import { getCurrentUser } from "@/lib/auth/dal";
import { canViewDocument } from "@/lib/auth/permissions";
import type { DocumentMode } from "@/lib/audit/types";
import {
  getDocumentForDownload,
  recordDocumentDownload,
} from "@/lib/data/documentos";
import { resolveRequestScope } from "@/lib/data/request-scope";
import {
  attachmentDisposition,
  inlineDisposition,
} from "@/lib/intake/content-disposition";
import { getIntakeDeps } from "@/lib/intake/deps";
import { contentTypeFor } from "@/lib/intake/signature";

// Authenticated view or download of a supporting document (RNF-01, RNF-02,
// RNF-06, D13, D15, SR-12). The proxy never sees `/api`, so this handler
// authenticates itself. Order: session, mode, lookup, owner or facultad-scope
// check, open the stored file, write the `documento.descargado` audit row (with
// the mode), only then send bytes. Any failure before the response leaves no
// audit row and sends no bytes.

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function failure(status: 401 | 404 | 500, error: string): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

/**
 * One response for "unknown id", "unknown mode" and "not yours": callers cannot
 * tell them apart.
 */
const notFound = () => failure(404, "not_found");

const DISPOSITIONS = {
  ver: inlineDisposition,
  descarga: attachmentDisposition,
} as const satisfies Record<DocumentMode, typeof inlineDisposition>;

/** `ver` when absent; `null` for anything but exactly one known value. */
function modeOf(request: Request): DocumentMode | null {
  const values = new URL(request.url).searchParams.getAll("modo");
  if (values.length === 0) return "ver";
  const [only] = values;
  return values.length === 1 && Object.hasOwn(DISPOSITIONS, only)
    ? (only as DocumentMode)
    : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.debeCambiarClave === true) {
    return failure(401, "unauthorized");
  }

  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id)) return notFound();
  const modo = modeOf(request);
  if (modo === null) return notFound();

  const doc = await getDocumentForDownload(Number(id));
  if (!doc) return notFound();
  const viewer = { id: Number(user.sub), rol: user.rol };
  const scope = await resolveRequestScope(viewer.id, viewer.rol);
  if (!canViewDocument(viewer, doc, scope)) return notFound();

  let stream: ReadableStream<Uint8Array> | null;
  try {
    stream = await getIntakeDeps().store.stream(doc.pathname);
  } catch {
    return failure(500, "unavailable");
  }
  if (!stream) return notFound();

  try {
    await recordDocumentDownload(viewer.id, {
      id: doc.id,
      solicitudId: doc.solicitudId,
      tipo: doc.tipo,
      modo,
    });
  } catch {
    await stream.cancel().catch(() => undefined);
    return failure(500, "unavailable");
  }

  return new Response(stream, {
    headers: {
      ...NO_STORE,
      "Content-Type": contentTypeFor(doc.tipo),
      "Content-Disposition": DISPOSITIONS[modo](doc.nombreOriginal, doc.tipo),
      "X-Content-Type-Options": "nosniff",
      // Inline view of student-supplied bytes: no scripts, no same-origin.
      "Content-Security-Policy": "sandbox",
    },
  });
}
