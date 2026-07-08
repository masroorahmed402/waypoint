/** One row from the I-20's Employment Authorizations / Employer Information tables. */
export interface CptOptAuthorization {
  type: 'CPT' | 'OPT';
  fullOrPartTime: 'FULL TIME' | 'PART TIME' | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  employerName: string | null;
  employerCity: string | null;
}

/** What we try to pull off a Form I-20. Every field is best-effort → may be null. */
export interface I20Extract {
  /** true if the PDF had a real text layer we could read (false for scanned/photo). */
  hasTextLayer: boolean;
  sevisId: string | null;
  surname: string | null;
  givenName: string | null;
  /** GIVEN NAME + SURNAME combined, e.g. "Priya Sharma" — null unless both parts were found. */
  fullName: string | null;
  preferredName: string | null;
  countryOfBirth: string | null;
  countryOfCitizenship: string | null;
  /** ISO 8601 (yyyy-mm-dd) or null. Stored encrypted — never returned to any non-owner. */
  dateOfBirth: string | null;
  admissionNumber: string | null;
  passportName: string | null;
  schoolName: string | null;
  schoolOfficialName: string | null;
  schoolOfficialTitle: string | null;
  programOfStudy: string | null;
  /** CIP code from MAJOR 1 (e.g. "11.0201"), if found. */
  cipCode: string | null;
  /** true if cipCode's 2-digit prefix is on DHS's published STEM OPT extension list. */
  isStemDegree: boolean;
  /** Mapped to the app's DegreeLevel enum where possible. */
  degreeLevel: 'BACHELORS' | 'MASTERS' | 'PHD' | 'OTHER' | null;
  /** ISO 8601 (yyyy-mm-dd) or null. */
  programStartDate: string | null;
  programEndDate: string | null;
  startOfClasses: string | null;
  issueDate: string | null;
  currentSessionStart: string | null;
  currentSessionEnd: string | null;
  authorizations: CptOptAuthorization[];
  /** true if the "AUTHORIZED REDUCED COURSE LOAD" section has content (not blank). */
  rclAuthorized: boolean;
  rclReason: string | null;
  /** ISO 8601 (yyyy-mm-dd) or null. */
  rclEndDate: string | null;
  /** true if the "CHANGE OF STATUS/CAP-GAP EXTENSION" section (I-20 page 2) has content. */
  changeOfStatusDetected: boolean;
  capGapDetected: boolean;
  changeOfStatusNotes: string | null;
  /** Which fields we actually found — drives the "review these" UI. */
  foundFields: string[];
  /** Human-readable note when extraction couldn't do much. */
  notice: string | null;
}

export const EXTRACTOR = Symbol('DOCUMENT_EXTRACTOR');

export interface DocumentExtractor {
  extractI20(pdfBytes: Buffer): Promise<I20Extract>;
}
