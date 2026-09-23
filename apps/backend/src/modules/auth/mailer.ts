export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.info("[mail]", message.subject, "->", message.to);
    console.info(message.text);
  }
}

export class SmtpMailer implements Mailer {
  constructor(private readonly smtpUrl: string) {}

  async send(message: MailMessage): Promise<void> {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(this.smtpUrl);
    await transport.sendMail({
      to: message.to,
      from: "wikognito@localhost",
      subject: message.subject,
      text: message.text,
    });
  }
}

export function createMailer(smtpUrl?: string): Mailer {
  if (smtpUrl) {
    return new SmtpMailer(smtpUrl);
  }
  return new ConsoleMailer();
}

export class CapturingMailer implements Mailer {
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }
}
