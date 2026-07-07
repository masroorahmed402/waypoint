import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfig } from '../../config/app.config';
import { StorageService, PresignedUpload } from './storage.interface';

@Injectable()
export class S3Storage implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor(config: AppConfig) {
    // A custom endpoint (e.g. Cloudflare R2, MinIO) uses path-style addressing.
    this.client = new S3Client({
      region: config.s3Region,
      ...(config.s3Endpoint ? { endpoint: config.s3Endpoint, forcePathStyle: true } : {}),
    });
    this.bucket = config.s3Bucket;
  }

  async presignUpload(key: string, contentType: string): Promise<PresignedUpload> {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: 60 });
    return { url, method: 'PUT', headers: { 'Content-Type': contentType } };
  }

  async presignDownload(key: string, fileName: string): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, '')}"`,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: 120 });
  }

  async head(key: string) {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { exists: true, sizeBytes: res.ContentLength, contentType: res.ContentType };
    } catch {
      return { exists: false };
    }
  }

  async read(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
