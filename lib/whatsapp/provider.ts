export type SendMessageResult =
  | { ok: true; waMessageId: string }
  | { ok: false; error: string };

export interface WhatsAppProvider {
  /**
   * Sends a template message to `toPhone` (E.164, e.g. "+919876543210").
   * `templateName` must already exist and be approved in the connected
   * WhatsApp Business Account — free-form text can only be sent inside an
   * open 24-hour customer-service window, which a fresh "Connect" doesn't
   * have yet. `params` fill the template's numbered placeholders in order.
   */
  sendTemplateMessage(
    toPhone: string,
    templateName: string,
    params: string[],
  ): Promise<SendMessageResult>;
  /** True for providers that don't actually reach WhatsApp — never true
   *  for a real delivery provider. */
  readonly isDev: boolean;
}

/**
 * Logs the send to the server console instead of calling Meta's API.
 * This is the default until real WhatsApp Business Platform credentials
 * exist — see lib/whatsapp/index.ts for how to swap it. Returns a fake
 * but realistically-shaped waMessageId so calling code (and the POC demo
 * page) can exercise the full status-tracking flow without live
 * credentials — it just never actually progresses past 'sent' on its own,
 * since there's no real webhook to advance it.
 */
class DevWhatsAppProvider implements WhatsAppProvider {
  readonly isDev = true;

  async sendTemplateMessage(toPhone: string, templateName: string, params: string[]): Promise<SendMessageResult> {
    const fakeId = `dev_wamid_${Date.now()}`;
    console.log(
      `[dev-whatsapp] would send template "${templateName}" ${JSON.stringify(params)} to ${toPhone} (fake id ${fakeId}) — configure WHATSAPP_PROVIDER=meta_cloud_api for a real send`,
    );
    return { ok: true, waMessageId: fakeId };
  }
}

export const devWhatsAppProvider = new DevWhatsAppProvider();
