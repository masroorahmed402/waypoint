import { IsUrl, MaxLength } from 'class-validator';

export class ParseJobUrlDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(2000)
  url: string;
}
