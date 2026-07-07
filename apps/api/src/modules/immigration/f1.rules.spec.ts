import { computeTimeline, computeSystemDeadlines } from './f1.rules';

const DAY = 86_400_000;

describe('F-1 rules engine', () => {
  const profile = {
    programStartDate: new Date('2024-09-01T00:00:00Z'),
    programEndDate: new Date('2027-06-15T00:00:00Z'),
    usEntryDate: new Date('2024-08-20T00:00:00Z'),
  };

  it('OPT window opens exactly 90 days before program end', () => {
    const d = computeSystemDeadlines(profile).find((x) => x.dedupeKey === 'opt_window_open')!;
    expect(profile.programEndDate.getTime() - d.dueDate.getTime()).toBe(90 * DAY);
  });

  it('OPT filing deadline is 60 days after program end', () => {
    const d = computeSystemDeadlines(profile).find((x) => x.dedupeKey === 'opt_filing_deadline')!;
    expect(d.dueDate.getTime() - profile.programEndDate.getTime()).toBe(60 * DAY);
  });

  it('grace period ends 60 days after program end', () => {
    const d = computeSystemDeadlines(profile).find((x) => x.dedupeKey === 'grace_period_end')!;
    expect(d.dueDate.getTime() - profile.programEndDate.getTime()).toBe(60 * DAY);
  });

  it('timeline milestones are chronologically consistent', () => {
    const tl = computeTimeline(profile, new Date('2026-07-06T00:00:00Z'));
    const optWindow = tl.find((m) => m.key === 'opt_window')!;
    expect(optWindow.dateRange!.start < optWindow.dateRange!.end).toBe(true);
    expect(tl.find((m) => m.key === 'program_start')!.status).toBe('PAST');
    expect(tl.find((m) => m.key === 'grace_period_end')!.status).toBe('UPCOMING');
  });

  it('every milestone carries an explanation (DSO-notice requirement)', () => {
    for (const m of computeTimeline(profile)) {
      expect(m.explanation.length).toBeGreaterThan(10);
    }
  });
});
