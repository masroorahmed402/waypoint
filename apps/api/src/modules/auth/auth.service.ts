import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import zxcvbn from 'zxcvbn';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/app.config';
import { RegisterDto } from './dto/register.dto';
import { GoogleUser } from './strategies/google.strategy';
import { EMAIL_SERVICE, EmailService } from '../notifications/email.interface';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 1 << 16, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export interface SessionPair {
  accessToken: string;
  refreshToken: string; // raw; caller sets it as httpOnly cookie
  user: { id: string; email: string; firstName: string; lastName: string; role: string };
}

@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: AppConfig,
    @Inject(EMAIL_SERVICE) private email: EmailService,
  ) {}

  // ── Register / Login ──────────────────────────────────────────────────────

  async register(dto: RegisterDto, meta: TokenMeta): Promise<SessionPair> {
    const email = dto.email.toLowerCase().trim();

    const strength = zxcvbn(dto.password, [email, dto.firstName, dto.lastName]);
    if (strength.score < 3) {
      throw new BadRequestException(
        'Password too weak — use a longer passphrase or mix of unrelated words.',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(dto.password, ARGON2_OPTS),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
      },
    });
    const session = await this.issueSession(user, meta);

    try {
      await this.email.send(this.buildWelcomeEmail(user.email, user.firstName));
    } catch {
      this.log.warn(`Welcome email failed for ${user.id}; registration still succeeded`);
    }

    return session;
  }

  async login(email: string, password: string, meta: TokenMeta): Promise<SessionPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // Uniform failure path — no user enumeration, no timing oracle:
    const hash =
      user?.passwordHash ??
      '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const ok = await argon2.verify(hash, password).catch(() => false);
    if (!ok || !user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueSession(user, meta);
  }

  // ── Forgot / reset password ───────────────────────────────────────────────

  /** Always succeeds from the caller's view — no user enumeration. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || user.deletedAt) return;

    const raw = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    try {
      await this.email.send(this.buildResetEmail(user.email, user.firstName, raw));
    } catch {
      this.log.warn(`Password reset email failed for ${user.id}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hash(token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date() || stored.user.deletedAt) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const strength = zxcvbn(newPassword, [stored.user.email, stored.user.firstName, stored.user.lastName]);
    if (strength.score < 3) {
      throw new BadRequestException(
        'Password too weak — use a longer passphrase or mix of unrelated words.',
      );
    }

    await this.prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash: await argon2.hash(newPassword, ARGON2_OPTS) },
    });
    await this.prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });
    // Reset invalidates all existing sessions.
    await this.prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  async loginWithGoogle(g: GoogleUser, meta: TokenMeta): Promise<SessionPair> {
    const email = g.email.toLowerCase();
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: g.providerAccountId } },
      include: { user: true },
    });

    let user = linked?.user ?? null;
    if (!user) {
      // Link to existing verified-email account, or create fresh.
      user = await this.prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, firstName: g.firstName, lastName: g.lastName, emailVerifiedAt: new Date() },
      });
      await this.prisma.oAuthAccount.create({
        data: { userId: user.id, provider: 'google', providerAccountId: g.providerAccountId },
      });
    }
    if (user.deletedAt) throw new UnauthorizedException('Account deactivated');
    return this.issueSession(user, meta);
  }

  // ── Refresh rotation with family reuse detection (ADR-003) ───────────────

  async refresh(rawToken: string, meta: TokenMeta): Promise<SessionPair> {
    const tokenHash = this.hash(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException('Invalid session');

    if (stored.revokedAt) {
      // Token reuse: someone is replaying a rotated token. Kill the family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session revoked — please log in again');
    }
    if (stored.expiresAt < new Date() || stored.user.deletedAt) {
      throw new UnauthorizedException('Session expired');
    }

    // Rotate: revoke old, issue new within the same family.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(stored.user, meta, stored.familyId);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (stored) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async issueSession(
    user: { id: string; email: string; firstName: string; lastName: string; role: string },
    meta: TokenMeta,
    familyId?: string,
  ): Promise<SessionPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.config.jwtAccessSecret, expiresIn: this.config.jwtAccessTtl },
    );

    const raw = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(raw),
        familyId: familyId ?? randomUUID(),
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
        expiresAt: new Date(Date.now() + this.config.refreshTtlDays * 86_400_000),
      },
    });

    return {
      accessToken,
      refreshToken: raw,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private buildWelcomeEmail(to: string, firstName: string) {
    const name = escapeHtml(firstName);
    const webOrigin = this.config.webOrigin;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
        <p>Hi ${name},</p>
        <p>Welcome to Waypoint. Upload your I-20 to build your immigration timeline, set up deadline reminders, and track your job search — all in one place.</p>
        <p style="margin-top:20px">
          <a href="${webOrigin}" style="display:inline-block;background:#16263f;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            Go to Waypoint →
          </a>
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">— Waypoint</p>
      </div>`;
    const text = `Hi ${firstName},\n\nWelcome to Waypoint. Upload your I-20 to build your immigration timeline, set up deadline reminders, and track your job search — all in one place.\n\nGo to Waypoint: ${webOrigin}\n\n— Waypoint`;
    return { to, subject: 'Welcome to Waypoint', html, text };
  }

  private buildResetEmail(to: string, firstName: string, rawToken: string) {
    const name = escapeHtml(firstName);
    const resetUrl = `${this.config.webOrigin}/reset-password?token=${rawToken}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
        <p>Hi ${name},</p>
        <p>We received a request to reset your Waypoint password. This link expires in 1 hour.</p>
        <p style="margin-top:20px">
          <a href="${resetUrl}" style="display:inline-block;background:#16263f;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset your password →
          </a>
        </p>
        <p style="margin-top:20px;color:#475569;font-size:13px">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">— Waypoint</p>
      </div>`;
    const text = `Hi ${firstName},\n\nWe received a request to reset your Waypoint password. This link expires in 1 hour.\n\nReset your password: ${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\n— Waypoint`;
    return { to, subject: 'Reset your Waypoint password', html, text };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export interface TokenMeta {
  userAgent?: string;
  ip?: string;
}
