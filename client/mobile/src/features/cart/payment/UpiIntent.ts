/**
 * UPI intent builder + launcher (single source of truth for payment deep-links).
 *
 * Android opens the standard `upi://pay?...` intent and lets the OS chooser pick an app.
 * iOS has no shared `upi://` handler: the intent must target the app's own scheme
 * (`gpay://upi/pay`, `phonepe://upi/pay`, `paytmmp://upi/pay`, `bhim://upi/pay`), so the
 * generic intent is rewritten per chosen app before launch.
 *
 * Detection lives in `src/services/upi.ts`; this module only builds + launches. The `tr`
 * (transaction reference) carries the Razorpay order id so the server webhook can reconcile.
 */
import { Linking, Platform } from 'react-native';
import { UPI_MERCHANT_NAME, UPI_MERCHANT_VPA } from './paymentData';

/** App-specific iOS launch base. Keys match `UPI_APP_PACKAGES[].id`. */
export const IOS_SCHEME_MAP: Record<string, string> = {
  gpay: 'gpay://upi/pay',
  phonepe: 'phonepe://upi/pay',
  paytm: 'paytmmp://upi/pay',
  bhim: 'bhim://upi/pay',
};

/** Deep-link the UPI app (or the Faazio app, if configured) returns to after payment. */
export const UPI_CALLBACK_URL = 'faazio://payment/callback';

export interface UpiIntentInput {
  /** Faazio order id (shown in the note). */
  orderId: string;
  /** Payable amount in paisa (converted to the UPI `am` decimal string). */
  amountPaisa: number;
  /** Transaction reference — the Razorpay order id the webhook reconciles on. */
  txnRef: string;
  /** Merchant display name. */
  payeeName?: string;
  /** Optional transaction note. */
  note?: string;
}

/**
 * Build the generic `upi://pay?...` intent. Every value is URI-encoded; `am` is the
 * two-decimal rupee amount, `cu` is INR, and `tr` is the reconciliation reference.
 */
export function buildUpiIntent(input: UpiIntentInput): string {
  const amount = (Math.max(0, input.amountPaisa) / 100).toFixed(2);
  const params: [string, string][] = [
    ['pa', UPI_MERCHANT_VPA],
    ['pn', input.payeeName || UPI_MERCHANT_NAME],
    ['am', amount],
    ['cu', 'INR'],
    ['tn', input.note || `Faazio order ${input.orderId}`],
    ['tr', input.txnRef],
    ['url', UPI_CALLBACK_URL],
  ];
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `upi://pay?${query}`;
}

/**
 * Rewrite the generic intent to the app's iOS scheme. Non-iOS apps (e.g. Amazon Pay) and
 * unknown ids are returned unchanged, so an unlisted app still gets a best-effort `upi://`.
 */
export function rewriteForIos(intent: string, upiAppId: string): string {
  const base = IOS_SCHEME_MAP[upiAppId];
  if (!base) return intent;
  const q = intent.indexOf('?');
  return q === -1 ? base : `${base}${intent.slice(q)}`;
}

/** Platform-appropriate launch URL for one UPI app. */
export function getUpiLaunchUrl(intent: string, upiAppId: string): string {
  return Platform.OS === 'ios' ? rewriteForIos(intent, upiAppId) : intent;
}

/**
 * Probe + open the UPI app. Returns false (never throws) when the app/scheme is not
 * installed or the OS refuses the open, so the caller can fall back to the failure screen.
 */
export async function launchUpiPayment(upiAppId: string, intent: string): Promise<boolean> {
  const url = getUpiLaunchUrl(intent, upiAppId);
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
