import type { WhatsAppProvider } from './provider';
import { devWhatsAppProvider } from './provider';
import { MetaCloudApiProvider } from './meta-cloud-api';

/**
 * POC (2026-09-05) — see [[webohra-fulfillment-subscriptions-phases]] for
 * the full "must-do" writeup this came from.
 *
 * To go from the dev no-op to a real send:
 *   1. developers.facebook.com → My Apps → Create App → "Business" type
 *   2. Add the WhatsApp product to it
 *   3. WhatsApp → API Setup — Meta auto-provisions a free test number and
 *      a temporary access token. Copy the "Phone number ID" shown there.
 *   4. Add up to 5 recipient test numbers (verified via a code WhatsApp
 *      sends them) — a test-mode number can only message these.
 *   5. Set in .env.local:
 *        WHATSAPP_PROVIDER=meta_cloud_api
 *        WHATSAPP_ACCESS_TOKEN=<the token from step 3>
 *        WHATSAPP_PHONE_NUMBER_ID=<the phone number id from step 3>
 *   6. For webhook delivery/read status (app/api/webhooks/whatsapp) —
 *      WhatsApp → Configuration → Webhook URL. This MUST be a real public
 *      HTTPS URL; localhost doesn't work — use `ngrok http 3001` for local
 *      testing, or a deployed preview URL. Pick any string as the Verify
 *      Token and also set it here:
 *        WHATSAPP_WEBHOOK_VERIFY_TOKEN=<the same string>
 *      Subscribe the webhook to the "messages" field.
 *
 * Same pattern as lib/otp/index.ts's getOtpProvider() — swap by env var,
 * never a code change at the call site.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  switch (process.env.WHATSAPP_PROVIDER) {
    case 'meta_cloud_api': {
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!accessToken || !phoneNumberId) {
        throw new Error(
          'WHATSAPP_PROVIDER=meta_cloud_api but WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID is missing from .env.local — see this file\'s own comment for where to get them.',
        );
      }
      return new MetaCloudApiProvider(accessToken, phoneNumberId);
    }
    default:
      return devWhatsAppProvider;
  }
}
