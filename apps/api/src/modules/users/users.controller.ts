import { Controller, Get, Patch, Put, Delete, Body, HttpCode } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { UpdateMeDto, UpsertProfileDto } from './users.dto';

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

  @Delete('me')
  @HttpCode(204)
  async remove(@CurrentUser() u: JwtUser) { await this.users.softDelete(u.sub); }
}
