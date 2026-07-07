import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { AppConfig } from '../../../config/app.config';

export interface GoogleUser {
  providerAccountId: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: AppConfig) {
    super({
      clientID: config.google.clientId || 'disabled',
      clientSecret: config.google.clientSecret || 'disabled',
      callbackURL: config.google.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  validate(_at: string, _rt: string, profile: Profile): GoogleUser {
    const email = profile.emails?.find((e) => (e as any).verified !== false)?.value;
    if (!email) throw new Error('Google account has no verified email');
    return {
      providerAccountId: profile.id,
      email,
      firstName: profile.name?.givenName ?? 'Student',
      lastName: profile.name?.familyName ?? '',
    };
  }
}
