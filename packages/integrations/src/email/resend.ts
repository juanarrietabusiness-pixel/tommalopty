import type { EmailProvider, SendEmailInput, SendEmailResult } from './types';

/**
 * Email transaccional con Resend (confirmaciones de pedido, recuperación de
 * contraseña). Se llama por HTTP para no arrastrar un SDK que no funciona en
 * todos los runtimes.
 */
export const resendProvider: EmailProvider = {
  id: 'resend',

  isConfigured() {
    return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  },

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      return { sent: false, reason: 'email_not_configured' };
    }

    const recipients = Array.isArray(input.to) ? input.to : [input.to];

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: recipients.map((recipient) =>
            recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email,
          ),
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo ?? process.env.EMAIL_REPLY_TO,
        }),
      });

      if (!response.ok) {
        return { sent: false, reason: `resend_http_${response.status}` };
      }

      const result = (await response.json()) as { id?: string };
      return { sent: true, id: result.id };
    } catch (error) {
      return { sent: false, reason: error instanceof Error ? error.message : 'resend_error' };
    }
  },
};
