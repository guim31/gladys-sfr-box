// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with `undefined` or form strings.
// -----------------------------------------------------------------------------

import { resolveLanguage } from './i18n.js';

export const DEFAULT_CONFIG = {
  host: '192.168.1.1',
  username: 'admin',
  password: '',
  discover_hosts: true,
  language: 'fr',
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const text = (value, fallback) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
  return {
    host: text(raw.host, DEFAULT_CONFIG.host),
    username: text(raw.username, DEFAULT_CONFIG.username),
    // Never trimmed: a password may legitimately end with a space.
    password: typeof raw.password === 'string' ? raw.password : DEFAULT_CONFIG.password,
    discover_hosts: raw.discover_hosts !== false && raw.discover_hosts !== 'false',
    language: resolveLanguage(raw.language ?? DEFAULT_CONFIG.language),
  };
}
