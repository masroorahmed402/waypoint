import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { StorageService, PresignedUpload } from './storage.interface';

const ROOT = join(process.cwd(), '.uploads-dev');
const BASE = 'http://localhost:4000/api/v1/dev-storage';

// Keys contain slashes (users/<id>/documents/<uuid>.pdf). base64url encoding
// turns each key into ONE URL-safe path segment — no %2F decoding ambiguity.
const enc = (key: string) => Buffer.from(key).toString('base64url');
export const decodeStorageKey = (seg: string) => Buffer.from(seg, 'base64url').toString('utf8');

/**
 * Dev-only driver: contributors don't need AWS credentials. "Presigned URLs"
 * point at the local /dev-storage endpoint. NEVER used in production
 * (config validation blocks STORAGE_DRIVER other than s3 there).
 */
@Injectable()
export class LocalDiskStorage implements StorageService {
  async presignUpload(key: string, contentType: string): Promise<PresignedUpload> {
    return { url: `${BASE}/${enc(key)}`, method: 'PUT', headers: { 'Content-Type': contentType } };
  }

  async presignDownload(key: string): Promise<string> {
    return `${BASE}/${enc(key)}`;
  }

  async head(key: string) {
    try {
      const stat = await fs.stat(join(ROOT, key));
      return { exists: true, sizeBytes: stat.size };
    } catch {
      return { exists: false };
    }
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(join(ROOT, key));
  }

  async delete(key: string) {
    await fs.rm(join(ROOT, key), { force: true });
  }

  // used by the dev-storage controller (raw PUT body → disk)
  static async writeRaw(key: string, body: Buffer) {
    const p = join(ROOT, key);
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }

  static async readRaw(key: string): Promise<Buffer> {
    return fs.readFile(join(ROOT, key));
  }
}
