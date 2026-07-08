import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CHECKLIST_ITEMS } from './checklist.items';

@Injectable()
export class ChecklistService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const completed = await this.prisma.checklistItem.findMany({
      where: { userId, completedAt: { not: null } },
      select: { key: true, completedAt: true },
    });
    const completedByKey = new Map(completed.map((c) => [c.key, c.completedAt]));

    return CHECKLIST_ITEMS.map((item) => ({
      ...item,
      completedAt: completedByKey.get(item.key) ?? null,
    }));
  }

  async complete(userId: string, key: string) {
    if (!CHECKLIST_ITEMS.some((i) => i.key === key)) return null;
    return this.prisma.checklistItem.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, completedAt: new Date() },
      update: { completedAt: new Date() },
    });
  }

  async uncomplete(userId: string, key: string) {
    await this.prisma.checklistItem.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, completedAt: null },
      update: { completedAt: null },
    });
  }
}
