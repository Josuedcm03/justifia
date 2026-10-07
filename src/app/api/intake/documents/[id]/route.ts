import { getCurrentUser } from "@/lib/auth/dal";
import { canViewDocument } from "@/lib/auth/permissions";
import {
  getDocumentForDownload,
  recordDocumentDownload,
} from "@/lib/data/documentos";
import { attachmentDisposition } from "@/lib/intake/content-disposition";
import { getIntakeDeps } from "@/lib/intake/deps";
import { contentTypeFor } from "@/lib/intake/signature";

// Authenticated download of a supporting document (RNF-01, RNF-02, RNF-06,
// D13, D15). The proxy never sees `/api`, so this handler authenticates
// itself. Order: session, owner check, open the stored file, write the
// `documento.descargado` audit row, only then send bytes. Any failure before
// the response leaves no audit row and sends no bytes.

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function failure(status: 401 | 404 | 500, error: string): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

/** One response for "unknown id" and "not yours": callers cannot tell apart. */
const notFound = () => failure(404, "not_found");

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.debeCambiarClave === true) {
    return failure(401, "unauthorized");
  }

  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id)) return notFound();

  const doc = await getDocumentForDownload(Number(id));
  if (!doc) return notFound();
  const viewer = { id: Number(user.sub), rol: user.rol };
  if (!canViewDocument(viewer, doc.estudianteId)) return notFound();

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
    });
  } catch {
    await stream.cancel().catch(() => undefined);
    return failure(500, "unavailable");
  }

  return new Response(stream, {
    headers: {
      ...NO_STORE,
      "Content-Type": contentTypeFor(doc.tipo),
      "Content-Disposition": attachmentDisposition(
        doc.nombreOriginal,
        doc.tipo,
      ),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
