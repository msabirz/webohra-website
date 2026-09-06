import type { NotificationProvider } from './provider';
import { devNotificationProvider } from './provider';

/**
 * Notifications infrastructure (Tier 3, item 20, 2026-09-06). Same
 * provider-abstraction pattern as lib/otp/index.ts's getOtpProvider() and
 * lib/whatsapp/index.ts's getWhatsAppProvider() — swap by env var, never
 * a code change at any call site. MSG91 is the intended real provider
 * (already the OTP vendor, and already confirmed to cover WhatsApp too —
 * see [[webohra-fulfillment-subscriptions-phases]]), one account covering
 * email, SMS, and OTP instead of separate vendor relationships.
 *
 * To go live: implement an Msg91NotificationProvider satisfying
 * NotificationProvider in lib/notifications/provider.ts, add it to the
 * switch below, set NOTIFICATION_PROVIDER=msg91 + real credentials in
 * .env.local.
 */
export function getNotificationProvider(): NotificationProvider {
  switch (process.env.NOTIFICATION_PROVIDER) {
    case 'msg91':
      throw new Error(
        'NOTIFICATION_PROVIDER=msg91 but no MSG91 integration is implemented yet — add one in lib/notifications/provider.ts.',
      );
    default:
      return devNotificationProvider;
  }
}
