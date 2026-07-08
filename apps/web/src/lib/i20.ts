'use client';
import { api } from './api';

export interface CptOptAuthorization {
  type: 'CPT' | 'OPT';
  fullOrPartTime: 'FULL TIME' | 'PART TIME' | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  employerName: string | null;
  employerCity: string | null;
}

export interface I20Extract {
  hasTextLayer: boolean;
  sevisId: string | null;
  surname: string | null;
  givenName: string | null;
  schoolName: string | null;
  schoolOfficialName: string | null;
  schoolOfficialTitle: string | null;
  programOfStudy: string | null;
  cipCode: string | null;
  isStemDegree: boolean;
  degreeLevel: 'BACHELORS' | 'MASTERS' | 'PHD' | 'OTHER' | null;
  programStartDate: string | null;
  programEndDate: string | null;
  startOfClasses: string | null;
  issueDate: string | null;
  currentSessionStart: string | null;
  currentSessionEnd: string | null;
  authorizations: CptOptAuthorization[];
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
    headers: {
      'Content-Type': file.type || 'application/pdf',
      ...(init.upload.headers ?? {}),
    },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload to storage failed: ${put.status} ${put.statusText}`);

  await api(`/documents/${init.document.id}/confirm`, { method: 'POST' });
  return api<I20Extract>(`/documents/${init.document.id}/extract`, { method: 'POST' });
}
