import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_SERVICE, EmailService } from './email.interface';
import { ReminderCheckpoint } from '@prisma/client';
import { APP_NAME } from '../../config/brand';

const DAY = 86_400_000;

// Each checkpoint fires once, in its own band, as the deadline approaches.
const CHECKPOINTS: { key: ReminderCheckpoint; at: number; floor: number; label: string }[] = [
  { key: 'D90', at: 90, floor: 30, label: '90 days' },
  { key: 'D30', at: 30, floor: 7, label: '30 days' },
  { key: 'D7', at: 7, floor: 1, label: '7 days' },
  { key: 'D1', at: 1, floor: 0, label: '1 day' },
];

@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Reminders');

  constructor(
    private prisma: PrismaService,
    @Inject(EMAIL_SERVICE) private email: EmailService,
  ) {}

  /** Runs every day at 08:00 server time. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDaily() {
    const sent = await this.scanAndSend();
    if (sent) this.log.log(`Sent ${sent} deadline reminder(s)`);
  }

  /** Runs every Monday at 09:00 server time. */
  @Cron('0 9 * * 1')
  async runWeeklyDigest() {
    const sent = await this.sendWeeklyDigest();
    if (sent) this.log.log(`Sent ${sent} weekly digest(s)`);
  }

  /** Summary email: deadlines in the next 30 days + pipeline counts + on-track/action-needed. */
  async sendWeeklyDigest(now = new Date()): Promise<number> {
    const horizon = new Date(now.getTime() + 30 * DAY);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, profile: { isNot: null } },
      select: {
        id: true, email: true, firstName: true,
        deadlines: {
          where: { dismissedAt: null, dueDate: { gte: now, lte: horizon } },
          orderBy: { dueDate: 'asc' },
          select: { title: true, dueDate: true },
        },
        applications: { select: { stage: true } },
      },
    });

    let count = 0;
    for (const u of users) {
      const byStage = u.applications.reduce<Record<string, number>>((acc, a) => {
        acc[a.stage] = (acc[a.stage] ?? 0) + 1;
        return acc;
      }, {});
      const actionNeeded = u.deadlines.some((d) => d.dueDate.getTime() - now.getTime() <= 7 * DAY);

      try {
        await this.email.send(this.buildDigestEmail(u.email, u.firstName, u.deadlines, byStage, actionNeeded));
        count++;
      } catch {
        this.log.warn(`Weekly digest failed for user ${u.id}`);
      }
    }
    return count;
  }

  /**
   * Core scan: for every active deadline, find which checkpoint band it's in and
   * send that reminder if it hasn't been sent. NotificationLog's unique
   * (deadlineId, checkpoint) makes this safe to run repeatedly — no double-sends.
   * Returns the number of emails sent.
   */
  async scanAndSend(now = new Date()): Promise<number> {
    const horizon = new Date(now.getTime() + 91 * DAY);
    const deadlines = await this.prisma.deadline.findMany({
      where: { dismissedAt: null, dueDate: { gte: now, lte: horizon } },
      include: {
        user: { select: { email: true, firstName: true, deletedAt: true } },
        notificationLogs: { select: { checkpoint: true } },
      },
    });

    let count = 0;
    for (const d of deadlines) {
      if (d.user.deletedAt) continue;
      const days = Math.ceil((d.dueDate.getTime() - now.getTime()) / DAY);
      const band = CHECKPOINTS.find((c) => days <= c.at && days > c.floor);
      if (!band) continue;
      if (d.notificationLogs.some((l) => l.checkpoint === band.key)) continue;

      try {
        await this.email.send(this.buildEmail(d.user.email, d.user.firstName, d.title, d.notes, days));
        await this.prisma.notificationLog.create({
          data: { deadlineId: d.id, checkpoint: band.key },
        });
        count++;
      } catch {
        // leave unlogged so the next run retries; don't let one failure stop the batch
        this.log.warn(`Reminder failed for deadline ${d.id}; will retry next run`);
      }
    }
    return count;
  }

  async sendStatusChangeEmail(
    to: string,
    firstName: string,
    receiptNumber: string,
    caseType: string,
    oldStatus: string,
    newStatus: string,
  ) {
    await this.email.send({
      to,
      subject: `Your ${caseType} case status changed — ${receiptNumber}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
          <p>Hi ${escapeHtml(firstName)},</p>
          <p>Your <strong>${escapeHtml(caseType)}</strong> case <strong>${escapeHtml(receiptNumber)}</strong> has a new status:</p>
          <div style="padding:16px;background:#f0fdf4;border-radius:8px;margin:16px 0">
            <p style="margin:0;color:#166534;font-weight:600">${escapeHtml(newStatus)}</p>
          </div>
          <p style="color:#64748b;font-size:13px">Previous status: ${escapeHtml(oldStatus)}</p>
          <p>Check the full details at <a href="https://egov.uscis.gov/casestatus/mycasestatus.do">USCIS case status</a>.</p>
          <p style="color:#94a3b8;font-size:12px">— ${APP_NAME}</p>
        </div>
      `,
      text: `Hi ${firstName}, your ${caseType} case ${receiptNumber} changed from "${oldStatus}" to "${newStatus}".`,
    });
  }

  private buildEmail(to: string, firstName: string, title: string, notes: string | null, days: number) {
    const when = days <= 1 ? 'tomorrow' : `in ${days} days`;
    const subject = `${title} — ${when}`;
    const note = notes ? `<p style="color:#475569">${escapeHtml(notes)}</p>` : '';
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
        <p>Hi ${escapeHtml(firstName)},</p>
        <p style="font-size:18px"><strong>${escapeHtml(title)}</strong> is coming up <strong>${when}</strong>.</p>
        ${note}
        <p style="margin-top:20px;padding:12px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">
          Informational only — not legal advice. Confirm anything immigration-related with your DSO.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">— ${APP_NAME}</p>
      </div>`;
    const text = `Hi ${firstName},\n\n${title} is coming up ${when}.\n${notes ?? ''}\n\nInformational only — not legal advice. Confirm with your DSO.\n\n— ${APP_NAME}`;
    return { to, subject, html, text };
  }

  private buildDigestEmail(
    to: string,
    firstName: string,
    deadlines: { title: string; dueDate: Date }[],
    byStage: Record<string, number>,
    actionNeeded: boolean,
  ) {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const subject = actionNeeded
      ? `Action needed — a deadline is within 7 days`
      : `Your weekly Waypoint digest — you're on track`;

    const deadlineRows = deadlines.length
      ? deadlines.map((d) => `<li>${escapeHtml(d.title)} — <strong>${fmt(d.dueDate)}</strong></li>`).join('')
      : '<li>No deadlines in the next 30 days.</li>';

    const stageOrder = ['SAVED', 'APPLIED', 'OA', 'INTERVIEW', 'OFFER', 'REJECTED'];
    const stageLabel: Record<string, string> = {
      SAVED: 'Saved', APPLIED: 'Applied', OA: 'Online assessment', INTERVIEW: 'Interview', OFFER: 'Offer', REJECTED: 'Rejected',
    };
    const total = Object.values(byStage).reduce((a, b) => a + b, 0);
    const pipelineRows = total
      ? stageOrder.filter((s) => byStage[s]).map((s) => `<li>${stageLabel[s]}: ${byStage[s]}</li>`).join('')
      : '<li>No applications tracked yet.</li>';

    const statusBanner = actionNeeded
      ? `<p style="margin-top:16px;padding:12px;background:#fee2e2;border-radius:8px;font-size:14px;color:#991b1b"><strong>Action needed</strong> — you have a deadline within the next 7 days.</p>`
      : `<p style="margin-top:16px;padding:12px;background:#dcfce7;border-radius:8px;font-size:14px;color:#166534"><strong>You're on track</strong> — no urgent deadlines this week.</p>`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
        <p>Hi ${escapeHtml(firstName)},</p>
        <p style="font-size:16px">Here's your week at a glance.</p>
        ${statusBanner}
        <p style="margin-top:20px;font-weight:600">Deadlines in the next 30 days</p>
        <ul style="padding-left:18px;color:#334155">${deadlineRows}</ul>
        <p style="margin-top:16px;font-weight:600">Application pipeline</p>
        <ul style="padding-left:18px;color:#334155">${pipelineRows}</ul>
        <p style="margin-top:20px;padding:12px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">
          Informational only — not legal advice. Confirm anything immigration-related with your DSO.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">— ${APP_NAME}</p>
      </div>`;

    const text = [
      `Hi ${firstName},`,
      '',
      actionNeeded ? 'Action needed — a deadline is within 7 days.' : "You're on track — no urgent deadlines this week.",
      '',
      'Deadlines in the next 30 days:',
      ...(deadlines.length ? deadlines.map((d) => `- ${d.title} — ${fmt(d.dueDate)}`) : ['- None']),
      '',
      'Application pipeline:',
      ...(total ? stageOrder.filter((s) => byStage[s]).map((s) => `- ${stageLabel[s]}: ${byStage[s]}`) : ['- No applications tracked yet']),
      '',
      'Informational only — not legal advice. Confirm with your DSO.',
      '',
      `— ${APP_NAME}`,
    ].join('\n');

    return { to, subject, html, text };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
