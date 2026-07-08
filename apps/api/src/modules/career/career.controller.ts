import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CareerService } from './career.service';
import { H1bService } from './h1b.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/application.dto';
import { UpsertCompanyDto } from './dto/company.dto';
import { ApplicationStage } from '@prisma/client';

@Controller('career')
export class CareerController {
  constructor(private svc: CareerService, private h1b: H1bService) {}

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

  @Post('companies')
  upsertCompany(@Body() dto: UpsertCompanyDto) {
    return this.svc.upsertCompanyByName(dto);
  }

  @Get('companies/:name/h1b')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  h1bData(@Param('name') name: string) {
    return this.h1b.getCompanySponsorshipData(name);
  }
}
