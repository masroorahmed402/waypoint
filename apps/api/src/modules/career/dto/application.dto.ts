import { IsString, IsOptional, IsEnum, IsInt, IsUrl, IsISO8601, MaxLength, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ApplicationStage, TriState } from '@prisma/client';

export class CreateApplicationDto {
  @IsString() @MaxLength(200) companyName: string;
  @IsOptional() @IsString() companyId?: string;
  @IsString() @MaxLength(200) roleTitle: string;
  @IsOptional() @IsUrl() url?: string;
  @IsOptional() @IsEnum(ApplicationStage) stage?: ApplicationStage;
  @IsOptional() @IsEnum(TriState) sponsorshipConfirmed?: TriState;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsInt() @Min(0) salaryMin?: number;
  @IsOptional() @IsInt() @Min(0) salaryMax?: number;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsISO8601() appliedAt?: string;
}

export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {}
