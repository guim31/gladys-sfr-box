// -----------------------------------------------------------------------------
// A device connected to the box, for presence detection.
//
// Same pattern as the Bluetooth presence of the Gladys core: one
// `presence-sensor`/`push` feature, published to 1 whenever the device is
// seen. Gladys shows it as "seen N minutes ago", and the core scene action
// "check user presence" compares that date with its delay. Nothing is
// published when the device is gone: the date simply ages.
//
// The id derives from the MAC address. Phones that randomize their Wi-Fi MAC
// (private address) show up under a new id per network: see the docs.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { t } from '../i18n.js';
import { formatMac } from '../sfr/snapshot.js';

export const HOST_TYPE = 'host';
export const PRESENCE_FEATURE = 'presence';

export function hostIds(gladys, host) {
  return gladys.externalIds(HOST_TYPE, host.mac);
}

/** Discovery payload of a connected device. */
export function buildHostDevice(gladys, host, config) {
  const ids = hostIds(gladys, host);
  return {
    name: host.name ?? formatMac(host.mac),
    external_id: ids.device,
    should_poll: false,
    features: [
      {
        name: t('feature_presence', config.language),
        external_id: ids.feature(PRESENCE_FEATURE),
        category: DEVICE_FEATURE_CATEGORIES.PRESENCE_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.PUSH,
        min: 0,
        max: 1,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      },
    ],
  };
}
