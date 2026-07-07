import { IsString, IsOptional, IsEnum, IsISO8601, IsBoolean, MaxLength } from 'class-validator';
import { DegreeLevel, VisaType } from '@prisma/client';

export class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
}

export class UpsertProfileDto {
  @IsOptional() @IsString() universityId?: string;
  @IsOptional() @IsString() @MaxLength(200) universityName?: string;
  @IsEnum(DegreeLevel) degreeLevel: DegreeLevel;
  @IsString() @MaxLength(120) major: string;
  @IsEnum(VisaType) visaType: VisaType;
  @IsISO8601() programStartDate: string;
  @IsISO8601() programEndDate: string;
  @IsOptional() @IsISO8601() usEntryDate?: string;
  @IsOptional() @IsBoolean() stemEligible?: boolean;
}
