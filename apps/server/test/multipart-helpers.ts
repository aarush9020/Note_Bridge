import { parseConfig } from '@gyan/core';
import { buildApp } from '../src/app';

export async function appWithCourse() {
  const built = await buildApp({ config: parseConfig({ DATABASE_PATH: ':memory:' }) });
  built.documents.ensureCourse('course1', 'Physics 101');
  return built;
}

/** Build a multipart/form-data body by hand (fastify.inject has no form helper). */
export function multipart(
  fields: Record<string, string>,
  file?: { name: string; bytes: Uint8Array },
) {
  const boundary = '----gyantest';
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`),
    );
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      Buffer.from(file.bytes),
      Buffer.from('\r\n'),
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}
