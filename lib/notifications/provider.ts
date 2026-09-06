export interface NotificationProvider {
  /** Sends an email. Throws on delivery failure. */
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  /** Sends an SMS. Throws on delivery failure. */
  sendSms(to: string, message: string): Promise<void>;
  /** True for providers that don't actually deliver anywhere — never true
   *  for a real provider. */
  readonly isDev: boolean;
}

/**
 * Logs to the server console instead of sending anything. This is the
 * default until real MSG91 (or equivalent) credentials exist — see
 * lib/notifications/index.ts for how to swap it. Same pattern as
 * lib/otp/provider.ts's DevOtpProvider and lib/whatsapp/provider.ts's
 * DevWhatsAppProvider.
 */
class DevNotificationProvider implements NotificationProvider {
  readonly isDev = true;

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[dev-notify] EMAIL → ${to} | ${subject}\n${body}`);
  }

  async sendSms(to: string, message: string): Promise<void> {
    console.log(`[dev-notify] SMS → ${to} | ${message}`);
  }
}

export const devNotificationProvider = new DevNotificationProvider();
