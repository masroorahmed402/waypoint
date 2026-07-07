import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JoinWaitlistDto } from './waitlist.dto';

@Injectable()
export class MarketingService {
  constructor(private prisma: PrismaService) {}

  async join(dto: JoinWaitlistDto) {
    const email = dto.email.toLowerCase().trim();
    await this.prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, source: dto.source },
      update: {}, // idempotent — joining twice is fine
    });
    return { ok: true };
  }
}
