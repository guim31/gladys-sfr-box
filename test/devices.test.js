import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { boxStates, buildBoxDevice } from '../src/devices/box.js';
import { buildHostDevice } from '../src/devices/host.js';
import { normalizeConfig } from '../src/config.js';
import { allDiscoveries, SCENARIOS, snapshotFor } from './helpers/scenarios.js';

const gladys = createFakeGladys(); // selector: test-integration
const scenario = (name) => snapshotFor(SCENARIOS.find((s) => s.name === name));

test('the external ids never change: device from the MAC, frozen feature keys', async () => {
  // Gladys keys devices, history and scenes on these ids: a change here
  // orphans every existing device. Extend the list, never edit it.
  const { snapshot, config } = await scenario('DSL box with password');
  const box = buildBoxDevice(gladys, snapshot, config);
  assert.equal(box.external_id, 'ext:test-integration:box:02005e100001');
  assert.deepEqual(
    box.features.map((feature) => feature.external_id.slice(box.external_id.length + 1)),
    [
      'wan',
      'ipv6',
      'line',
      'rate-down',
      'rate-up',
      'attenuation-down',
      'attenuation-up',
      'noise-margin-down',
      'noise-margin-up',
      'wifi',
      'uptime',
      'temperature',
      'public-ip',
      'line-type',
      'model',
      'firmware',
    ],
  );
  const host = buildHostDevice(gladys, snapshot.hosts[0], config);
  assert.equal(host.external_id, 'ext:test-integration:host:02005e0000a1');
  assert.equal(host.features[0].external_id, `${host.external_id}:presence`);
});

test('a fibre box has a fibre line feature and no DSL figures', async () => {
  const { snapshot, config } = await scenario('fibre box');
  const box = buildBoxDevice(gladys, snapshot, config);
  const keys = box.features.map((feature) => feature.external_id.split(':').pop());
  assert.ok(keys.includes('line'));
  assert.ok(!keys.includes('rate-down'));
  assert.equal(
    box.features.find((f) => f.external_id.endsWith(':line')).name,
    'Ligne fibre active',
  );
});

test('without password, no Wi-Fi feature', async () => {
  const { snapshot, config } = await scenario('DSL box without password');
  const box = buildBoxDevice(gladys, snapshot, config);
  assert.ok(!box.features.some((feature) => feature.external_id.endsWith(':wifi')));
});

test('feature names follow the configured language', async () => {
  const { snapshot } = await scenario('DSL box with password');
  const name = (language) =>
    buildBoxDevice(gladys, snapshot, normalizeConfig({ language })).features[0].name;
  assert.deepEqual(['en', 'fr', 'de', 'es'].map(name), [
    'Internet connection',
    'Connexion Internet',
    'Internetverbindung',
    'Conexión a Internet',
  ]);
});

test('a connected device without a name is named after its MAC', async () => {
  const { snapshot, config } = await scenario('DSL box with password');
  const nameless = snapshot.hosts.find((host) => host.name === null);
  assert.equal(buildHostDevice(gladys, nameless, config).name, '02:00:5e:00:00:c3');
});

test('the connected devices are only discovered when the configuration asks for them', async () => {
  const { snapshot, config } = await scenario('DSL box with password');
  assert.equal(buildDiscoveredDevices(gladys, snapshot, config).length, 4);
  assert.equal(
    buildDiscoveredDevices(gladys, snapshot, { ...config, discover_hosts: false }).length,
    1,
  );
  assert.deepEqual(buildDiscoveredDevices(gladys, null, config), []);
});

test('Gladys accepts every discovery payload', async () => {
  // The fake refuses what the host API refuses (prefix, category, type, unit…).
  const fresh = createFakeGladys();
  for (const { scenario: name, language, devices } of await allDiscoveries(fresh)) {
    await fresh.publishDiscoveredDevices(devices);
    assert.equal(fresh.fake.discoveredDevices.length, devices.length, `${name}/${language}`);
  }
});

test('the box states: numbers for measures, never-empty texts', async () => {
  const { snapshot } = await scenario('DSL box with password');
  const states = Object.fromEntries(
    boxStates(gladys, snapshot).map((s) => [
      s.device_feature_external_id.split(':').pop(),
      s.state ?? s.text,
    ]),
  );
  assert.deepEqual(states, {
    wan: 1,
    ipv6: 0,
    line: 1,
    'rate-down': 5549,
    'rate-up': 187,
    'attenuation-down': 28.5,
    'attenuation-up': 20.8,
    'noise-margin-down': 5.8,
    'noise-margin-up': 6,
    wifi: 1,
    uptime: 653,
    temperature: 27.6,
    'public-ip': '203.0.113.45',
    'line-type': 'ADSL (ADSL2+)',
    model: 'NB6VAC-FXC-r0',
    firmware: 'NB6VAC-MAIN-R4.0.44k',
  });
});

test('an unknown value is not published', async () => {
  const { snapshot } = await scenario('DSL box with password');
  const partial = {
    ...snapshot,
    wan: { up: null, ipv4: null, ipv6Up: null },
    line: { ...snapshot.line, rateDown: null },
  };
  const keys = boxStates(gladys, partial).map((s) => s.device_feature_external_id.split(':').pop());
  for (const key of ['wan', 'ipv6', 'public-ip', 'rate-down']) {
    assert.ok(!keys.includes(key), `${key} published without a value`);
  }
});
