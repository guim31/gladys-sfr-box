// -----------------------------------------------------------------------------
// The "SFR Box" device: line, Internet connection, system and Wi-Fi.
//
// Each feature is declared once below, with its discovery payload AND the way
// to read its value from a snapshot (src/sfr/snapshot.js): the discovered
// device and the published states can never disagree.
//
// A feature is only declared when the box gives its value: the DSL figures on
// a DSL line, the fibre status on a fibre line, the temperature when the box
// has a sensor, the Wi-Fi state when a working password is configured. A
// change (password added, line migrated to fibre) makes Gladys offer "Update"
// in the Discovery tab.
//
// External ids are forever: the device id derives from the box MAC address
// (src/sfr/snapshot.js), and the feature keys below must never be renamed.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t } from '../i18n.js';

export const BOX_TYPE = 'box';

const binary = (value) => (value === true ? 1 : value === false ? 0 : null);
const isDsl = (snapshot) => snapshot.line?.kind === 'dsl';

// Display text of the line type: the network family, plus the DSL mode.
function lineType(snapshot) {
  if (!snapshot.infra) {
    return null;
  }
  const family = snapshot.infra.toUpperCase();
  return isDsl(snapshot) && snapshot.line.mode ? `${family} (${snapshot.line.mode})` : family;
}

const BINARY = { min: 0, max: 1 };
// Gladys stores min/max as NOT NULL, text features included.
const TEXT = { category: CATEGORIES.TEXT, type: TYPES.TEXT.TEXT, min: 0, max: 0, text: true };

/**
 * key: feature key (forever). name: text key in src/i18n.js. present: is the
 * feature declared for this box. value: number, string (text features) or
 * null when unknown (nothing published).
 */
export const BOX_FEATURES = [
  {
    key: 'wan',
    name: 'feature_wan',
    category: CATEGORIES.INPUT,
    type: TYPES.SENSOR.BINARY,
    ...BINARY,
    keep_history: true,
    present: () => true,
    value: (s) => binary(s.wan.up),
  },
  {
    key: 'ipv6',
    name: 'feature_ipv6',
    category: CATEGORIES.INPUT,
    type: TYPES.SENSOR.BINARY,
    ...BINARY,
    keep_history: true,
    present: () => true,
    value: (s) => binary(s.wan.ipv6Up),
  },
  {
    key: 'line',
    name: (s) => (isDsl(s) ? 'feature_line_dsl' : 'feature_line_ftth'),
    category: CATEGORIES.INPUT,
    type: TYPES.SENSOR.BINARY,
    ...BINARY,
    keep_history: true,
    present: (s) => s.line !== null,
    value: (s) => binary(s.line.up),
  },
  {
    key: 'rate-down',
    name: 'feature_rate_down',
    category: CATEGORIES.DATARATE,
    type: TYPES.DATARATE.RATE,
    unit: UNITS.KILOBITS_PER_SECOND,
    min: 0,
    max: 1_000_000,
    keep_history: true,
    present: isDsl,
    value: (s) => s.line.rateDown,
  },
  {
    key: 'rate-up',
    name: 'feature_rate_up',
    category: CATEGORIES.DATARATE,
    type: TYPES.DATARATE.RATE,
    unit: UNITS.KILOBITS_PER_SECOND,
    min: 0,
    max: 1_000_000,
    keep_history: true,
    present: isDsl,
    value: (s) => s.line.rateUp,
  },
  // Attenuation and noise margin are decibels: the noise-sensor category is
  // the only one Gladys pairs with that unit.
  {
    key: 'attenuation-down',
    name: 'feature_attenuation_down',
    category: CATEGORIES.NOISE_SENSOR,
    type: TYPES.SENSOR.INTEGER,
    unit: UNITS.DECIBEL,
    min: 0,
    max: 100,
    keep_history: true,
    present: isDsl,
    value: (s) => s.line.attenuationDown,
  },
  {
    key: 'attenuation-up',
    name: 'feature_attenuation_up',
    category: CATEGORIES.NOISE_SENSOR,
    type: TYPES.SENSOR.INTEGER,
    unit: UNITS.DECIBEL,
    min: 0,
    max: 100,
    keep_history: true,
    present: isDsl,
    value: (s) => s.line.attenuationUp,
  },
  {
    key: 'noise-margin-down',
    name: 'feature_noise_down',
    category: CATEGORIES.NOISE_SENSOR,
    type: TYPES.SENSOR.INTEGER,
    unit: UNITS.DECIBEL,
    min: 0,
    max: 100,
    keep_history: true,
    present: isDsl,
    value: (s) => s.line.noiseDown,
  },
  {
    key: 'noise-margin-up',
    name: 'feature_noise_up',
    category: CATEGORIES.NOISE_SENSOR,
    type: TYPES.SENSOR.INTEGER,
    unit: UNITS.DECIBEL,
    min: 0,
    max: 100,
    keep_history: true,
    present: isDsl,
    value: (s) => s.line.noiseUp,
  },
  {
    key: 'wifi',
    name: 'feature_wifi',
    category: CATEGORIES.INPUT,
    type: TYPES.SENSOR.BINARY,
    ...BINARY,
    keep_history: true,
    present: (s) => s.wifi !== null,
    value: (s) => binary(s.wifi.active),
  },
  // Whole hours: the uptime then changes once an hour, not at every reading.
  {
    key: 'uptime',
    name: 'feature_uptime',
    category: CATEGORIES.DURATION,
    type: TYPES.DURATION.INTEGER,
    unit: UNITS.HOURS,
    min: 0,
    max: 1_000_000,
    keep_history: false,
    present: (s) => s.uptime !== null,
    value: (s) => Math.floor(s.uptime / 3600),
  },
  {
    key: 'temperature',
    name: 'feature_temperature',
    category: CATEGORIES.DEVICE_TEMPERATURE_SENSOR,
    type: TYPES.SENSOR.DECIMAL,
    unit: UNITS.CELSIUS,
    min: 0,
    max: 120,
    keep_history: true,
    present: (s) => s.temperature !== null,
    value: (s) => s.temperature,
  },
  {
    key: 'public-ip',
    name: 'feature_public_ip',
    ...TEXT,
    keep_history: false,
    present: () => true,
    value: (s) => s.wan.ipv4,
  },
  {
    key: 'line-type',
    name: 'feature_line_type',
    ...TEXT,
    keep_history: false,
    present: (s) => s.infra !== null,
    value: lineType,
  },
  {
    key: 'model',
    name: 'feature_model',
    ...TEXT,
    keep_history: false,
    present: (s) => s.model !== null,
    value: (s) => s.model,
  },
  {
    key: 'firmware',
    name: 'feature_firmware',
    ...TEXT,
    keep_history: false,
    present: (s) => s.firmware !== null,
    value: (s) => s.firmware,
  },
];

