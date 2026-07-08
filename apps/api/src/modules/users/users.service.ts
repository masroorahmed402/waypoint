import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Inject } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto, UpsertProfileDto } from './users.dto';
import { ImmigrationService } from '../immigration/immigration.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { AppConfig } from '../../config/app.config';
import { decryptField, encryptField } from '../../common/util/field-crypto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private immigration: ImmigrationService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    private config: AppConfig,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true,
        profile: { include: { university: { select: { id: true, name: true, slug: true, issOfficeUrl: true, issEmail: true, issPhone: true } } } },
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  async upsertProfile(userId: string, dto: UpsertProfileDto) {
    const start = new Date(dto.programStartDate);
    const end = new Date(dto.programEndDate);
    if (end <= start) throw new BadRequestException('programEndDate must be after programStartDate');

    // Onboarding extracts the SEVIS ID from the I-20 before this profile row
    // exists, so it can't be persisted at extraction time — carry it through
    // here instead so the first-time upload path doesn't silently drop it.
    const sevisIdEncrypted = dto.sevisId
      ? encryptField(dto.sevisId, this.config.fieldEncryptionKey)
      : undefined;

    const profile = await this.prisma.studentProfile.upsert({
      where: { userId },
      create: {
        userId,
        universityId: dto.universityId,
        universityName: dto.universityName,
        degreeLevel: dto.degreeLevel,
        major: dto.major,
        visaType: dto.visaType,
        programStartDate: start,
        programEndDate: end,
        usEntryDate: dto.usEntryDate ? new Date(dto.usEntryDate) : null,
        stemEligible: dto.stemEligible ?? false,
        sevisIdEncrypted,
      },
      update: {
        universityId: dto.universityId ?? null,
        universityName: dto.universityName ?? null,
        degreeLevel: dto.degreeLevel,
        major: dto.major,
        visaType: dto.visaType,
        programStartDate: start,
        programEndDate: end,
        usEntryDate: dto.usEntryDate ? new Date(dto.usEntryDate) : null,
        stemEligible: dto.stemEligible ?? false,
        ...(sevisIdEncrypted ? { sevisIdEncrypted } : {}),
      },
    });

    // Profile dates changed → regenerate system deadlines (idempotent upsert).
    await this.immigration.recomputeSystemDeadlines(userId);
    return profile;
  }

  async getSevisId(userId: string, password: string, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException();

    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) throw new UnauthorizedException('Incorrect password');

    const profile = user.profile;
    if (!profile?.sevisIdEncrypted) return { sevisId: null };

    const sevisId = decryptField(profile.sevisIdEncrypted, this.config.fieldEncryptionKey);
    await this.logAudit(userId, 'sevis_id_viewed', meta);
    return { sevisId };
  }

  /** Best-effort security log write; never blocks the underlying action on failure. */
  async logAudit(userId: string, action: string, meta?: { ip?: string; userAgent?: string }) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, action, ipAddress: meta?.ip, userAgent: meta?.userAgent },
      });
    } catch {
      // Logging is a bonus, not the primary flow.
    }
  }

  async getAuditLog(userId: string) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async hardDelete(userId: string) {
    // First revoke all sessions
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Delete all documents from storage first
    const documents = await this.prisma.document.findMany({
      where: { userId },
      select: { storageKey: true },
    });

    for (const doc of documents) {
      try {
        await this.storage.delete(doc.storageKey);
      } catch {
        // Continue even if file deletion fails
      }
    }

    // Hard delete the user — cascade deletes handle everything else
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
