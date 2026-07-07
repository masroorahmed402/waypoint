'use client';
import { api } from './api';

export interface I20Extract {
  hasTextLayer: boolean;
  sevisId: string | null;
  surname: string | null;
  givenName: string | null;
  schoolName: string | null;
  programOfStudy: string | null;
  degreeLevel: 'BACHELORS' | 'MASTERS' | 'PHD' | 'OTHER' | null;
  programStartDate: string | null;
  programEndDate: string | null;
  foundFields: string[];
  notice: string | null;
}

/** Runs the full presigned upload flow, then extracts. Bytes go to storage, not the API. */
export async function uploadAndExtractI20(file: File): Promise<I20Extract> {
  const init = await api<{ document: { id: string }; upload: { url: string; headers?: Record<string, string> } }>(
    '/documents',
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'I20',
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        sizeBytes: file.size,
      }),
    },
  );

  const put = await fetch(init.upload.url, {
    method: 'PUT',
    headers: init.upload.headers ?? { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  });
  if (!put.ok) throw new Error('Upload failed — please try again.');

  await api(`/documents/${init.document.id}/confirm`, { method: 'POST' });
  return api<I20Extract>(`/documents/${init.document.id}/extract`, { method: 'POST' });
}
