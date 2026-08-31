import type { OtpProvider } from './provider';
import { devOtpProvider } from './provider';

/**
 * Swap in MSG91 by setting OTP_PROVIDER=msg91 and implementing an Msg91OtpProvider
 * (WhatsApp/SMS OTP template + auth key — see SRS §5 "External Interface
 * Requirements") that satisfies OtpProvider, then adding it to this switch.
 * Everything else in lib/otp/service.ts stays the same either way.
 */
export function getOtpProvider(): OtpProvider {
  switch (process.env.OTP_PROVIDER) {
    case 'msg91':
      throw new Error(
        'OTP_PROVIDER=msg91 but no MSG91 integration is implemented yet — add one in lib/otp/provider.ts.',
      );
    default:
      return devOtpProvider;
  }
}
