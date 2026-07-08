import { IsString, IsOptional, IsArray, IsIn, MaxLength, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class HistoryMessageDto {
  @IsIn(['user', 'assistant']) role: string;
  @IsString() @MaxLength(2000) content: string;
}

export class AskDto {
  @IsString() @MaxLength(1000) question: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  history?: HistoryMessageDto[];
}

export class DraftEmailDto {
  @IsString() @MaxLength(50) purpose: string;
  @IsOptional() @IsString() @MaxLength(2000) context?: string;
}
