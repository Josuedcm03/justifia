// Ports of the intake slice (D1, D5, A4). The domain and the data layer depend
// on these interfaces only; adapters live in `./adapters`. The upload-token
// protocol is vendor specific and is NOT part of `DocumentStore` (A4).

export interface DocumentStore {
  /** First `bytes` bytes and total size of a stored file, or null if missing. */
  readHead(
    pathname: string,
    bytes: number,
  ): Promise<{ size: number; head: Uint8Array } | null>;
  delete(pathnames: readonly string[]): Promise<void>;
  list(
    prefix: string,
    cursor?: string,
  ): Promise<{
    blobs: { pathname: string; uploadedAt: Date }[];
    cursor?: string;
  }>;
  /** Body of a stored file, or null if missing. */
  stream(pathname: string): Promise<ReadableStream<Uint8Array> | null>;
}

export interface GroupScheduleProvider {
  /** Subset of `grupoIds` that has class on at least one date in the range. */
  groupsWithClass(
    grupoIds: readonly number[],
    range: { from: string; to: string },
  ): Promise<ReadonlySet<number>>;
}
