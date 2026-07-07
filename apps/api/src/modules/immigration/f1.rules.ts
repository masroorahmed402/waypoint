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
  stemEligible?: boolean;
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
    | 'TRAVEL_SIGNATURE'
    | 'STEM_OPT_REPORT'
    | 'STEM_OPT_EXTENSION_END';
  title: string;
  dueDate: Date;
  notes: string;
}

const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const addMonths = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
};

// Typical (informational) post-completion OPT authorization period — actual
// start depends on USCIS processing of the I-765; ask your DSO for exact dates.
const TYPICAL_OPT_MONTHS = 12;
// STEM OPT extension length as configured for this rules version.
const STEM_EXTENSION_MONTHS = 17;

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

  if (p.stemEligible) {
    const optTypicalEnd = addMonths(p.programEndDate, TYPICAL_OPT_MONTHS);
    const stemWindowStart = addDays(optTypicalEnd, -90);
    const stemExtensionEnd = addMonths(optTypicalEnd, STEM_EXTENSION_MONTHS);
    const stemReport12mo = addMonths(optTypicalEnd, 12);

    items.push({
      key: 'stem_opt_window',
      label: 'STEM OPT extension application window',
      dateRange: { start: stemWindowStart, end: optTypicalEnd },
      status: now < stemWindowStart ? 'UPCOMING' : now > optTypicalEnd ? 'PAST' : 'CURRENT',
      explanation:
        'You may file the STEM OPT extension (Form I-765) up to 90 days before your initial OPT authorization expires, and must file before it expires. Your DSO must recommend it in SEVIS first.',
      sourceUrl: 'https://studyinthestates.dhs.gov/opt-hub/stem-opt-hub',
    });
    items.push({
      key: 'stem_opt_report_12mo',
      label: '12-month self-evaluation report due',
      date: stemReport12mo,
      status: status(stemReport12mo, now),
      explanation:
        'STEM OPT requires a validation report at the 12-month mark of the extension confirming your employment is still on track — submitted through your DSO.',
      sourceUrl: 'https://studyinthestates.dhs.gov/opt-hub/stem-opt-hub',
    });
    items.push({
      key: 'stem_opt_extension_end',
      label: `${STEM_EXTENSION_MONTHS}-month STEM OPT extension ends`,
      date: stemExtensionEnd,
      status: status(stemExtensionEnd, now),
      explanation: `If approved, your STEM OPT extension runs for ${STEM_EXTENSION_MONTHS} months after your initial OPT period ends.`,
      sourceUrl: 'https://studyinthestates.dhs.gov/opt-hub/stem-opt-hub',
    });
  }

  return items;
}

/** System deadlines that need reminder state → persisted via upsert on dedupeKey. */
export function computeSystemDeadlines(p: ProfileDates): GeneratedDeadline[] {
  const optOpen = addDays(p.programEndDate, -90);
  const optClose = addDays(p.programEndDate, 60);
  const graceEnd = addDays(p.programEndDate, 60);

  const deadlines: GeneratedDeadline[] = [
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
  ];

  if (p.stemEligible) {
    const optTypicalEnd = addMonths(p.programEndDate, TYPICAL_OPT_MONTHS);
    const stemExtensionEnd = addMonths(optTypicalEnd, STEM_EXTENSION_MONTHS);
    const stemReport12mo = addMonths(optTypicalEnd, 12);

    deadlines.push(
      {
        dedupeKey: 'stem_opt_report_12mo',
        type: 'STEM_OPT_REPORT',
        title: 'STEM OPT 12-month self-evaluation report due',
        dueDate: stemReport12mo,
        notes: 'Submit your validation report through your DSO confirming your STEM OPT employment is on track.',
      },
      {
        dedupeKey: 'stem_opt_extension_end',
        type: 'STEM_OPT_EXTENSION_END',
        title: `${STEM_EXTENSION_MONTHS}-month STEM OPT extension ends`,
        dueDate: stemExtensionEnd,
        notes: 'Final day of your STEM OPT extension — confirm your next steps with your DSO well before this date.',
      },
    );
  }

  return deadlines;
}

function status(d: Date, now: Date): MilestoneStatus {
  const diff = d.getTime() - now.getTime();
  if (diff < -14 * DAY) return 'PAST';
  if (diff > 14 * DAY) return 'UPCOMING';
  return 'CURRENT';
}
