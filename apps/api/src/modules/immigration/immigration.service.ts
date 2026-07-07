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
    return {
      ruleVersion: RULE_VERSION,
      disclaimer:
        'Informational only, not legal advice. Dates are computed from general F-1 rules — always confirm with your Designated School Official (DSO).',
      milestones: computeTimeline({
        programStartDate: profile.programStartDate,
        programEndDate: profile.programEndDate,
        usEntryDate: profile.usEntryDate,
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

  private async requireProfile(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Complete onboarding first (PUT /users/me/profile)');
    return profile;
  }
}
