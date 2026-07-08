import { IsString, IsOptional, IsBoolean, IsIn, MinLength, MaxLength } from 'class-validator';

export const COMMUNITY_CATEGORIES = ['opt', 'cpt', 'housing', 'jobs', 'tax', 'general'] as const;

export class CreatePostDto {
  @IsString() @MinLength(3) @MaxLength(200)
  title: string;

  @IsString() @MinLength(1) @MaxLength(5000)
  content: string;

  @IsIn(COMMUNITY_CATEGORIES)
  category: string;

  @IsOptional() @IsBoolean()
  isAnonymous?: boolean;
}

export class CreateReplyDto {
  @IsString() @MinLength(1) @MaxLength(3000)
  content: string;

  @IsOptional() @IsBoolean()
  isAnonymous?: boolean;
}
