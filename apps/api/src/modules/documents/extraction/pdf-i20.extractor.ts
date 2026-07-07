import { Injectable } from '@nestjs/common';
import { DocumentExtractor, I20Extract } from './i20-extract.type';

/**
 * Free, on-server I-20 extractor. Reads the PDF text layer (no AI, no API, no cost)
 * and pulls known fields by their labels. Works on genuine SEVIS-issued digital
 * I-20 PDFs; returns hasTextLayer=false for scanned images / phone photos so the
 * UI can fall back to manual entry.
 *
 * This is deliberately conservative: it returns a field only when reasonably
 * confident, because a wrong auto-filled immigration date is worse than a blank
 * one. The user always confirms before anything is saved.
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

    const sevisId = this.matchSevisId(flat);
    if (sevisId) found.push('sevisId');

    const surname = this.labelValue(flat, ['Surname/Primary Name', 'Surname', 'Family Name']);
    if (surname) found.push('surname');
    const givenName = this.labelValue(flat, ['Given Name', 'First Name']);
    if (givenName) found.push('givenName');

    const schoolName = this.labelValue(flat, ['School Name', 'Name of School']);
    if (schoolName) found.push('schoolName');

    const programOfStudy = this.labelValue(flat, ['Major 1', 'Program of Study', 'Major']);
    if (programOfStudy) found.push('programOfStudy');

    let programStartDate: string | null = null;
    let programEndDate: string | null = null;

    // Real I-20s often list a single combined "PROGRAM START/END DATE" field
    // rather than two separate ones — try that first.
    const combined = this.labelValue(flat, [
      'PROGRAM START/END DATE', 'Program Start/End Date', 'Program Start / End Date',
    ]);
    if (combined) {
      const dates = this.extractAllDates(combined);
      if (dates.length >= 2) {
        programStartDate = dates[0];
        programEndDate = dates[1];
        if (programStartDate) found.push('programStartDate');
        if (programEndDate) found.push('programEndDate');
      } else if (dates.length === 1) {
        programStartDate = dates[0];
        if (programStartDate) found.push('programStartDate');
      }
    }

    // Fall back to separate labels if combined didn't work.
    if (!programStartDate) {
      const fallback = this.dateAfterLabel(flat, ['Program Start Date', 'Start of Classes', 'Program Start']);
      if (fallback) { programStartDate = fallback; found.push('programStartDate'); }
    }
    if (!programEndDate) {
      const fallback = this.dateAfterLabel(flat, ['Program End Date', 'End of Program', 'Complete Studies By']);
      if (fallback) { programEndDate = fallback; found.push('programEndDate'); }
    }

    const degreeLevel = this.degreeLevel(flat);
    if (degreeLevel) found.push('degreeLevel');

    const gotAnything = found.length > 0;
    return {
      hasTextLayer: true,
      sevisId,
      surname,
      givenName,
      schoolName,
      programOfStudy,
      degreeLevel,
      programStartDate,
      programEndDate,
      foundFields: found,
      notice: gotAnything
        ? 'Filled from your I-20 — please review each field before continuing.'
        : 'We read the file but could not confidently identify I-20 fields. Please fill the form manually.',
    };
  }

  // ── PDF text ────────────────────────────────────────────────────────────

  private async readText(bytes: Buffer): Promise<string> {
    try {
      // dynamic import avoids pdf-parse's debug-on-require quirk
      const mod: any = await import('pdf-parse');
      const pdf = mod.default ?? mod;
      const data = await pdf(bytes);
      return String(data.text ?? '');
    } catch {
      return '';
    }
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
    const re = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b|\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/g;
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
    // MM/DD/YYYY (SEVIS default)
    const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (slash) {
      const [, mm, dd, yyyy] = slash;
      return `${yyyy}-${pad(mm)}-${pad(dd)}`;
    }
    // DD MONTH YYYY  (e.g., 26 AUGUST 2024)
    const named = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
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
}

function baseResult(): I20Extract {
  return {
    hasTextLayer: true,
    sevisId: null, surname: null, givenName: null, schoolName: null,
    programOfStudy: null, degreeLevel: null, programStartDate: null,
    programEndDate: null, foundFields: [], notice: null,
  };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: string) => n.padStart(2, '0');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
