// -----------------------------------------------------------------------------
// One reading of the box: every API call of a refresh, normalized into plain
// values the devices, the widget and the scene triggers share.
//
// Only system.getInfo and wan.getInfo are mandatory (a box that does not
// answer them is "unreachable"); every other call degrades to `null` on its
// own, so a firmware lacking a method still reports the rest.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { SfrBoxAuthError } from './client.js';

const logger = createLogger({ name: 'snapshot' });

const MAC = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

/** `AA:BB:cc-dd...` → `aabbccddeeff`, or `null` when it is not a full MAC address. */
export function normalizeMac(value) {
  const trimmed = String(value ?? '').trim();
  return MAC.test(trimmed) ? trimmed.replace(/[:-]/g, '').toLowerCase() : null;
}

/** `aabbccddeeff` → `aa:bb:cc:dd:ee:ff`. */
export function formatMac(mac) {
  return mac.match(/../g).join(':');
}

function toNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const upOrNull = (status) => (status === 'up' ? true : status === 'down' ? false : null);
const textOrNull = (value) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * Box temperature in °C. The NB6 family reports milli-degrees (`44699`), the
 * newer boxes degrees (`57.5`): same threshold as Home Assistant. 0 or less
 * means "no sensor".
 */
export function normalizeTemperature(value) {
  const number = toNumber(value);
  if (number === null || number <= 0) {
    return null;
  }
  const celsius = number >= 1000 ? number / 1000 : number;
  return Math.round(celsius * 10) / 10;
}

/**
 * Stable identifier of the box: its MAC address, else its serial number.
 * Every external id derives from it, so it must never change.
 */
function boxId(system) {
  const mac = normalizeMac(system.mac_addr);
  if (mac) {
    return mac;
  }
  const serial = String(system.serial_number ?? '').replace(/[^A-Za-z0-9]/g, '');
  return serial ? serial.toLowerCase() : null;
}

function normalizeHosts(hosts) {
  const byMac = new Map();
  for (const host of hosts) {
    const mac = normalizeMac(host.mac);
    if (!mac) {
      continue;
    }
    // `status` exists since firmware 3.2.0; before it, being listed is the
    // only sign of life.
    const online = host.status === undefined ? true : host.status === 'online';
    const previous = byMac.get(mac);
    byMac.set(mac, {
      mac,
      name: textOrNull(host.name) ?? previous?.name ?? null,
      ip: textOrNull(host.ip) ?? previous?.ip ?? null,
      iface: textOrNull(host.iface),
      online: online || Boolean(previous?.online),
    });
  }
  return [...byMac.values()].sort((a, b) => a.mac.localeCompare(b.mac));
}

async function optional(label, read) {
  try {
    return await read();
  } catch (err) {
    if (err instanceof SfrBoxAuthError) {
      throw err;
    }
    logger.debug(`${label} unavailable: ${err.message}`);
    return null;
  }
}

/**
 * Read the box.
 * @param {import('./client.js').SfrBoxClient} client
 * @param {{ discover_hosts: boolean }} config
 * @returns {Promise<object>} the snapshot; throws when the box is unreachable.
 *   `auth` tells what the password allowed: `none` (no password), `ok`, or the
 *   reason of the refusal (`rejected`, `button_only`, `needed`).
 */
export async function readSnapshot(client, config) {
  const system = await client.systemGetInfo();
  if (!system) {
    throw new Error('system.getInfo: empty answer');
  }
  const id = boxId(system);
  if (!id) {
    throw new Error('system.getInfo: neither MAC address nor serial number');
  }
  const wan = (await client.wanGetInfo()) ?? {};
  const infra = textOrNull(system.net_infra)?.toLowerCase() ?? null;

  let line = null;
  if (infra === 'adsl') {
    const dsl = await optional('dsl.getInfo', () => client.dslGetInfo());
    if (dsl) {
      line = {
        kind: 'dsl',
        up: upOrNull(dsl.status),
        mode: textOrNull(dsl.linemode),
        rateDown: toNumber(dsl.rate_down),
        rateUp: toNumber(dsl.rate_up),
        attenuationDown: toNumber(dsl.attenuation_down),
        attenuationUp: toNumber(dsl.attenuation_up),
        noiseDown: toNumber(dsl.noise_down),
        noiseUp: toNumber(dsl.noise_up),
      };
    }
  } else if (infra === 'ftth') {
    const ftth = await optional('ftth.getInfo', () => client.ftthGetInfo());
    if (ftth) {
      line = { kind: 'ftth', up: upOrNull(ftth.status) };
    }
  }

  // The private calls share one authentication: the first refusal stops the
  // others (and the client then stops trying until the config changes).
  let auth = client.hasCredentials ? 'ok' : 'none';
  const authenticated = async (label, read) => {
    if (auth !== 'ok') {
      return null;
    }
    try {
      return await optional(label, read);
    } catch (err) {
      auth = err.reason;
      logger.debug(`${label} needs a working password: ${err.message}`);
      return null;
    }
  };

  const wlan = await authenticated('wlan.getInfo', () => client.wlanGetInfo());
  let hosts = null;
  if (config.discover_hosts) {
    // Without a working password, the public call may still answer.
    const list =
      auth === 'ok'
        ? await authenticated('lan.getHostsList', () => client.lanGetHostsList())
        : await optional('lan.getHostsList', () => client.lanGetHostsList()).catch(() => null);
    hosts = list ? normalizeHosts(list).filter((host) => host.mac !== id) : null;
  }

  return {
    id,
    model: textOrNull(system.product_id),
    firmware: textOrNull(system.version_mainfirmware),
    infra,
    uptime: toNumber(system.uptime),
    temperature: normalizeTemperature(system.temperature),
    wan: {
      up: upOrNull(wan.status),
      ipv4: textOrNull(wan.ip_addr),
      ipv6Up: upOrNull(wan.status6),
    },
    line,
    wifi: wlan ? { active: wlan.active === 'on' } : null,
    hosts,
    auth,
  };
}
