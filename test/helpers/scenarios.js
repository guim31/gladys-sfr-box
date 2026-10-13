// Every shape the discovered devices can take: DSL or fibre, with or without
// password, with the connected devices, in every language.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildDiscoveredDevices } from '../../src/devices/index.js';
import { normalizeConfig } from '../../src/config.js';
import { readSnapshot } from '../../src/sfr/snapshot.js';
import { LANGUAGES } from '../../src/i18n.js';
import { createFakeBox } from './fake-box.js';

export const SCENARIOS = [
  { name: 'DSL box with password', box: {}, config: {} },
  { name: 'DSL box without password', box: {}, config: { password: '' } },
  { name: 'fibre box', box: { system: 'system.getInfo.box10h' }, config: {} },
  { name: 'FTTB box without MAC', box: { system: 'system.getInfo.3dcm' }, config: {} },
];

export async function snapshotFor(scenario) {
  const box = createFakeBox(scenario.box);
  const config = normalizeConfig({ password: box.password, ...scenario.config });
  return { snapshot: await readSnapshot(box.createClient(config), config), config };
}

/** `[{ scenario, language, devices }]` for every scenario and language. */
export async function allDiscoveries(gladys = createFakeGladys()) {
  const result = [];
  for (const scenario of SCENARIOS) {
    const { snapshot, config } = await snapshotFor(scenario);
    for (const language of LANGUAGES) {
      result.push({
        scenario: scenario.name,
        language,
        snapshot,
        devices: buildDiscoveredDevices(gladys, snapshot, { ...config, language }),
      });
    }
  }
  return result;
}
