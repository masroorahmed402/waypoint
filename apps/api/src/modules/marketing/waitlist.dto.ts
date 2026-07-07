import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinWaitlistDto {
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(60) source?: string;
}
