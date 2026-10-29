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
  constructor(
    private readonly smtpUrl: string,
    private readonly from: string = "wikognito@localhost",
  ) {}

  async send(message: MailMessage): Promise<void> {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(this.smtpUrl);
    await transport.sendMail({
      to: message.to,
      from: this.from,
      subject: message.subject,
      text: message.text,
    });
  }
}

export function createMailer(smtpUrl?: string, from?: string): Mailer {
  if (smtpUrl) {
    return new SmtpMailer(smtpUrl, from);
  }
  return new ConsoleMailer();
}

export class CapturingMailer implements Mailer {
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }
}
