import type { WhatsAppProvider, SendMessageResult } from './provider';

const GRAPH_API_VERSION = 'v20.0';

/**
 * Real WhatsApp Business Platform (Cloud API) send — reaches Meta's
 * Graph API directly, no BSP in between. Needs WHATSAPP_ACCESS_TOKEN and
 * WHATSAPP_PHONE_NUMBER_ID (both from Meta for Developers → your app →
 * WhatsApp → API Setup — see lib/whatsapp/index.ts's own comment for the
 * exact setup steps). Delivery/read status doesn't come back from this
 * call — it arrives later via app/api/webhooks/whatsapp, keyed by the
 * waMessageId this returns.
 */
export class MetaCloudApiProvider implements WhatsAppProvider {
  readonly isDev = false;

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {}

  async sendTemplateMessage(toPhone: string, templateName: string, params: string[]): Promise<SendMessageResult> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: toPhone.replace(/[^\d+]/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components:
          params.length > 0
            ? [
                {
                  type: 'body',
                  parameters: params.map((text) => ({ type: 'text', text })),
                },
              ]
            : [],
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      return { ok: false, error: `Network error calling WhatsApp Cloud API: ${(err as Error).message}` };
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // Meta's own error shape: { error: { message, type, code, ... } }
      const message = data?.error?.message ?? `HTTP ${response.status}`;
      return { ok: false, error: message };
    }

    const waMessageId = data?.messages?.[0]?.id;
    if (!waMessageId) {
      return { ok: false, error: 'WhatsApp API accepted the request but returned no message id' };
    }

    return { ok: true, waMessageId };
  }
}
