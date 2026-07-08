import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto, UpsertProfileDto } from './users.dto';
import { ImmigrationService } from '../immigration/immigration.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private immigration: ImmigrationService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true,
        profile: { include: { university: { select: { id: true, name: true, slug: true } } } },
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
      },
    });

    // Profile dates changed → regenerate system deadlines (idempotent upsert).
    await this.immigration.recomputeSystemDeadlines(userId);
    return profile;
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
