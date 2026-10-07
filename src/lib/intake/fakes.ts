import { permissiveSchedule } from "@/lib/intake/adapters/permissive-schedule";
import type { DocumentStore, GroupScheduleProvider } from "@/lib/intake/ports";

// Test doubles for the intake ports. No `server-only`, no network: importable
// from any test. Not used by production code.

export type FakeDocumentStore = DocumentStore & {
  seed(pathname: string, bytes: readonly number[], uploadedAt?: Date): void;
  has(pathname: string): boolean;
};

export function createFakeDocumentStore(): FakeDocumentStore {
  const files = new Map<string, { bytes: Uint8Array; uploadedAt: Date }>();

  return {
    seed(pathname, bytes, uploadedAt = new Date()) {
      files.set(pathname, { bytes: new Uint8Array(bytes), uploadedAt });
    },
    has: (pathname) => files.has(pathname),
    async readHead(pathname, bytes) {
      const file = files.get(pathname);
      if (!file) return null;
      return { size: file.bytes.length, head: file.bytes.slice(0, bytes) };
    },
    async delete(pathnames) {
      for (const pathname of pathnames) files.delete(pathname);
    },
    async list(prefix) {
      const blobs = [...files]
        .filter(([pathname]) => pathname.startsWith(prefix))
        .map(([pathname, f]) => ({ pathname, uploadedAt: f.uploadedAt }));
      return { blobs };
    },
    async stream(pathname) {
      const file = files.get(pathname);
      if (!file) return null;
      const bytes = file.bytes;
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
    },
  };
}

export function createFakeIntakeDeps(): {
  store: FakeDocumentStore;
  schedule: GroupScheduleProvider;
} {
  return { store: createFakeDocumentStore(), schedule: permissiveSchedule };
}
