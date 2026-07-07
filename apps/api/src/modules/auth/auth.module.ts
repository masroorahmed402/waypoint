import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { AppConfig } from '../../config/app.config';
import { EMAIL_SERVICE } from '../notifications/email.interface';
import { ResendEmailService } from '../notifications/resend.email';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService, JwtStrategy, GoogleStrategy, AppConfig,
    { provide: EMAIL_SERVICE, useClass: ResendEmailService },
  ],
  exports: [AuthService],
})
export class AuthModule {}
