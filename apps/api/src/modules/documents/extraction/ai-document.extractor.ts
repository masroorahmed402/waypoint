import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfig } from '../../../config/app.config';

const MODEL = 'llama-3.3-70b-versatile';

export interface PassportExtract {
  passportNumber: string | null;
  surname: string | null;
  givenNames: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  placeOfBirth: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuingCountry: string | null;
}

export interface VisaExtract {
  visaType: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  entries: string | null;
  issueCity: string | null;
  controlNumber: string | null;
}

export interface OfferLetterExtract {
  companyName: string | null;
  jobTitle: string | null;
  startDate: string | null;
  salary: number | null;
  salaryPeriod: string | null;
  location: string | null;
  employmentType: string | null;
}

export interface LeaseExtract {
  leaseEndDate: string | null;
  monthlyRent: number | null;
  address: string | null;
  landlordName: string | null;
}

export interface InsuranceExtract {
  expiryDate: string | null;
  provider: string | null;
  policyNumber: string | null;
  coverageType: string | null;
}

export interface TaxExtract {
  taxYear: number | null;
  employer: string | null;
  ficaWithheld: number | null;
  medicareWithheld: number | null;
  totalWages: number | null;
  formType: string | null;
}

/**
 * AI-based structured extraction for document types the free PDF parser can't
 * reliably handle. Uses the same Groq (OpenAI-compatible) client as the AI
 * advisor. Best-effort: returns an all-null object on any failure rather than
 * throwing, since extraction is a bonus, not the primary upload flow.
 */
@Injectable()
export class AiDocumentExtractor {
  private readonly log = new Logger('AiDocumentExtractor');
  private client: OpenAI | null = null;

  constructor(private config: AppConfig) {
    if (config.groqApiKey) {
      this.client = new OpenAI({ apiKey: config.groqApiKey, baseURL: 'https://api.groq.com/openai/v1' });
    }
  }

  extractPassport(text: string): Promise<PassportExtract> {
    return this.extract<PassportExtract>(
      text,
      ['passportNumber', 'surname', 'givenNames', 'nationality', 'dateOfBirth', 'sex', 'placeOfBirth', 'issueDate', 'expiryDate', 'issuingCountry'],
      'a passport',
    );
  }

  extractVisa(text: string): Promise<VisaExtract> {
    return this.extract<VisaExtract>(
      text,
      ['visaType', 'issueDate', 'expiryDate', 'entries', 'issueCity', 'controlNumber'],
      'a US visa stamp page',
    );
  }

  extractOfferLetter(text: string): Promise<OfferLetterExtract> {
    return this.extract<OfferLetterExtract>(
      text,
      ['companyName', 'jobTitle', 'startDate', 'salary', 'salaryPeriod', 'location', 'employmentType'],
      'a job offer letter',
    );
  }

  extractLease(text: string): Promise<LeaseExtract> {
    return this.extract<LeaseExtract>(
      text,
      ['leaseEndDate', 'monthlyRent', 'address', 'landlordName'],
      'a residential lease agreement',
    );
  }

  extractInsurance(text: string): Promise<InsuranceExtract> {
    return this.extract<InsuranceExtract>(
      text,
      ['expiryDate', 'provider', 'policyNumber', 'coverageType'],
      'a health insurance card or policy document',
    );
  }

  extractTax(text: string): Promise<TaxExtract> {
    return this.extract<TaxExtract>(
      text,
      ['taxYear', 'employer', 'ficaWithheld', 'medicareWithheld', 'totalWages', 'formType'],
      'a US tax form (e.g. W-2 or 1042-S)',
    );
  }

  private async extract<T>(text: string, fields: (keyof T & string)[], docLabel: string): Promise<T> {
    const empty = Object.fromEntries(fields.map((f) => [f, null])) as T;
    if (!this.client || !text || text.trim().length < 20) return empty;

    try {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 400,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: `The following is text extracted from ${docLabel}. Extract these fields as a flat JSON object with exactly these keys: ${fields.join(', ')}.
Use null for any field you cannot find. Dates must be ISO 8601 (yyyy-mm-dd). Numbers must be plain numbers with no currency symbols or commas.
Return ONLY the JSON object, no other text.

Document text:
"""
${text.slice(0, 6000)}
"""`,
          },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw);
      const result = { ...empty };
      for (const f of fields) {
        if (parsed[f] !== undefined) (result as Record<string, unknown>)[f] = parsed[f];
      }
      return result;
    } catch (err) {
      this.log.warn(`AI extraction failed for ${docLabel}: ${(err as Error).message}`);
      return empty;
    }
  }
}