export function boxIds(gladys, snapshot) {
  return gladys.externalIds(BOX_TYPE, snapshot.id);
}

/** Discovery payload of the box. */
export function buildBoxDevice(gladys, snapshot, config) {
  const ids = boxIds(gladys, snapshot);
  return {
    name: 'SFR Box',
    external_id: ids.device,
    ...(snapshot.model ? { model: snapshot.model } : {}),
    // Read by the integration's own one-minute timer (src/monitor.js), which
    // also feeds the presence of the connected devices.
    should_poll: false,
    features: BOX_FEATURES.filter((spec) => spec.present(snapshot)).map((spec) => ({
      name: t(typeof spec.name === 'function' ? spec.name(snapshot) : spec.name, config.language),
      external_id: ids.feature(spec.key),
      category: spec.category,
      type: spec.type,
      ...(spec.unit ? { unit: spec.unit } : {}),
      min: spec.min,
      max: spec.max,
      read_only: true,
      has_feedback: false,
      keep_history: spec.keep_history,
    })),
  };
}

/** States of the box features, in the publishStates format (unknown values left out). */
export function boxStates(gladys, snapshot) {
  const ids = boxIds(gladys, snapshot);
  return BOX_FEATURES.filter((spec) => spec.present(snapshot)).flatMap((spec) => {
    const value = spec.value(snapshot);
    const featureId = ids.feature(spec.key);
    if (spec.text) {
      // A text state is never empty, or Gladys ignores it.
      return typeof value === 'string' && value !== ''
        ? [{ device_feature_external_id: featureId, text: value }]
        : [];
    }
    return typeof value === 'number' && Number.isFinite(value)
      ? [{ device_feature_external_id: featureId, state: value }]
      : [];
  });
}
