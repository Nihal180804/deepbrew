import { net } from 'electron';
import { loadSettings } from './db/settings-store.js';

/**
 * Anonymous, opt-OUT product analytics — the ONLY optional outbound calls in the
 * app besides the update check. It sends a single "app opened" ping with no
 * content, no user id, no session data. Off by default (see DEFAULT_SETTINGS).
 *
 * No real endpoint is configured here; ANALYTICS_ENDPOINT is intentionally
 * empty so the app makes zero network calls out of the box. A distributor can
 * set their own endpoint. The privacy posture is: nothing leaves the device
 * unless the user explicitly opts in AND an endpoint exists.
 */

const ANALYTICS_ENDPOINT = ''; // e.g. 'https://example.com/ping' — empty = disabled

export function maybeSendAppOpenPing(appVersion: string): void {
  const settings = loadSettings();
  if (!settings.productAnalyticsEnabled) return;
  if (!ANALYTICS_ENDPOINT) return;

  try {
    const request = net.request({ method: 'POST', url: ANALYTICS_ENDPOINT });
    request.setHeader('Content-Type', 'application/json');
    // Deliberately minimal: event name, app version, platform, coarse locale.
    request.write(
      JSON.stringify({
        event: 'app_open',
        version: appVersion,
        platform: process.platform
      })
    );
    request.on('error', () => {
      /* swallow — analytics must never affect UX */
    });
    request.end();
  } catch {
    /* ignore */
  }
}
