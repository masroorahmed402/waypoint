/**
 * F-1 rules engine — v2026.07
 *
 * Pure functions: profile dates in, milestones/deadlines out. No I/O, no DB.
 * Every rule cites its basis. When policy changes, bump RULE_VERSION and edit here ONLY.
 *
 * ⚠ These encode *general* F-1 rules. Individual cases vary. Every surface that
 * shows this output must carry the "informational only — confirm with your DSO"
 * notice. That is a product requirement, not boilerplate.
 */

export const RULE_VERSION = 'f1-2026.07';

export interface ProfileDates {
  programStartDate: Date;
  programEndDate: Date;
  usEntryDate?: Date | null;
}

export type MilestoneStatus = 'PAST' | 'CURRENT' | 'UPCOMING';

export interface Milestone {
  key: string;
  label: string;
  date?: Date;
  dateRange?: { start: Date; end: Date };
  status: MilestoneStatus;
  explanation: string;
  sourceUrl?: string;
}

export interface GeneratedDeadline {
  dedupeKey: string;
  type:
    | 'OPT_WINDOW_OPEN'
    | 'OPT_FILING_DEADLINE'
    | 'GRACE_PERIOD_END'
    | 'TRAVEL_SIGNATURE';
  title: string;
  dueDate: Date;
  notes: string;
}

const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/** Full journey timeline, computed — never stored (see DATABASE.md). */
export function computeTimeline(p: ProfileDates, now = new Date()): Milestone[] {
  const items: Milestone[] = [];

  if (p.usEntryDate) {
    items.push({
      key: 'arrival',
      label: 'Arrived in the U.S.',
      date: p.usEntryDate,
      status: 'PAST',
      explanation: 'F-1 students may enter up to 30 days before the program start date on the I-20.',
      sourceUrl: 'https://studyinthestates.dhs.gov/students/prepare/getting-to-the-united-states',
    });
  }

  items.push({
    key: 'program_start',
    label: 'Program start',
    date: p.programStartDate,
    status: status(p.programStartDate, now),
    explanation: 'Your I-20 program start date. Full-time enrollment is required to maintain status.',
  });

  // SSN: eligible once in the U.S. with an on-campus job offer or work authorization.
  const ssnFrom = p.usEntryDate ?? p.programStartDate;
  items.push({
    key: 'ssn_eligible',
    label: 'SSN eligibility (with job offer)',
    date: ssnFrom,
    status: status(ssnFrom, now),
    explanation:
      'You can apply for an SSN once you have an on-campus job offer (or CPT/OPT authorization). There is no SSN without work authorization.',
    sourceUrl: 'https://www.ssa.gov/pubs/EN-05-10181.pdf',
  });

  // CPT: generally after one full academic year of enrollment (grad programs with
  // required immediate internships are the exception — DSO call).
  const cptFrom = addDays(p.programStartDate, 365);
  items.push({
    key: 'cpt_eligible',
    label: 'CPT eligibility (typical)',
    date: cptFrom,
    status: status(cptFrom, now),
    explanation:
      'Curricular Practical Training generally requires one full academic year of enrollment first. Some graduate programs qualify sooner — ask your DSO.',
    sourceUrl: 'https://studyinthestates.dhs.gov/sevis-help-hub/student-records/fm-student-employment/f-1-curricular-practical-training-cpt',
  });

  // OPT filing window: opens 90 days before program end, closes 60 days after.
  const optOpen = addDays(p.programEndDate, -90);
  const optClose = addDays(p.programEndDate, 60);
  items.push({
    key: 'opt_window',
    label: 'Post-completion OPT filing window',
    dateRange: { start: optOpen, end: optClose },
    status: now < optOpen ? 'UPCOMING' : now > optClose ? 'PAST' : 'CURRENT',
    explanation:
      'USCIS accepts Form I-765 for post-completion OPT from 90 days before your program end date until 60 days after — AND within 30 days of your DSO issuing the OPT recommendation I-20. File early; the window closing is unforgiving.',
    sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students',
  });

  items.push({
    key: 'program_end',
    label: 'Program end',
    date: p.programEndDate,
    status: status(p.programEndDate, now),
    explanation: 'Program end date on your I-20 (typically your graduation term end).',
  });

  const graceEnd = addDays(p.programEndDate, 60);
  items.push({
    key: 'grace_period_end',
    label: '60-day grace period ends',
    date: graceEnd,
    status: status(graceEnd, now),
    explanation:
      'After program completion (without OPT), you have 60 days to depart the U.S., transfer, or change status.',
    sourceUrl: 'https://studyinthestates.dhs.gov/2014/08/understanding-your-grace-period',
  });

  return items;
}

/** System deadlines that need reminder state → persisted via upsert on dedupeKey. */
export function computeSystemDeadlines(p: ProfileDates): GeneratedDeadline[] {
  const optOpen = addDays(p.programEndDate, -90);
  const optClose = addDays(p.programEndDate, 60);
  const graceEnd = addDays(p.programEndDate, 60);

  return [
    {
      dedupeKey: 'opt_window_open',
      type: 'OPT_WINDOW_OPEN',
      title: 'OPT filing window opens',
      dueDate: optOpen,
      notes:
        'Earliest day USCIS accepts your post-completion OPT application (90 days before program end). Talk to your DSO ~2 weeks before this to get the OPT I-20.',
    },
    {
      dedupeKey: 'opt_filing_deadline',
      type: 'OPT_FILING_DEADLINE',
      title: 'OPT filing deadline',
      dueDate: optClose,
      notes:
        'Hard deadline: USCIS must RECEIVE your I-765 within 60 days after program end. Missing this forfeits OPT.',
    },
    {
      dedupeKey: 'grace_period_end',
      type: 'GRACE_PERIOD_END',
      title: '60-day grace period ends',
      dueDate: graceEnd,
      notes: 'Depart, transfer, or change status by this date if not on OPT.',
    },
    {
      dedupeKey: 'travel_signature',
      type: 'TRAVEL_SIGNATURE',
      title: 'Check I-20 travel signature before any trip',
      // Annual reminder anchored to program start anniversary within program:
      dueDate: nextAnniversary(p.programStartDate, new Date(), p.programEndDate),
      notes:
        'I-20 travel signatures are valid 12 months (6 months on OPT). Get a fresh signature from your DSO before international travel.',
    },
  ];
}

function status(d: Date, now: Date): MilestoneStatus {
  const diff = d.getTime() - now.getTime();
  if (diff < -14 * DAY) return 'PAST';
  if (diff > 14 * DAY) return 'UPCOMING';
  return 'CURRENT';
}

function nextAnniversary(anchor: Date, now: Date, cap: Date): Date {
  const d = new Date(anchor);
  while (d < now) d.setFullYear(d.getFullYear() + 1);
  return d > cap ? cap : d;
}
