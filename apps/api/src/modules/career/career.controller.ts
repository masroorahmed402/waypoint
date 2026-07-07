import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { CareerService } from './career.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/application.dto';
import { ApplicationStage } from '@prisma/client';

@Controller('career')
export class CareerController {
  constructor(private svc: CareerService) {}

  @Get('applications')
  list(
    @CurrentUser() u: JwtUser,
    @Query('stage') stage?: ApplicationStage,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.listApplications(u.sub, stage, cursor);
  }

  @Post('applications')
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateApplicationDto) {
    return this.svc.create(u.sub, dto);
  }

  @Patch('applications/:id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateApplicationDto) {
    return this.svc.update(u.sub, id, dto);
  }

  @Get('applications/:id/events')
  events(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.svc.events(u.sub, id);
  }

  @Delete('applications/:id')
  @HttpCode(204)
  async remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    await this.svc.remove(u.sub, id);
  }

  @Get('companies')
  companies(@Query('query') query = '') {
    return this.svc.searchCompanies(query);
  }
}
