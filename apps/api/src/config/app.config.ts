import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Fail-fast env validation: the app refuses to boot misconfigured. */
export function validateEnv(env: Record<string, unknown>) {
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'FIELD_ENCRYPTION_KEY'];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  if (env.NODE_ENV === 'production') {
    if (String(env.JWT_ACCESS_SECRET).includes('change-me')) {
      throw new Error('JWT_ACCESS_SECRET is still the placeholder value');
    }
    if (env.STORAGE_DRIVER === 's3' && !env.S3_BUCKET) {
      throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET');
    }
  }
  return env;
}

@Injectable()
export class AppConfig {
  constructor(private readonly cs: ConfigService) {}

  get port() { return parseInt(this.cs.get('API_PORT') ?? '4000', 10); }
  get isProd() { return this.cs.get('NODE_ENV') === 'production'; }
  get webOrigin() { return this.cs.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000'; }
  get jwtAccessSecret() { return this.cs.getOrThrow<string>('JWT_ACCESS_SECRET'); }
  get jwtAccessTtl() { return this.cs.get<string>('JWT_ACCESS_TTL') ?? '15m'; }
  get refreshTtlDays() { return parseInt(this.cs.get('REFRESH_TOKEN_TTL_DAYS') ?? '30', 10); }
  get storageDriver() { return this.cs.get<string>('STORAGE_DRIVER') ?? 'local'; }
  get s3Bucket() { return this.cs.get<string>('S3_BUCKET') ?? ''; }
  get s3Region() { return this.cs.get<string>('S3_REGION') ?? 'us-east-1'; }
  get s3Endpoint() { return this.cs.get<string>('S3_ENDPOINT') ?? ''; }
  get fieldEncryptionKey() { return this.cs.getOrThrow<string>('FIELD_ENCRYPTION_KEY'); }
  get resendApiKey() { return this.cs.get<string>('RESEND_API_KEY') ?? ''; }
  get anthropicApiKey() { return this.cs.get<string>('ANTHROPIC_API_KEY') ?? ''; }
  get emailFrom() { return this.cs.get<string>('EMAIL_FROM') ?? 'Waypoint <onboarding@resend.dev>'; }
  get google() {
    return {
      clientId: this.cs.get<string>('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: this.cs.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      callbackUrl: this.cs.get<string>('GOOGLE_CALLBACK_URL') ?? '',
    };
  }
}
