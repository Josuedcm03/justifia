import { permissiveSchedule } from "@/lib/intake/adapters/permissive-schedule";
import type {
  DocumentStore,
  GroupScheduleProvider,
  MailMessage,
  MailResult,
  MailSender,
} from "@/lib/intake/ports";

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

export type FakeMailFailure = Extract<MailResult, { ok: false }>["code"];

export type FakeMailSender = MailSender & {
  /** Messages the provider accepted, once per idempotency key. */
  readonly sent: readonly MailMessage[];
  /** Every `send` call, accepted or not. */
  readonly calls: readonly MailMessage[];
  /** Fail every following send with this code; `null` clears it. */
  failWith(code: FakeMailFailure | null): void;
};

export function createFakeMailSender(): FakeMailSender {
  const sent: MailMessage[] = [];
  const calls: MailMessage[] = [];
  const byKey = new Map<string, string>();
  let failure: FakeMailFailure | null = null;

  return {
    sent,
    calls,
    failWith(code) {
      failure = code;
    },
    async send(message) {
      calls.push(message);
      if (failure) return { ok: false, code: failure };
      const known = byKey.get(message.idempotencyKey);
      if (known) return { ok: true, providerId: known };
      const providerId = `fake-${byKey.size + 1}`;
      byKey.set(message.idempotencyKey, providerId);
      sent.push(message);
      return { ok: true, providerId };
    },
  };
}

export function createFakeIntakeDeps(): {
  store: FakeDocumentStore;
  schedule: GroupScheduleProvider;
  mail: FakeMailSender;
} {
  return {
    store: createFakeDocumentStore(),
    schedule: permissiveSchedule,
    mail: createFakeMailSender(),
  };
}
