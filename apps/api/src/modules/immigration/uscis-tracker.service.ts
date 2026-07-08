import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface UscisStatusResult {
  status: string;
  description: string;
  lastUpdated: string;
}

/**
 * ⚠ checkStatus scrapes USCIS's public (unauthenticated) legacy case-status
 * page — there is no official API for this. It has NOT been verified against
 * a real receipt number: USCIS may require session cookies/CSRF tokens or
 * change their markup at any time, either of which would silently break the
 * regex-based parsing below. Treat this as a starting point to validate
 * against a real case before relying on it, and keep the try/catch in
 * checkAllCases so one broken lookup can't take down the whole cron run.
 */
@Injectable()
export class UscisTrackerService {
  private readonly log = new Logger('UscisTracker');

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async addCase(userId: string, receiptNumber: string, caseType: string) {
    const normalized = receiptNumber.toUpperCase();
    // Validate receipt number format: 3 letters + 10 digits (e.g. EAC2490123456)
    if (!/^[A-Z]{3}\d{10}$/.test(normalized)) {
      throw new BadRequestException('Invalid receipt number format. Example: EAC2490123456');
    }
    return this.prisma.uscisCaseTracker.upsert({
      where: { userId_receiptNumber: { userId, receiptNumber: normalized } },
      create: { userId, receiptNumber: normalized, caseType },
      update: { caseType },
    });
  }

  list(userId: string) {
    return this.prisma.uscisCaseTracker.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async remove(userId: string, receiptNumber: string) {
    await this.prisma.uscisCaseTracker.deleteMany({ where: { userId, receiptNumber: receiptNumber.toUpperCase() } });
  }

  /** Manually triggered check for one case — updates lastStatus and returns the fresh result. */
  async checkOne(userId: string, receiptNumber: string): Promise<UscisStatusResult | null> {
    const tracked = await this.prisma.uscisCaseTracker.findUnique({
      where: { userId_receiptNumber: { userId, receiptNumber: receiptNumber.toUpperCase() } },
    });
    if (!tracked) return null;

    const result = await this.checkStatus(tracked.receiptNumber);
    await this.prisma.uscisCaseTracker.update({
      where: { id: tracked.id },
      data: { lastStatus: result.status, lastCheckedAt: new Date() },
    });
    return result;
  }

  async checkStatus(receiptNumber: string): Promise<UscisStatusResult> {
    // USCIS public case status endpoint
    const url = `https://egov.uscis.gov/casestatus/mycasestatus.do`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `appReceiptNum=${receiptNumber}&caseStatusSearchBtn=CHECK+STATUS`,
    });
    const html = await res.text();

    // Parse status from response
    const statusMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const descMatch = html.match(/<p[^>]*>([^<]+)<\/p>/);

    return {
      status: statusMatch?.[1]?.trim() ?? 'Unknown',
      description: descMatch?.[1]?.trim() ?? '',
      lastUpdated: new Date().toISOString(),
    };
  }

  // Runs every 6 hours via cron
  @Cron('0 */6 * * *')
  async checkAllCases() {
    const cases = await this.prisma.uscisCaseTracker.findMany({
      include: { user: { select: { email: true, firstName: true } } },
    });

    for (const c of cases) {
      try {
        const { status } = await this.checkStatus(c.receiptNumber);
        if (status !== c.lastStatus && c.lastStatus !== null) {
          // Status changed — notify user
          await this.notifications.sendStatusChangeEmail(
            c.user.email,
            c.user.firstName,
            c.receiptNumber,
            c.caseType,
            c.lastStatus ?? 'Unknown',
            status,
          );
        }
        await this.prisma.uscisCaseTracker.update({
          where: { id: c.id },
          data: { lastStatus: status, lastCheckedAt: new Date() },
        });
        // Rate limit: wait 2 seconds between checks to be respectful
        await new Promise((r) => setTimeout(r, 2000));
      } catch {
        // Skip failed checks silently — logged so a persistent failure is at least visible.
        this.log.warn(`USCIS status check failed for case ${c.id}; will retry next run`);
      }
    }
  }
}
