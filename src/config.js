// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of the manifest.
// This module provides the defaults and normalizes the received object, so the
// rest of the code never deals with `undefined` nor with a number typed as a
// string.
// -----------------------------------------------------------------------------

import { DEFAULT_LANGUAGE, LANGUAGES } from './i18n.js';

// The name the Bbox certificate is issued for. The box resolves it to itself
// through its own DNS server, and only there.
export const BBOX_HOSTNAME = 'mabbox.bytel.fr';

// The fastest the integration reads the Bbox, in seconds: a dozen API calls
// per reading, on a router that also serves the whole household.
export const MIN_REFRESH_INTERVAL = 60;
export const MAX_REFRESH_INTERVAL = 3600;

// Defaults: they MUST stay consistent with the `default` values of the
// manifest `config_schema` (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  // The address every Bbox serves its LAN on. It skips the DNS lookup of
  // mabbox.bytel.fr, which fails as soon as the Gladys host uses another DNS
  // server (Pi-hole, AdGuard...); the certificate is still checked for
  // mabbox.bytel.fr (see src/bbox/transport.js).
  host: '192.168.1.254',
  password: '',
  refresh_interval: MIN_REFRESH_INTERVAL,
  language: DEFAULT_LANGUAGE,
  track_hosts: true,
  tls_verify: 'verify', // 'verify' | 'insecure'
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const interval = Math.round(Number(raw.refresh_interval ?? DEFAULT_CONFIG.refresh_interval));
  return {
    ...DEFAULT_CONFIG,
    host: normalizeHost(raw.host),
    password: typeof raw.password === 'string' ? raw.password : '',
    refresh_interval: Number.isFinite(interval)
      ? Math.min(Math.max(interval, MIN_REFRESH_INTERVAL), MAX_REFRESH_INTERVAL)
      : DEFAULT_CONFIG.refresh_interval,
    language: LANGUAGES.includes(raw.language) ? raw.language : DEFAULT_CONFIG.language,
    // Anything but an explicit false keeps the default (true).
    track_hosts: raw.track_hosts !== false,
    // Only an explicit choice turns the certificate check off.
    tls_verify: raw.tls_verify === 'insecure' ? 'insecure' : 'verify',
  };
}

// Accept what users paste: "https://mabbox.bytel.fr/", "192.168.1.254:443"...
function normalizeHost(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return DEFAULT_CONFIG.host;
  }
  const host = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/:443$/, '')
    .toLowerCase();
  return host || DEFAULT_CONFIG.host;
}
