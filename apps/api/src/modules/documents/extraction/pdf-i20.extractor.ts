import { Injectable } from '@nestjs/common';
import { DocumentExtractor, I20Extract, CptOptAuthorization } from './i20-extract.type';
import { readPdfText } from './pdf-text.util';

/**
 * Free, on-server I-20 extractor. Reads the PDF text layer (no AI, no API, no cost)
 * and pulls known fields by their labels. Works on genuine SEVIS-issued digital
 * I-20 PDFs; returns hasTextLayer=false for scanned images / phone photos so the
 * UI can fall back to manual entry.
 *
 * This is deliberately conservative: it returns a field only when reasonably
 * confident, because a wrong auto-filled immigration date is worse than a blank
 * one. The user always confirms before anything is saved.
 *
 * ⚠ The CPT/OPT employment-authorization table parser (parseCptOptTable) is the
 * most fragile part of this file: pdf-parse flattens table cells into linear
 * text with NO separator between cells on real SEVIS-generated PDFs (e.g.
 * "CPTFULL TIMEAPPROVED24 JUNE 202608 SEPTEMBER 2026"), so nothing here can
 * rely on \b word boundaries or whitespace between fields. This has been
 * verified end-to-end against one real, signed I-20 with an active CPT
 * authorization (every field extracted correctly, including employer name and
 * city) — but PDF cell ordering varies by SEVIS/school software version, so
 * treat it as tested-once, not proven-universal. Re-verify against another
 * real sample before trusting it blindly on a new layout.
 */
