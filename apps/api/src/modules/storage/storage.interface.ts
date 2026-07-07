export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  headers?: Record<string, string>;
}

export interface StorageService {
  presignUpload(key: string, contentType: string, maxBytes: number): Promise<PresignedUpload>;
  presignDownload(key: string, fileName: string): Promise<string>;
  head(key: string): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string }>;
  read(key: string): Promise<Buffer>; // server-side read, e.g. for document extraction
  delete(key: string): Promise<void>;
}
