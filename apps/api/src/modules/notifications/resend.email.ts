import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';
import { EmailService, EmailMessage } from './email.interface';

/**
 * Sends via Resend's REST API (no SDK dependency — global fetch). If no API key
 * is configured, logs the email instead of sending, so the app runs either way.
 */
@Injectable()
export class ResendEmailService implements EmailService {
  private readonly log = new Logger('Email');

  constructor(private config: AppConfig) {}

  async send(msg: EmailMessage): Promise<void> {
    if (!this.config.resendApiKey) {
      this.log.log(`[dev, no RESEND_API_KEY] would email ${msg.to}: ${msg.subject}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.emailFrom,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.error(`Resend failed (${res.status}): ${body}`);
      throw new Error('Email send failed');
    }
  }
}
