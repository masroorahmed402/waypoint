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
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
