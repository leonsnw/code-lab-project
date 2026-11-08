/**
 * Envio de e-mails transacionais (recuperação de senha e verificação).
 * Sem dependência de SMTP: em desenvolvimento o e-mail vai para o log; em
 * produção, MAIL_WEBHOOK_URL recebe um POST JSON (um relay como Resend,
 * Postmark ou um worker próprio faz a entrega).
 */
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
    console.info(`[e-mail] para ${message.to} · ${message.subject}\n${message.text}`);
  }
}

/** Guarda os e-mails em memória (testes e ambiente local sem log). */
export class MemoryMailer implements Mailer {
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
  }
}

export class WebhookMailer implements Mailer {
  constructor(private readonly url: string, private readonly token?: string) {}

  async send(message: MailMessage): Promise<void> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Falha ao enviar e-mail: HTTP ${response.status}`);
  }
}

export function createMailer(environment: string): Mailer {
  const url = process.env.MAIL_WEBHOOK_URL;
  if (url) return new WebhookMailer(url, process.env.MAIL_WEBHOOK_TOKEN);
  return environment === "test" ? new MemoryMailer() : new ConsoleMailer();
}
