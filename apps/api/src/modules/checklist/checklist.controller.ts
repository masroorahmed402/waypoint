import { Controller, Get, Post, Delete, Param, HttpCode } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('checklist')
export class ChecklistController {
  constructor(private svc: ChecklistService) {}

  @Get()
  list(@CurrentUser() u: JwtUser) {
    return this.svc.list(u.sub);
  }

  @Post(':key/complete')
  complete(@CurrentUser() u: JwtUser, @Param('key') key: string) {
    return this.svc.complete(u.sub, key);
  }

  @Delete(':key/complete')
  @HttpCode(204)
  async uncomplete(@CurrentUser() u: JwtUser, @Param('key') key: string) {
    await this.svc.uncomplete(u.sub, key);
  }
}
