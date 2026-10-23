/**
 * UPI app detection via deep-link visibility. Each app is probed with
 * `Linking.canOpenURL(scheme)`; on Android the probe requires `<queries>` entries
 * (see AndroidManifest) and on iOS an `LSApplicationQueriesSchemes` entry
 * (see Info.plist) — both granted per AGENTS.md rule 6 (native permissions).
 *
 * Detects installed apps only; it never enumerates all packages (no native
 * package-query module in deps).
 */
import { Linking } from 'react-native';
import { UPI_APP_PACKAGES } from '@/features/cart/payment/paymentData';

export interface UpiApp {
  id: string;
  label: string;
  androidPackage: string;
  iosScheme: string;
  installed: boolean;
}

/** Probes every known UPI app and reports which are installed on this device. */
export async function detectUpiApps(): Promise<UpiApp[]> {
  const apps = await Promise.all(
    UPI_APP_PACKAGES.map(async (pkg): Promise<UpiApp> => {
      // `canOpenURL` takes a URL scheme on both platforms. On Android the scheme probe is matched
      // against the `<queries>` scheme intents in AndroidManifest (Android 11+ package visibility);
      // on iOS it is matched against `LSApplicationQueriesSchemes` in Info.plist.
      const scheme = pkg.iosScheme;
      let installed = false;
      try {
        installed = await Linking.canOpenURL(scheme);
      } catch {
        installed = false;
      }
      return { ...pkg, installed };
    }),
  );
  // Show installed apps first, preserving the stable catalog order within each group.
  return apps.sort((a, b) => Number(b.installed) - Number(a.installed));
}