import {
  Controller, Post, Get, Body, Res, Req, HttpCode, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { AuthService, SessionPair } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfig } from '../../config/app.config';

const REFRESH_COOKIE = 'iso_refresh';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private config: AppConfig) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.finish(res, await this.auth.register(dto, this.meta(req)));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.finish(res, await this.auth.login(dto.email, dto.password, this.meta(req)));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    return this.finish(res, await this.auth.refresh(raw, this.meta(req)));
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  // ── Google OAuth ──
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleStart() { /* passport redirects */ }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const pair = await this.auth.loginWithGoogle(req.user as any, this.meta(req));
    this.setRefreshCookie(res, pair.refreshToken);
    // Access token handed off via short-lived fragment redirect; web app exchanges immediately.
    res.redirect(`${this.config.webOrigin}/oauth/callback#token=${pair.accessToken}`);
  }

  // ── helpers ──
  private finish(res: Response, pair: SessionPair) {
    this.setRefreshCookie(res, pair.refreshToken);
    const { refreshToken: _omit, ...body } = pair;
    return body;
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProd,
      // In prod the web app and API are on different domains, so the refresh
      // cookie must be cross-site (None+Secure). In dev they share localhost → Lax.
      sameSite: this.config.isProd ? 'none' : 'lax',
      path: '/api/v1/auth', // cookie only travels to auth endpoints
      maxAge: this.config.refreshTtlDays * 86_400_000,
    });
  }

  private meta(req: Request) {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }
}
