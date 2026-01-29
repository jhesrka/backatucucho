import nodemailer, { Transporter } from "nodemailer";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  attachments?: Attachments[];
}
interface Attachments {
  filename: string;
  path: string;
}

export class EmailService {
  private transporter: Transporter;
  constructor(
    mailerService: string,
    mailerEmail: string,
    senderEmailPassword: string,
    private readonly postToProvider: boolean
  ) {
    this.transporter = nodemailer.createTransport({
      service: mailerService,
      pool: true, // Use pooled connections
      maxConnections: 1, // Limit concurrent connections to avoid blocking
      rateLimit: 3, // Rate limit messages per second
      auth: {
        user: mailerEmail,
        pass: senderEmailPassword,
      },
    });
  }

  async sendEmail(options: SendEmailOptions) {
    const { to, subject, htmlBody, attachments = [] } = options;

    if (!this.postToProvider) {
      console.warn("⚠️ Email sending is disabled in .env (SEND_EMAIL=false). returning 'true' to simulate success.");
      return true;
    }
    try {
      const sentInformation = await this.transporter.sendMail({
        to: to,
        subject: subject,
        html: htmlBody,
        attachments: attachments,
      });
      console.log(`✅ Email sent to ${to} | ID: ${sentInformation.messageId}`);
      return true;
    } catch (error: any) {
      console.error("Email Service Error:", error);
      if (error?.responseCode === 535) {
        console.error("⚠️ SMTP 535 Error: Authentication failed. If using Gmail, make sure to use an 'App Password', not your main password.");
      }
      return false;
    }
  }
}
