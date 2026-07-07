/** What we try to pull off a Form I-20. Every field is best-effort → may be null. */
export interface I20Extract {
  /** true if the PDF had a real text layer we could read (false for scanned/photo). */
  hasTextLayer: boolean;
  sevisId: string | null;
  surname: string | null;
  givenName: string | null;
  schoolName: string | null;
  programOfStudy: string | null;
  /** Mapped to the app's DegreeLevel enum where possible. */
  degreeLevel: 'BACHELORS' | 'MASTERS' | 'PHD' | 'OTHER' | null;
  /** ISO 8601 (yyyy-mm-dd) or null. */
  programStartDate: string | null;
  programEndDate: string | null;
  /** Which fields we actually found — drives the "review these" UI. */
  foundFields: string[];
  /** Human-readable note when extraction couldn't do much. */
  notice: string | null;
}

export const EXTRACTOR = Symbol('DOCUMENT_EXTRACTOR');

export interface DocumentExtractor {
  extractI20(pdfBytes: Buffer): Promise<I20Extract>;
}
