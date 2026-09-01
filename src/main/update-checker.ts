import { net, app } from 'electron';
import { loadSettings } from './db/settings-store.js';

/**
 * Optional, opt-out update check. Fetches a small JSON manifest and compares
 * versions; it never downloads or installs anything automatically — it only
 * reports whether a newer version exists. Disabled unless an endpoint is set.
 */

const UPDATE_MANIFEST_URL = ''; // e.g. 'https://example.com/latest.json'

export interface UpdateInfo {
  available: boolean;
  latest?: string;
  current: string;
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const current = app.getVersion();
  const settings = loadSettings();
  if (!settings.updateCheckEnabled || !UPDATE_MANIFEST_URL) {
    return { available: false, current };
  }

  return new Promise<UpdateInfo>((resolve) => {
    try {
      const request = net.request(UPDATE_MANIFEST_URL);
      let body = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => (body += chunk.toString()));
        response.on('end', () => {
          try {
            const { version } = JSON.parse(body) as { version: string };
            resolve({ available: isNewer(version, current), latest: version, current });
          } catch {
            resolve({ available: false, current });
          }
        });
      });
      request.on('error', () => resolve({ available: false, current }));
      request.end();
    } catch {
      resolve({ available: false, current });
    }
  });
}

function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}
