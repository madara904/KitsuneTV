import { getDb } from './index';

export type SQLBatchTuple = [string] | [string, unknown[]];

type BatchResult = { status?: number; message?: string };

const DEFAULT_BATCH_SIZE = 120;

export interface BatchExecutionOptions {
  chunkSize?: number;
  /** Yield every N chunks; set to 0 to disable yielding. */
  yieldEveryChunks?: number;
}

function ensureBatchSucceeded(result: unknown, chunkIndex: number): void {
  const entries = Array.isArray(result) ? result : [result];
  for (const entry of entries) {
    const item = entry as BatchResult | null | undefined;
    if (item?.status === 1) {
      throw new Error(item.message ?? `Batch chunk ${chunkIndex} failed`);
    }
  }
}

/**
 * Execute big statement lists in chunks to avoid native crashes when syncing huge playlists.
 */
export async function executeBatchInChunks(
  statements: SQLBatchTuple[],
  options: BatchExecutionOptions = {},
): Promise<void> {
  if (statements.length === 0) return;
  const db = getDb();
  const chunkSize = options.chunkSize ?? DEFAULT_BATCH_SIZE;
  const yieldEveryChunks = options.yieldEveryChunks ?? 1;

  let chunkIndex = 0;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    const result = await db.executeBatchAsync(chunk);
    ensureBatchSucceeded(result, chunkIndex);
    chunkIndex++;

    if (yieldEveryChunks > 0 && chunkIndex % yieldEveryChunks === 0) {
      // Yield periodically to keep JS/native bridge responsive during huge sync jobs.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
}
