import { IsString, IsISO8601, IsOptional, MaxLength } from 'class-validator';

export class CreateDeadlineDto {
  @IsString() @MaxLength(200) title: string;
  @IsISO8601() dueDate: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateDeadlineDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsISO8601() dismissedAt?: string;
}
