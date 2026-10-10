import { createHash } from 'node:crypto';

/** sha256 of file bytes. This is the ingestion cache key (documents.content_hash). */
export function contentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
