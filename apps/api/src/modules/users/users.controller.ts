import { Controller, Get, Patch, Post, Put, Delete, Body, HttpCode, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { UpdateMeDto, UpsertProfileDto, RevealSevisIdDto } from './users.dto';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  me(@CurrentUser() u: JwtUser) { return this.users.me(u.sub); }

  @Patch('me')
  updateMe(@CurrentUser() u: JwtUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(u.sub, dto);
  }

  @Put('me/profile')
  upsertProfile(@CurrentUser() u: JwtUser, @Body() dto: UpsertProfileDto) {
    return this.users.upsertProfile(u.sub, dto);
  }

  @Post('me/sevis-id')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  getSevisId(@CurrentUser() u: JwtUser, @Body() dto: RevealSevisIdDto, @Req() req: Request) {
    return this.users.getSevisId(u.sub, dto.password, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Get('me/audit-log')
  auditLog(@CurrentUser() u: JwtUser) { return this.users.getAuditLog(u.sub); }

  @Delete('me')
  @HttpCode(204)
  async remove(@CurrentUser() u: JwtUser) { await this.users.hardDelete(u.sub); }
}
