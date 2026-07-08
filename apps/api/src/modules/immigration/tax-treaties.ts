/** Informational only, not tax advice. Keyed by uppercased country name as stored on StudentProfile.countryOfCitizenship. */
export const TAX_TREATIES: Record<string, string> = {
  INDIA: 'India has a tax treaty with the US covering students. Article 21 may exempt scholarship/fellowship income. Wages are generally taxable.',
  CHINA: 'China has a tax treaty. Article 20 may exempt up to $5,000 of wages for 3 years for students.',
  'SOUTH KOREA': 'Korea has a treaty. Article 21 exempts student wages for up to $2,000/year.',
  KOREA: 'Korea has a treaty. Article 21 exempts student wages for up to $2,000/year.',
  CANADA: 'Canada has a treaty but F-1 student wages are generally taxable.',
  GERMANY: 'Germany has a treaty. Article 20 may provide exemptions for students.',
  JAPAN: 'Japan has a treaty with student provisions.',
  MEXICO: 'Mexico has a treaty with student wage exemption provisions.',
  FRANCE: 'France has a treaty with student provisions.',
  UK: 'UK has a treaty but student wage exemptions are limited.',
  'UNITED KINGDOM': 'UK has a treaty but student wage exemptions are limited.',
  ITALY: 'Italy has a treaty with student provisions.',
  SPAIN: 'Spain has a treaty with student provisions.',
  NETHERLANDS: 'Netherlands has a treaty with student provisions.',
  BELGIUM: 'Belgium has a treaty with student provisions.',
  BRAZIL: 'Brazil does not have an income tax treaty with the US.',
  PAKISTAN: 'Pakistan has a treaty with student provisions.',
  BANGLADESH: 'Bangladesh has a treaty. Article 21 exempts student wages up to $8,000/year.',
  NIGERIA: 'Nigeria does not have an income tax treaty with the US.',
  INDONESIA: 'Indonesia has a treaty with student provisions.',
  THAILAND: 'Thailand has a treaty with student provisions.',
  PHILIPPINES: 'Philippines has a treaty. Article 22 exempts student wages up to $3,000/year.',
  VIETNAM: 'Vietnam does not have an income tax treaty with the US.',
  ISRAEL: 'Israel has a treaty with student provisions.',
  EGYPT: 'Egypt has a treaty with student provisions.',
  POLAND: 'Poland has a treaty. Article 18 exempts student wages up to $2,000/year.',
  ROMANIA: 'Romania has a treaty. Article 20 exempts student wages up to $5,000/year.',
  UKRAINE: 'Ukraine has a treaty with student provisions.',
  RUSSIA: 'Russia has a treaty with student provisions.',
  TURKEY: 'Turkey does not have an income tax treaty with the US.',
  KENYA: 'Kenya does not have an income tax treaty with the US.',
  'SAUDI ARABIA': 'Saudi Arabia does not have an income tax treaty with the US.',
  AUSTRALIA: 'Australia does not have specific student wage exemptions under its US treaty.',
  NEPAL: 'Nepal does not have an income tax treaty with the US.',
  'SRI LANKA': 'Sri Lanka does not have an income tax treaty with the US.',
};

/** Best-effort lookup by free-text country name (matches on uppercased exact or substring). */
export function lookupTaxTreaty(countryOfCitizenship: string | null | undefined): string {
  if (!countryOfCitizenship) return 'Check IRS Publication 901 for your country';
  const key = countryOfCitizenship.trim().toUpperCase();
  if (TAX_TREATIES[key]) return TAX_TREATIES[key];
  const match = Object.keys(TAX_TREATIES).find((k) => key.includes(k) || k.includes(key));
  return match ? TAX_TREATIES[match] : 'Check IRS Publication 901 for your country';
}
