import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeTimeline, computeSystemDeadlines, RULE_VERSION } from './f1.rules';
import { CreateDeadlineDto, UpdateDeadlineDto } from './dto/deadline.dto';
import { DeadlineSource, DeadlineType } from '@prisma/client';

@Injectable()
export class ImmigrationService {
  constructor(private prisma: PrismaService) {}

  async timeline(userId: string) {
    const profile = await this.requireProfile(userId);
    const cptOptRecords = await this.prisma.cptOptRecord.findMany({ where: { userId } });
    return {
      ruleVersion: RULE_VERSION,
      disclaimer:
        'Informational only, not legal advice. Dates are computed from general F-1 rules — always confirm with your Designated School Official (DSO).',
      milestones: computeTimeline({
        programStartDate: profile.programStartDate,
        programEndDate: profile.programEndDate,
        usEntryDate: profile.usEntryDate,
        stemEligible: profile.stemEligible,
        cptOptRecords,
      }),
    };
  }

  /** Idempotent: upserts by (userId, dedupeKey). Safe to call on every profile change. */
  async recomputeSystemDeadlines(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return;

    const generated = computeSystemDeadlines({
      programStartDate: profile.programStartDate,
      programEndDate: profile.programEndDate,
      usEntryDate: profile.usEntryDate,
      stemEligible: profile.stemEligible,
    });

    for (const g of generated) {
      await this.prisma.deadline.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey: g.dedupeKey } },
        create: {
          userId,
          source: DeadlineSource.SYSTEM_GENERATED,
          type: g.type as DeadlineType,
          title: g.title,
          notes: g.notes,
          dueDate: g.dueDate,
          ruleVersion: RULE_VERSION,
          dedupeKey: g.dedupeKey,
        },
        update: { dueDate: g.dueDate, title: g.title, notes: g.notes, ruleVersion: RULE_VERSION },
      });
    }

    await this.prisma.deadline.deleteMany({
      where: {
        userId,
        dedupeKey: 'travel_signature',
        source: DeadlineSource.SYSTEM_GENERATED,
      },
    });

    if (!profile.stemEligible) {
      await this.prisma.deadline.deleteMany({
        where: {
          userId,
          dedupeKey: { in: ['stem_opt_report_12mo', 'stem_opt_extension_end'] },
          source: DeadlineSource.SYSTEM_GENERATED,
        },
      });
    }
  }

  /** Called by DocumentsService when a document with expiryDate is confirmed. */
  async upsertDocumentExpiryDeadline(
    userId: string,
    documentId: string,
    docType: string,
    fileName: string,
    expiryDate: Date,
  ) {
    const typeMap: Record<string, DeadlineType> = {
      PASSPORT: DeadlineType.PASSPORT_EXPIRY,
      VISA_STAMP: DeadlineType.VISA_EXPIRY,
      I20: DeadlineType.I20_EXPIRY,
      EAD: DeadlineType.EAD_EXPIRY,
      INSURANCE: DeadlineType.INSURANCE_RENEWAL,
      LEASE: DeadlineType.LEASE_RENEWAL,
    };
    const type = typeMap[docType] ?? DeadlineType.CUSTOM;
    await this.prisma.deadline.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: `doc:${documentId}` } },
      create: {
        userId,
        source: DeadlineSource.DOCUMENT_EXPIRY,
        type,
        title: `${fileName} expires`,
        dueDate: expiryDate,
        documentId,
        dedupeKey: `doc:${documentId}`,
      },
      update: { dueDate: expiryDate, title: `${fileName} expires` },
    });
  }

  async listDeadlines(userId: string, upcomingOnly: boolean) {
    return this.prisma.deadline.findMany({
      where: {
        userId,
        dismissedAt: null,
        ...(upcomingOnly ? { dueDate: { gte: new Date() } } : {}),
      },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });
  }

  async createCustom(userId: string, dto: CreateDeadlineDto) {
    return this.prisma.deadline.create({
      data: {
        userId,
        source: DeadlineSource.USER_CREATED,
        type: DeadlineType.CUSTOM,
        title: dto.title,
        notes: dto.notes,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateDeadlineDto) {
    const existing = await this.prisma.deadline.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException(); // 404, not 403 — don't leak existence

    // System deadlines: only dismissal allowed; dates come from the rules engine.
    if (existing.source !== DeadlineSource.USER_CREATED) {
      const keys = Object.keys(dto).filter((k) => dto[k as keyof UpdateDeadlineDto] !== undefined);
      if (keys.some((k) => k !== 'dismissedAt')) {
        throw new ForbiddenException('System-generated deadlines can only be dismissed');
      }
    }

    return this.prisma.deadline.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.dismissedAt !== undefined && { dismissedAt: new Date(dto.dismissedAt) }),
      },
    });
  }

  async removeCustom(userId: string, id: string) {
    const existing = await this.prisma.deadline.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException();
    if (existing.source !== DeadlineSource.USER_CREATED) {
      throw new ForbiddenException('Only custom deadlines can be deleted; dismiss system ones instead');
    }
    await this.prisma.deadline.delete({ where: { id } });
  }

  /** Builds an RFC 5545 .ics feed of the user's active deadlines, one all-day VEVENT each with a 1-day-before alarm. */
  async exportIcs(userId: string): Promise<string> {
    const deadlines = await this.prisma.deadline.findMany({
      where: { userId, dismissedAt: null },
      orderBy: { dueDate: 'asc' },
    });

    const now = icsUtcStamp(new Date());
    const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Waypoint//Deadlines//EN', 'CALSCALE:GREGORIAN'];
    for (const d of deadlines) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${d.id}@waypoint.app`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${icsDateStamp(d.dueDate)}`,
        `SUMMARY:${icsEscape(d.title)}`,
        ...(d.notes ? [`DESCRIPTION:${icsEscape(d.notes)}`] : []),
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder',
        'TRIGGER:-P1D',
        'END:VALARM',
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /** Full-time CPT eats into post-completion OPT eligibility past 12 cumulative months. */
  async getCptSummary(userId: string) {
    const records = await this.prisma.cptOptRecord.findMany({
      where: { userId, type: 'CPT' },
      orderBy: { startDate: 'asc' },
    });

    let fullTimeMonths = 0;
    for (const r of records) {
      if (r.fullOrPartTime?.includes('FULL')) {
        const months = (r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        fullTimeMonths += months;
      }
    }

    const optEligible = fullTimeMonths < 12;
    const monthsRemaining = Math.max(0, 12 - fullTimeMonths);

    return {
      records,
      fullTimeMonthsUsed: Math.round(fullTimeMonths * 10) / 10,
      optEligible,
      monthsRemainingBeforeOptLoss: Math.round(monthsRemaining * 10) / 10,
      warning: fullTimeMonths >= 9
        ? `You have used ${Math.round(fullTimeMonths * 10) / 10} months of full-time CPT. At 12 months you lose OPT eligibility.`
        : null,
    };
  }

  async getDsoContact(userId: string) {
    return this.prisma.dsoContact.findUnique({ where: { userId } });
  }

  /** Auto-generated deadline for a CPT/OPT authorization's end date; upserts by dedupeKey so re-extraction doesn't duplicate. */
  async createCptOptDeadline(userId: string, record: { id: string; type: string; endDate: Date; employerName: string | null }) {
    const label = record.employerName ? `${record.type} authorization expires — ${record.employerName}` : `${record.type} authorization expires`;
    await this.prisma.deadline.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: `cptopt:${record.id}` } },
      create: {
        userId,
        source: DeadlineSource.SYSTEM_GENERATED,
        type: DeadlineType.CUSTOM,
        title: label,
        dueDate: record.endDate,
        notes: record.employerName
          ? `Your ${record.type} authorization at ${record.employerName} expires on this date. Contact your DSO to extend or apply for OPT.`
          : `Your ${record.type} authorization expires on this date. Contact your DSO to extend or apply for OPT.`,
        dedupeKey: `cptopt:${record.id}`,
      },
      update: { dueDate: record.endDate, title: label },
    });
  }

  private async requireProfile(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Complete onboarding first (PUT /users/me/profile)');
    return profile;
  }
}

function icsDateStamp(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function icsUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
