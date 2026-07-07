import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpsertCompanyDto {
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsBoolean() sponsorsH1b?: boolean;
}
