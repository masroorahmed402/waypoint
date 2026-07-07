import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MarketingService } from './marketing.service';
import { JoinWaitlistDto } from './waitlist.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('waitlist')
export class MarketingController {
  constructor(private svc: MarketingService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(200)
  @Post()
  join(@Body() dto: JoinWaitlistDto) {
    return this.svc.join(dto);
  }
}
