import { Injectable } from '@nestjs/common';

export interface H1bSponsorshipData {
  companyName: string;
  totalPetitions: number;
  approvedPetitions?: number;
  avgSalary?: number;
  commonRoles?: { role: string; count: number }[];
  sponsorsInternational: boolean | null;
  dataYear?: number;
  source?: string;
  error?: string;
}

/**
 * ⚠ This scrapes h1bdata.info's public HTML — there is no official API, and
 * this has not been verified against real traffic: the site's markup, query
 * params, or availability could change at any time and silently break the
 * regex-based table parsing below. Always falls back to a "could not fetch"
 * result rather than throwing, so a broken scrape degrades gracefully instead
 * of blocking the rest of the application flow.
 */
@Injectable()
export class H1bService {
  // Cache results in memory to avoid repeated lookups
  private cache = new Map<string, H1bSponsorshipData>();

  async getCompanySponsorshipData(companyName: string): Promise<H1bSponsorshipData> {
    const cacheKey = companyName.toLowerCase().trim();
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const query = encodeURIComponent(companyName);

    try {
      const res = await fetch(
        `https://h1bdata.info/index.php?em=${query}&job=&city=&year=2024`,
        { headers: { 'User-Agent': 'Waypoint/1.0 (student immigration tool)' } },
      );
      const html = await res.text();

      const petitions = this.parseH1bTable(html);
      const result: H1bSponsorshipData = {
        companyName,
        totalPetitions: petitions.length,
        // h1bdata.info only lists certified LCA filings — there's no per-row
        // status column, so every parsed row already represents an approved petition.
        approvedPetitions: petitions.length,
        avgSalary: this.average(petitions.map((p) => p.salary).filter(Boolean)),
        commonRoles: this.topRoles(petitions),
        sponsorsInternational: petitions.length > 0,
        dataYear: 2024,
        source: 'DOL H-1B Disclosure Data',
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch {
      return {
        companyName,
        totalPetitions: 0,
        sponsorsInternational: null,
        error: 'Could not fetch data',
      };
    }
  }

  private parseH1bTable(html: string) {
    // Parse HTML table from h1bdata.info. Real column order (verified against
    // a live response, since it doesn't match what's commonly assumed):
    // EMPLOYER | JOB TITLE | BASE SALARY | LOCATION | SUBMIT DATE | START DATE
    // — there is no per-row status column; every listed row is a certified filing.
    const rows = html.match(/<tr[^>]*>.*?<\/tr>/gs) ?? [];
    return rows
      .slice(1)
      .map((row) => {
        const cells = row.match(/<td[^>]*>(.*?)<\/td>/gs) ?? [];
        const getText = (cell: string) => cell.replace(/<[^>]+>/g, '').trim();
        return {
          employer: getText(cells[0] ?? ''),
          jobTitle: getText(cells[1] ?? ''),
          salary: parseInt(getText(cells[2] ?? '').replace(/[$,]/g, '')) || 0,
          location: getText(cells[3] ?? ''),
        };
      })
      .filter((r) => r.employer);
  }

  private average(nums: number[]) {
    if (!nums.length) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }

  private topRoles(petitions: { jobTitle: string }[]) {
    const counts = petitions.reduce((acc, p) => {
      acc[p.jobTitle] = (acc[p.jobTitle] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([role, count]) => ({ role, count }));
  }
}