@Injectable()
export class PdfI20Extractor implements DocumentExtractor {
  async extractI20(pdfBytes: Buffer): Promise<I20Extract> {
    const text = await this.readText(pdfBytes);
    const empty = baseResult();

    if (!text || text.replace(/\s/g, '').length < 40) {
      return {
        ...empty,
        hasTextLayer: false,
        notice:
          'This file has no readable text (likely a scan or photo). Please fill the form in manually.',
      };
    }

    const flat = text.replace(/\r/g, '\n');
    const found: string[] = [];

    // SEVIS ID appears on both page 1 and page 2 ("SEVIS ID: N0033396290" or
    // "SEVIS ID#"/"SEVIS ID Number" variants) — try the common form first.
    let sevisId = flat.match(/SEVIS\s*ID[:\s#]*\s*(N\d{9,11})/i)?.[1]?.toUpperCase() ?? null;
    if (!sevisId) sevisId = this.matchSevisId(flat);
    if (sevisId) found.push('sevisId');

    const surname = this.labelValue(flat, ['SURNAME/PRIMARY NAME', 'Surname/Primary Name', 'Surname', 'Family Name']);
    if (surname) found.push('surname');
    const givenName = this.labelValue(flat, ['GIVEN NAME', 'Given Name', 'First Name']);
    if (givenName) found.push('givenName');
    const fullName = givenName && surname ? `${givenName} ${surname}` : null;
    if (fullName) found.push('fullName');

    const preferredName = this.labelValue(flat, ['PREFERRED NAME', 'Preferred Name']);
    if (preferredName) found.push('preferredName');
    const passportName = this.labelValue(flat, ['PASSPORT NAME', 'Passport Name']);
    if (passportName) found.push('passportName');
    const countryOfBirth = this.labelValue(flat, ['COUNTRY OF BIRTH', 'Country of Birth']);
    if (countryOfBirth) found.push('countryOfBirth');
    const countryOfCitizenship = this.labelValue(flat, ['COUNTRY OF CITIZENSHIP', 'Country of Citizenship']);
    if (countryOfCitizenship) found.push('countryOfCitizenship');
    const dateOfBirth = this.dateAfterLabel(flat, ['DATE OF BIRTH', 'Date of Birth']);
    if (dateOfBirth) found.push('dateOfBirth');
    const admissionNumber = this.labelValue(flat, ['ADMISSION NUMBER', 'Admission Number']);
    if (admissionNumber) found.push('admissionNumber');

    const schoolName = this.labelValue(flat, ['SCHOOL NAME', 'School Name', 'Name of School']);
    if (schoolName) found.push('schoolName');

    // DSO block: label is "SCHOOL OFFICIAL TO CONTACT UPON ARRIVAL", value is
    // two lines — name, then title.
    let schoolOfficialName: string | null = null;
    let schoolOfficialTitle: string | null = null;
    const dsoBlock = this.textAfterLabel(flat, ['SCHOOL OFFICIAL TO CONTACT UPON ARRIVAL']);
    if (dsoBlock) {
      const lines = dsoBlock.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines[0]) { schoolOfficialName = lines[0]; found.push('schoolOfficialName'); }
      if (lines[1]) { schoolOfficialTitle = lines[1]; found.push('schoolOfficialTitle'); }
    }

    // MAJOR 1's value often spans two lines on real I-20s — the program name,
    // then "General 11.0201" (the CIP code) on the next line — so this reads
    // a multi-line block rather than labelValue's single-line capture.
    let programOfStudy: string | null = null;
    let cipCode: string | null = null;
    const majorBlock = this.textAfterLabel(flat, ['MAJOR 1', 'Program of Study', 'Major'], 150);
    if (majorBlock) {
      const cipMatch = majorBlock.match(/(\d{2}\.\d{4})/);
      cipCode = cipMatch ? cipMatch[1] : null;
      const raw = cipMatch ? majorBlock.slice(0, cipMatch.index) : majorBlock.split('\n')[0];
      programOfStudy = raw
        .replace(/General\s*$/i, '')
        .replace(/[,\n]+$/g, '')
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim() || null;
    }
    if (programOfStudy) found.push('programOfStudy');
    if (cipCode) found.push('cipCode');
    const isStemDegree = detectStemFromCip(cipCode);

    let programStartDate: string | null = null;
    let programEndDate: string | null = null;

    // Real I-20s list a single combined "PROGRAM START/END DATE" field
    // (e.g. "07 SEPTEMBER 2022 - 11 JUNE 2027") rather than two separate ones.
    const programDateLine = this.textAfterLabel(flat, [
      'PROGRAM START/END DATE', 'Program Start/End Date', 'Program Start / End Date',
    ]);
    if (programDateLine) {
      const dates = this.extractAllDates(programDateLine);
      if (dates.length >= 2) {
        programStartDate = dates[0];
        programEndDate = dates[1];
      } else if (dates.length === 1) {
        programStartDate = dates[0];
      }
    }
    if (programStartDate) found.push('programStartDate');

    // Fall back to separate labels if the combined field didn't work.
    if (!programStartDate) {
      const fallback = this.dateAfterLabel(flat, ['Program Start Date', 'Start of Classes', 'Program Start']);
      if (fallback) { programStartDate = fallback; found.push('programStartDate'); }
    }
    if (!programEndDate) {
      const fallback = this.dateAfterLabel(flat, ['Program End Date', 'End of Program', 'Complete Studies By']);
      if (fallback) { programEndDate = fallback; found.push('programEndDate'); }
    }

    const startOfClasses = this.dateAfterLabel(flat, ['START OF CLASSES', 'Start of Classes']);
    if (startOfClasses) found.push('startOfClasses');

    const issueDate = this.dateAfterLabel(flat, ['DATE ISSUED', 'Date Issued']);
    if (issueDate) found.push('issueDate');

    // Real I-20s glue the two headers and the two values together with no
    // separator ("CURRENT SESSION START DATECURRENT SESSION END DATE" then
    // "28 MARCH 202612 JUNE 2026") — extract both dates from after the last
    // header occurrence using the month-anchored (concatenation-safe) reader.
    let currentSessionStart: string | null = null;
    let currentSessionEnd: string | null = null;
    const sessionHeaders = [...flat.matchAll(/CURRENT SESSION (START|END) DATE/gi)];
    if (sessionHeaders.length) {
      const last = sessionHeaders[sessionHeaders.length - 1];
      const afterHeaders = flat.slice(last.index! + last[0].length, last.index! + last[0].length + 100);
      const sessionDates = this.extractDatesAnchoredOnMonth(afterHeaders);
      currentSessionStart = sessionDates[0] ?? null;
      currentSessionEnd = sessionDates[1] ?? null;
    }
    if (currentSessionStart) found.push('currentSessionStart');
    if (currentSessionEnd) found.push('currentSessionEnd');

    const degreeLevel = this.degreeLevel(flat);
    if (degreeLevel) found.push('degreeLevel');

    const authorizations = this.parseCptOptTable(flat);
    if (authorizations.length) found.push('authorizations');

    const gotAnything = found.length > 0;
    let notice = gotAnything
      ? 'Filled from your I-20 — please review each field before continuing.'
      : 'We read the file but could not confidently identify I-20 fields. Please fill the form manually.';

    // Stale-I20 nudge: a lot can happen (CPT, OPT, extensions) between issuance and today.
    if (issueDate) {
      const monthsSinceIssue = (Date.now() - new Date(issueDate).getTime()) / (30 * 24 * 60 * 60 * 1000);
      if (monthsSinceIssue > 18) {
        notice += ` ⚠️ This I-20 was issued ${issueDate}. If you've had CPT, OPT, or a program extension since then, upload your most recent I-20 for accurate deadlines.`;
      }
    }

    return {
      hasTextLayer: true,
      sevisId,
      surname,
      givenName,
      fullName,
      preferredName,
      countryOfBirth,
      countryOfCitizenship,
      dateOfBirth,
      admissionNumber,
      passportName,
      schoolName,
      schoolOfficialName,
      schoolOfficialTitle,
      programOfStudy,
      cipCode,
      isStemDegree,
      degreeLevel,
      programStartDate,
      programEndDate,
      startOfClasses,
      issueDate,
      currentSessionStart,
      currentSessionEnd,
      authorizations,
      foundFields: found,
      notice,
    };
  }

  // ── PDF text ────────────────────────────────────────────────────────────

  private async readText(bytes: Buffer): Promise<string> {
    return readPdfText(bytes);
  }

  // ── field helpers ───────────────────────────────────────────────────────

  private matchSevisId(text: string): string | null {
    // SEVIS IDs are N followed by 9–11 digits; prefer one near a "SEVIS ID" label.
    const labels = ['SEVIS ID#', 'SEVIS ID Number', 'SEVIS ID'];
    for (const label of labels) {
      const re = new RegExp(`${escapeRe(label)}[^\\n]*?(N\\d{9,11})`, 'i');
      const m = text.match(re);
      if (m) return m[1].toUpperCase();
    }
    const any = text.match(/\bN\d{10}\b/);
    return any ? any[0].toUpperCase() : null;
  }

  private labelValue(text: string, labels: string[]): string | null {
    for (const label of labels) {
      const re = new RegExp(
        `${escapeRe(label)}\\s*[:\\-]?\\s*\\n?\\s*([^\\n]{1,80})`,
        'i',
      );
      const m = text.match(re);
      if (m) {
        const val = m[1].trim().replace(/\s{2,}/g, ' ');
        // reject values that are obviously another label or empty
        if (val && !/^(surname|given|school|major|program|date)/i.test(val)) return val;
      }
    }
    return null;
  }

  /** Like labelValue, but returns the raw multi-line block after the label (e.g. a two-line name+title). */
  private textAfterLabel(text: string, labels: string[], maxChars = 200): string | null {
    for (const label of labels) {
      const idx = text.toLowerCase().indexOf(label.toLowerCase());
      if (idx === -1) continue;
      const raw = text.slice(idx + label.length, idx + label.length + maxChars);
      const trimmed = raw.replace(/^[\s:.\-]+/, '');
      if (trimmed.trim()) return trimmed;
    }
    return null;
  }

  private dateAfterLabel(text: string, labels: string[]): string | null {
    for (const label of labels) {
      const idx = text.toLowerCase().indexOf(label.toLowerCase());
      if (idx === -1) continue;
      const window = text.slice(idx, idx + 160);
      const iso = this.firstDateToIso(window);
      if (iso) return iso;
    }
    return null;
  }

  /** Finds every date in a string and returns them as ISO strings, in the order they appear. */
  private extractAllDates(text: string): string[] {
    // No trailing \b — see firstDateToIso for why (dates can run into the next
    // cell with zero separator on real I-20s).
    const re = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})|\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/g;
    const dates: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) {
        dates.push(`${m[3]}-${pad(m[1])}-${pad(m[2])}`);
      } else if (m[5]) {
        const mon = MONTHS[m[5].slice(0, 3).toLowerCase()];
        if (mon) dates.push(`${m[6]}-${pad(String(mon))}-${pad(m[4])}`);
      }
    }
    return dates;
  }

  private firstDateToIso(s: string): string | null {
    // MM/DD/YYYY (SEVIS default). No trailing \b: on real I-20s a date can run
    // straight into the next cell with no separator (e.g. "2026Chicago"), and
    // \d{4} already exactly bounds the year regardless of what follows.
    const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) {
      const [, mm, dd, yyyy] = slash;
      return `${yyyy}-${pad(mm)}-${pad(dd)}`;
    }
    // DD MONTH YYYY  (e.g., 26 AUGUST 2024)
    const named = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
    if (named) {
      const [, dd, mon, yyyy] = named;
      const m = MONTHS[mon.slice(0, 3).toLowerCase()];
      if (m) return `${yyyy}-${pad(String(m))}-${pad(dd)}`;
    }
    return null;
  }

  private degreeLevel(text: string): I20Extract['degreeLevel'] {
    const t = text.toUpperCase();
    if (/\bDOCTOR|PH\.?D|DOCTORATE\b/.test(t)) return 'PHD';
    if (/\bMASTER'?S?\b/.test(t)) return 'MASTERS';
    if (/\bBACHELOR'?S?\b/.test(t)) return 'BACHELORS';
    if (/\bASSOCIATE'?S?\b/.test(t)) return 'OTHER';
    return null;
  }

  /**
   * Parses the "EMPLOYMENT AUTHORIZATIONS" table (TYPE | FULL/PART-TIME | STATUS |
   * START DATE | END DATE) and pairs each row with the corresponding "EMPLOYER
   * NAME | START DATE | END DATE | CITY & STATE" row from the EMPLOYER INFORMATION
   * section. Best-effort — see class-level doc comment.
   *
   * Real SEVIS-generated I-20s (verified against an actual sample) run these
   * table cells together with NO separator at all — e.g.
   * "CPTFULL TIMEAPPROVED24 JUNE 202608 SEPTEMBER 2026" — so nothing here can
   * rely on \b word boundaries or whitespace between cells. Dates in particular
   * are found by anchoring on the (always-alphabetic, always-bounded) month
   * name and reading the day/year directly off its neighboring characters,
   * rather than matching a "day month year" pattern as one unit.
   */
  private parseCptOptTable(text: string): CptOptAuthorization[] {
    const sectionIdx = text.search(/EMPLOYMENT\s+AUTHORIZATIONS/i);
    if (sectionIdx === -1) return [];

    // "EMPLOYMENT AUTHORIZATIONS" and "EMPLOYER INFORMATION" often appear
    // together up front as page section tab-titles, with no actual data
    // between them — the real column header ("TYPE | FULL/PART-TIME |
    // STATUS | ...") is the reliable anchor for where the data table starts.
    const headerRel = text.slice(sectionIdx).search(/FULL\/PART[\s-]?TIME/i);
    if (headerRel === -1) return [];
    const authStart = sectionIdx + headerRel;

    const authStopWords = ['AUTHORIZATION DATES', 'EMPLOYER NAME', 'SCHOOL ATTESTATION', 'STUDENT ATTESTATION', 'REMARKS'];
    let authEnd = text.length;
    for (const w of authStopWords) {
      const rel = text.slice(authStart).search(new RegExp(escapeRe(w), 'i'));
      if (rel !== -1) authEnd = Math.min(authEnd, authStart + rel);
    }
    const authText = text.slice(authStart, authEnd);

    const empStopWords = ['CURRENT SESSION', 'SCHOOL ATTESTATION', 'STUDENT ATTESTATION', 'REMARKS'];
    let empEnd = text.length;
    for (const w of empStopWords) {
      const rel = text.slice(authEnd).search(new RegExp(escapeRe(w), 'i'));
      if (rel !== -1) empEnd = Math.min(empEnd, authEnd + rel);
    }
    const employerText = text.slice(authEnd, empEnd);

    // Leading \b only — a concatenated cell like "CPTFULL TIME..." has no
    // trailing word boundary after "CPT" since both sides are word chars.
    const typeRe = /\b(CPT|OPT)/g;
    const rows: { type: 'CPT' | 'OPT'; fullOrPartTime: CptOptAuthorization['fullOrPartTime']; status: string; startDate: string | null; endDate: string | null }[] = [];
    let m: RegExpExecArray | null;
    const typeIdx: number[] = [];
    while ((m = typeRe.exec(authText)) !== null) typeIdx.push(m.index);

    for (let i = 0; i < typeIdx.length; i++) {
      const start = typeIdx[i];
      const end = i + 1 < typeIdx.length ? typeIdx[i + 1] : authText.length;
      const window = authText.slice(start, Math.min(end, start + 200));
      const type = window.slice(0, 3).toUpperCase() as 'CPT' | 'OPT';

      const fullPartMatch = window.match(/FULL[\s-]?TIME|PART[\s-]?TIME/i);
      const fullOrPartTime: CptOptAuthorization['fullOrPartTime'] = fullPartMatch
        ? (fullPartMatch[0].toUpperCase().includes('FULL') ? 'FULL TIME' : 'PART TIME')
        : null;
      const statusMatch = window.match(/AUTHORIZED|COMPLETED|PENDING|APPROVED|TERMINATED/i);
      const status = statusMatch ? statusMatch[0].toUpperCase() : 'UNKNOWN';
      const dates = this.extractDatesAnchoredOnMonth(window);
      rows.push({ type, fullOrPartTime, status, startDate: dates[0] ?? null, endDate: dates[1] ?? null });
    }
    if (!rows.length) return [];

    const employers = this.parseEmployerRows(employerText, rows.length);
    return rows.map((r, i) => ({
      ...r,
      employerName: employers[i]?.name ?? null,
      employerCity: employers[i]?.city ?? null,
    }));
  }

  /**
   * Finds "DD MONTH YYYY" dates by anchoring on the month name and reading the
   * day/year off the characters immediately around it — robust to zero
   * separators between cells (see parseCptOptTable doc comment).
   */
  private extractDatesAnchoredOnMonth(text: string): string[] {
    const monthRe = /(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/gi;
    const dates: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = monthRe.exec(text)) !== null) {
      const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
      if (!mon) continue;
      const before = text.slice(Math.max(0, m.index - 3), m.index);
      const dayMatch = before.match(/(\d{1,2})\s*$/);
      const after = text.slice(m.index + m[1].length, m.index + m[1].length + 6);
      const yearMatch = after.match(/^\s*(\d{4})/);
      if (dayMatch && yearMatch) {
        dates.push(`${yearMatch[1]}-${pad(String(mon))}-${pad(dayMatch[1])}`);
      }
    }
    return dates;
  }

  /**
   * Best-effort "EMPLOYER NAME ... CITY, ST" row scan. Anchors on the literal
   * "EMPLOYER NAME" header (not a CPT/OPT token — the employer data row itself
   * doesn't necessarily contain one) and reads the next non-empty line as the
   * data row, stripping the two dates out by their exact matched span so only
   * the employer name and city text remain.
   */
  private parseEmployerRows(text: string, expected: number): { name: string | null; city: string | null }[] {
    if (!text) return [];
    const out: { name: string | null; city: string | null }[] = [];
    const headerRe = /EMPLOYER\s*NAME/gi;
    let m: RegExpExecArray | null;
    while ((m = headerRe.exec(text)) !== null && out.length < expected) {
      // "EMPLOYER NAME" often has the rest of the header row concatenated
      // right after it on the same line ("EMPLOYER NAMESTART DATEEND
      // DATECITY & STATE") — skip past that whole line, not just the label.
      const lineEnd = text.indexOf('\n', m.index);
      const searchFrom = lineEnd === -1 ? text.length : lineEnd + 1;
      const after = text.slice(searchFrom, searchFrom + 300);
      const line = after.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
      if (!line) continue;
      out.push(this.parseEmployerDataRow(line));
    }
    return out;
  }

  private parseEmployerDataRow(row: string): { name: string | null; city: string | null } {
    // Strip the two dates (matched by exact span, not just a pattern) so what's
    // left is just "Employer Name" followed by "City, ST". Column gaps (2+
    // spaces), if the extracted text preserved any, are kept intact through
    // this step so they can still guide the name/city split below.
    let cleaned = row;
    const monthRe = /(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/gi;
    const spans: { start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = monthRe.exec(row)) !== null) {
      const dayStart = Math.max(0, m.index - 3);
      const before = row.slice(dayStart, m.index);
      const dayMatch = before.match(/(\d{1,2})\s*$/);
      const after = row.slice(m.index + m[1].length, m.index + m[1].length + 6);
      const yearMatch = after.match(/^\s*(\d{4})/);
      if (dayMatch && yearMatch && dayMatch.index !== undefined) {
        spans.push({
          start: dayStart + dayMatch.index,
          end: m.index + m[1].length + (yearMatch.index ?? 0) + yearMatch[0].length,
        });
      }
    }
    // Remove matched date spans right-to-left so earlier indices stay valid.
    for (const span of spans.reverse()) {
      cleaned = cleaned.slice(0, span.start) + '  ' + cleaned.slice(span.end);
    }
    cleaned = cleaned.replace(/[-–—]/g, ' ');

    const stateMatch = cleaned.match(/,\s*([A-Z]{2})\b/);
    if (!stateMatch || stateMatch.index === undefined) {
      const flat = cleaned.replace(/\s{2,}/g, ' ').trim();
      return { name: flat || null, city: null };
    }

    const beforeComma = cleaned.slice(0, stateMatch.index);
    const state = stateMatch[1];

    // Prefer a real column gap (2+ spaces) between employer name and city if the
    // extracted text preserved one; otherwise fall back to a word-count heuristic.
    const colSplit = beforeComma.match(/^(.*?)\s{2,}(\S.*)$/);
    let name: string;
    let cityPrefix: string;
    if (colSplit) {
      name = colSplit[1];
      cityPrefix = colSplit[2];
    } else {
      const words = beforeComma.trim().split(/\s+/).filter(Boolean);
      const secondToLast = words[words.length - 2]?.toLowerCase();
      // Common two-word US city prefixes ("New York", "Los Angeles", "San Francisco"...).
      const twoWordCity = secondToLast && TWO_WORD_CITY_PREFIXES.has(secondToLast);
      const cityWordCount = twoWordCity ? 2 : 1;
      cityPrefix = words.slice(-cityWordCount).join(' ');
      name = words.slice(0, -cityWordCount).join(' ');
    }

    const city = `${cityPrefix.trim()}, ${state}`;
    return { name: name.replace(/\s{2,}/g, ' ').trim() || null, city };
  }
}

function baseResult(): I20Extract {
  return {
    hasTextLayer: true,
    sevisId: null, surname: null, givenName: null, fullName: null,
    preferredName: null, countryOfBirth: null, countryOfCitizenship: null,
    dateOfBirth: null, admissionNumber: null, passportName: null, schoolName: null,
    schoolOfficialName: null, schoolOfficialTitle: null,
    programOfStudy: null, cipCode: null, isStemDegree: false, degreeLevel: null,
    programStartDate: null,
    programEndDate: null, startOfClasses: null, issueDate: null,
    currentSessionStart: null, currentSessionEnd: null,
    authorizations: [], foundFields: [], notice: null,
  };
}

// STEM CIP code prefixes (published by DHS for OPT STEM extension eligibility)
const STEM_CIP_PREFIXES = [
  '01', // Agriculture
  '03', // Natural Resources
  '04', // Architecture
  '11', // Computer Science — this is yours (11.0201)
  '14', // Engineering
  '15', // Engineering Technology
  '25', // Library Science
  '26', // Biological Sciences
  '27', // Mathematics
  '29', // Military Technologies
  '40', // Physical Sciences
  '41', // Science Technologies
  '42', // Psychology (research)
  '43', // Security Sciences
  '45', // Social Sciences
  '51', // Health Professions
  '52', // Business (select)
];

function detectStemFromCip(cipCode: string | null): boolean {
  if (!cipCode) return false;
  const prefix = cipCode.slice(0, 2);
  return STEM_CIP_PREFIXES.includes(prefix);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: string) => n.padStart(2, '0');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// First word of common two-word US city names, used to decide how many trailing
// words of an unspaced "Employer Name City" run belong to the city.
const TWO_WORD_CITY_PREFIXES = new Set([
  'new', 'los', 'san', 'las', 'fort', 'saint', 'st', 'ann', 'palo', 'santa',
  'long', 'oklahoma', 'salt', 'baton', 'grand', 'college',
]);
