export const EMAIL_SERVICE = Symbol('EMAIL_SERVICE');

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailService {
  send(msg: EmailMessage): Promise<void>;
}
