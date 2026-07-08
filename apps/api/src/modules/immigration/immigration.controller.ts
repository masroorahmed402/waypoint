import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ImmigrationService } from './immigration.service';
import { AiAdvisorService } from './ai-advisor.service';
import { UscisTrackerService } from './uscis-tracker.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { CreateDeadlineDto, UpdateDeadlineDto } from './dto/deadline.dto';
import { AskDto, DraftEmailDto } from './dto/ai-advisor.dto';
import { AddUscisCaseDto } from './dto/uscis-case.dto';

@Controller('immigration')
export class ImmigrationController {
  constructor(
    private svc: ImmigrationService,
    private aiAdvisor: AiAdvisorService,
    private uscis: UscisTrackerService,
  ) {}

  @Get('timeline')
  timeline(@CurrentUser() u: JwtUser) { return this.svc.timeline(u.sub); }

  @Get('cpt-summary')
  cptSummary(@CurrentUser() u: JwtUser) { return this.svc.getCptSummary(u.sub); }

  @Get('dso-contact')
  dsoContact(@CurrentUser() u: JwtUser) { return this.svc.getDsoContact(u.sub); }

  @Post('opt-unemployment/start')
  startOptUnemployment(@CurrentUser() u: JwtUser) { return this.svc.startOptUnemployment(u.sub); }

  @Post('opt-unemployment/end')
  endOptUnemployment(@CurrentUser() u: JwtUser) { return this.svc.endOptUnemployment(u.sub); }

  @Get('opt-unemployment/summary')
  optUnemploymentSummary(@CurrentUser() u: JwtUser) { return this.svc.getOptUnemploymentSummary(u.sub); }

  @Get('deadlines/export.ics')
  async exportIcs(@CurrentUser() u: JwtUser, @Res() res: Response) {
    const ics = await this.svc.exportIcs(u.sub);
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="waypoint-deadlines.ics"',
    });
    res.send(ics);
  }

  @Get('deadlines')
  deadlines(@CurrentUser() u: JwtUser, @Query('status') status?: string) {
    return this.svc.listDeadlines(u.sub, status === 'upcoming');
  }

  @Post('deadlines')
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateDeadlineDto) {
    return this.svc.createCustom(u.sub, dto);
  }

  @Patch('deadlines/:id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateDeadlineDto) {
    return this.svc.update(u.sub, id, dto);
  }

  @Delete('deadlines/:id')
  @HttpCode(204)
  async remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    await this.svc.removeCustom(u.sub, id);
  }

  @Post('ask')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  ask(@CurrentUser() u: JwtUser, @Body() body: AskDto) {
    return this.aiAdvisor.ask(u.sub, body.question, body.history);
  }

  @Post('draft-email')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  draftEmail(@CurrentUser() u: JwtUser, @Body() body: DraftEmailDto) {
    return this.aiAdvisor.draftDsoEmail(u.sub, body.purpose, body.context);
  }

  @Post('cases')
  addCase(@CurrentUser() u: JwtUser, @Body() body: AddUscisCaseDto) {
    return this.uscis.addCase(u.sub, body.receiptNumber, body.caseType);
  }

  @Get('cases')
  listCases(@CurrentUser() u: JwtUser) {
    return this.uscis.list(u.sub);
  }

  @Get('cases/:receiptNumber/check')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  checkCase(@CurrentUser() u: JwtUser, @Param('receiptNumber') receiptNumber: string) {
    return this.uscis.checkOne(u.sub, receiptNumber);
  }

  @Delete('cases/:receiptNumber')
  @HttpCode(204)
  async removeCase(@CurrentUser() u: JwtUser, @Param('receiptNumber') receiptNumber: string) {
    await this.uscis.remove(u.sub, receiptNumber);
  }
}
