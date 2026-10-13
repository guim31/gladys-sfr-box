// -----------------------------------------------------------------------------
// Configuration screen actions (manifest `actions`): the resolved message, a
// multi-language object, is shown under the button.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { SfrBoxClient } from './sfr/client.js';
import { readSnapshot } from './sfr/snapshot.js';
import { LANGUAGES, t } from './i18n.js';
import { RebootError } from './monitor.js';

const logger = createLogger({ name: 'actions' });

const join = (...parts) =>
  Object.fromEntries(
    LANGUAGES.map((language) => [language, parts.map((part) => part[language]).join('\n')]),
  );

const perLanguage = (render) =>
  Object.fromEntries(LANGUAGES.map((language) => [language, render(language)]));

function lineLabel(snapshot, language) {
  if (!snapshot.line) {
    return snapshot.infra ? snapshot.infra.toUpperCase() : t('value_unknown', language);
  }
  const state =
    snapshot.line.up === null
      ? t('value_unknown', language)
      : t(snapshot.line.up ? 'value_synchronized' : 'value_not_synchronized', language);
  return `${snapshot.infra.toUpperCase()}, ${state}`;
}

function internetLabel(snapshot, language) {
  if (snapshot.wan.up === null) {
    return t('value_unknown', language);
  }
  return t(snapshot.wan.up ? 'value_connected' : 'value_disconnected', language);
}

const AUTH_MESSAGES = {
  ok: 'test_auth_ok',
  none: 'test_auth_none',
  rejected: 'status_auth_rejected',
  button_only: 'status_auth_button_only',
  needed: 'status_auth_rejected',
};

/** Builds the action handlers, keyed like the manifest `actions`. */
export function createActions({ getConfig, monitor, createClient }) {
  const newClient =
    createClient ??
    ((config) =>
      new SfrBoxClient({
        host: config.host,
        username: config.username,
        password: config.password,
      }));

  return {
    // A fresh client: a password refused earlier is tried again.
    async test_connection() {
      const config = getConfig();
      let snapshot;
      try {
        snapshot = await readSnapshot(newClient(config), { ...config, discover_hosts: true });
      } catch (err) {
        logger.warn(`Connection test failed: ${err.message}`);
        return perLanguage((language) => t('status_unreachable', language, { host: config.host }));
      }
      const connected = perLanguage((language) =>
        t('test_connected', language, {
          model: snapshot.model ?? '?',
          firmware: snapshot.firmware ?? '?',
          line: lineLabel(snapshot, language),
          internet: internetLabel(snapshot, language),
        }),
      );
      const hosts =
        snapshot.hosts === null
          ? perLanguage((language) => t('test_hosts_unavailable', language))
          : perLanguage((language) => t('test_hosts', language, { count: snapshot.hosts.length }));
      const auth = perLanguage((language) => t(AUTH_MESSAGES[snapshot.auth], language));
      return join(connected, hosts, auth);
    },

    // An action has no confirmation dialog: the form carries a checkbox.
    async reboot(fields) {
      if (fields?.confirm !== true && fields?.confirm !== 'true') {
        return perLanguage((language) => t('reboot_confirm_needed', language));
      }
      return rebootMessage(monitor);
    },
  };
}

/** Reboot through the monitor, as a multi-language message (actions, widget toast). */
export async function rebootMessage(monitor) {
  try {
    await monitor.reboot();
    return perLanguage((language) => t('reboot_started', language));
  } catch (err) {
    logger.warn(`Reboot failed: ${err.message}`);
    const key =
      err instanceof RebootError || err.reason === 'no_credentials'
        ? 'reboot_no_password'
        : 'reboot_failed';
    return perLanguage((language) => t(key, language));
  }
}
