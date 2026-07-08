import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/app.config';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/application.dto';
import { UpsertCompanyDto } from './dto/company.dto';
import { ApplicationStage } from '@prisma/client';

const MODEL = 'llama-3.3-70b-versatile';

@Injectable()
export class CareerService {
  private readonly log = new Logger('CareerService');

  constructor(private prisma: PrismaService, private config: AppConfig) {}

  /**
   * Fetches a job posting URL and extracts structured details via AI. Best-effort:
   * returns an empty object on any failure. Blocks non-http(s) schemes and private/
   * loopback/link-local IPs to prevent SSRF against internal infrastructure, since
   * this fetches an arbitrary user-supplied URL server-side.
   */
  async parseJobUrl(url: string): Promise<{ companyName?: string; roleTitle?: string; location?: string; sponsorshipMentioned?: boolean }> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http/https URLs are supported');
    }
    if (await isPrivateHost(parsed.hostname)) {
      throw new BadRequestException('That URL cannot be fetched');
    }

    try {
      const res = await fetch(parsed.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Waypoint/1.0)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      const html = (await res.text()).slice(0, 20_000);

      if (!this.config.groqApiKey) return {};
      const client = new OpenAI({ apiKey: this.config.groqApiKey, baseURL: 'https://api.groq.com/openai/v1' });
      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 200,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `Extract job details from this HTML. Return ONLY JSON with keys companyName, roleTitle, location, sponsorshipMentioned (boolean). Use null for anything not found.\n\nHTML:\n${html.slice(0, 3000)}`,
        }],
      });
      return JSON.parse(response.choices[0]?.message?.content ?? '{}');
    } catch (err) {
      this.log.warn(`Job URL parse failed: ${(err as Error).message}`);
      return {};
    }
  }

  async listApplications(userId: string, stage?: ApplicationStage, cursor?: string, limit = 50) {
    const take = Math.min(limit, 100);
    const rows = await this.prisma.application.findMany({
      where: { userId, ...(stage ? { stage } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { company: { select: { id: true, name: true, domain: true, sponsorsH1b: true } } },
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
      select: { id: true, name: true, domain: true, sponsorsInternational: true, sponsorsH1b: true },
    });
  }

  /** Find-or-create by case-insensitive name; updates sponsorsH1b when provided. */
  async upsertCompanyByName(dto: UpsertCompanyDto) {
    const existing = await this.prisma.company.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      if (dto.sponsorsH1b === undefined) return existing;
      return this.prisma.company.update({
        where: { id: existing.id },
        data: { sponsorsH1b: dto.sponsorsH1b },
      });
    }
    return this.prisma.company.create({
      data: { name: dto.name, sponsorsH1b: dto.sponsorsH1b },
    });
  }
}

/** Blocks loopback, link-local, and private (RFC 1918 / ULA) addresses so parseJobUrl can't be used to probe internal infra. */
async function isPrivateHost(hostname: string): Promise<boolean> {
  const direct = isIP(hostname);
  const addresses = direct ? [hostname] : await lookup(hostname, { all: true }).then((r) => r.map((a) => a.address)).catch(() => []);
  if (!addresses.length) return true;

  return addresses.some((addr) => {
    if (addr === '127.0.0.1' || addr === '::1' || addr === '0.0.0.0') return true;
    if (addr.startsWith('10.') || addr.startsWith('192.168.') || addr.startsWith('169.254.')) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return true;
    if (addr.startsWith('fc') || addr.startsWith('fd') || addr.startsWith('fe80:')) return true;
    return false;
  });
}
