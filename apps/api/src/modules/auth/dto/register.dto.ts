import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  @MaxLength(128)
  password: string;

  @IsString() @MinLength(1) @MaxLength(80)
  firstName: string;

  @IsString() @MinLength(1) @MaxLength(80)
  lastName: string;
}
