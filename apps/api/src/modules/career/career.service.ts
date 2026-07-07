import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/application.dto';
import { ApplicationStage } from '@prisma/client';

@Injectable()
export class CareerService {
  constructor(private prisma: PrismaService) {}

  async listApplications(userId: string, stage?: ApplicationStage, cursor?: string, limit = 50) {
    const take = Math.min(limit, 100);
    const rows = await this.prisma.application.findMany({
      where: { userId, ...(stage ? { stage } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { company: { select: { id: true, name: true, domain: true } } },
    });
    const hasMore = rows.length > take;
    return { data: hasMore ? rows.slice(0, take) : rows, nextCursor: hasMore ? rows[take - 1].id : null };
  }

  async create(userId: string, dto: CreateApplicationDto) {
    const stage = dto.stage ?? ApplicationStage.SAVED;
    return this.prisma.application.create({
      data: {
        userId,
        companyName: dto.companyName,
        companyId: dto.companyId,
        roleTitle: dto.roleTitle,
        url: dto.url,
        stage,
        sponsorshipConfirmed: dto.sponsorshipConfirmed,
        location: dto.location,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        notes: dto.notes,
        appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : stage !== ApplicationStage.SAVED ? new Date() : null,
        events: { create: { toStage: stage } },
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateApplicationDto) {
    const existing = await this.prisma.application.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException();

    const stageChanged = dto.stage && dto.stage !== existing.stage;
    return this.prisma.application.update({
      where: { id },
      data: {
        ...(dto.companyName && { companyName: dto.companyName }),
        ...(dto.companyId !== undefined && { companyId: dto.companyId }),
        ...(dto.roleTitle && { roleTitle: dto.roleTitle }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.stage && { stage: dto.stage }),
        ...(dto.sponsorshipConfirmed && { sponsorshipConfirmed: dto.sponsorshipConfirmed }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.salaryMin !== undefined && { salaryMin: dto.salaryMin }),
        ...(dto.salaryMax !== undefined && { salaryMax: dto.salaryMax }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.appliedAt && { appliedAt: new Date(dto.appliedAt) }),
        ...(stageChanged && {
          events: { create: { fromStage: existing.stage, toStage: dto.stage! } },
        }),
      },
    });
  }

  async events(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({ where: { id, userId }, select: { id: true } });
    if (!app) throw new NotFoundException();
    return this.prisma.applicationEvent.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({ where: { id, userId } });
    if (!app) throw new NotFoundException();
    await this.prisma.application.delete({ where: { id } });
  }

  searchCompanies(query: string) {
    return this.prisma.company.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      take: 10,
      select: { id: true, name: true, domain: true, sponsorsInternational: true },
    });
  }
}
