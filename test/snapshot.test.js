import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMac, normalizeTemperature, readSnapshot } from '../src/sfr/snapshot.js';
import { normalizeConfig } from '../src/config.js';
import { createFakeBox, fixture } from './helpers/fake-box.js';

const read = (box, raw = {}) => {
  const config = normalizeConfig({ password: box.password, ...raw });
  return readSnapshot(box.createClient(config), config);
};

test('a DSL box (NB6VAC) with its password', async () => {
  const snapshot = await read(createFakeBox());
  assert.deepEqual(snapshot, {
    id: '02005e100001',
    model: 'NB6VAC-FXC-r0',
    firmware: 'NB6VAC-MAIN-R4.0.44k',
    infra: 'adsl',
    uptime: 2353575,
    temperature: 27.6,
    wan: { up: true, ipv4: '203.0.113.45', ipv6Up: false },
    line: {
      kind: 'dsl',
      up: true,
      mode: 'ADSL2+',
      rateDown: 5549,
      rateUp: 187,
      attenuationDown: 28.5,
      attenuationUp: 20.8,
      noiseDown: 5.8,
      noiseUp: 6,
    },
    wifi: { active: true },
    hosts: [
      {
        mac: '02005e0000a1',
        name: 'phone-alice',
        ip: '192.168.1.20',
        iface: 'wlan0',
        online: true,
      },
      { mac: '02005e0000b2', name: 'laptop', ip: '192.168.1.21', iface: 'lan1', online: false },
      { mac: '02005e0000c3', name: null, ip: '192.168.1.22', iface: 'wlan0', online: true },
    ],
    auth: 'ok',
  });
});

test('a fibre box (Box 10 firmware) reports its fibre line and its temperature in °C', async () => {
  const snapshot = await read(createFakeBox({ system: 'system.getInfo.box10h' }), {
    password: '',
  });
  assert.equal(snapshot.id, '02005e100002');
  assert.deepEqual(snapshot.line, { kind: 'ftth', up: true });
  assert.equal(snapshot.temperature, 48.5);
  assert.equal(snapshot.wifi, null, 'no password, no Wi-Fi state');
  assert.equal(snapshot.auth, 'none');
  assert.equal(snapshot.hosts.length, 3, 'the public host list still answers');
});

test('a box without MAC address (firmware 3DCM, FTTB) is identified by its serial', async () => {
  const snapshot = await read(createFakeBox({ system: 'system.getInfo.3dcm' }));
  assert.equal(snapshot.id, 'mu0000000000000000');
  assert.equal(snapshot.infra, 'fttb');
  assert.equal(snapshot.line, null, 'no line method for FTTB');
});

test('the malformed dsl.getInfo of firmware 3DCM020200r015 is read', async () => {
  const box = createFakeBox({ overrides: { 'dsl.getInfo': fixture('dsl.getInfo.3dcm') } });
  const snapshot = await read(box);
  assert.equal(snapshot.line.rateDown, 8000);
  assert.equal(snapshot.line.mode, 'G.DMT');
});

test('a fibre box whose firmware answers an empty ftth.getInfo has no line feature', async () => {
  const box = createFakeBox({
    system: 'system.getInfo.box10h',
    overrides: { 'ftth.getInfo': fixture('ftth.getInfo.empty') },
  });
  assert.equal((await read(box)).line, null);
});

test('a refused password keeps the public readings', async () => {
  const box = createFakeBox({ password: 'not-the-configured-one' });
  const snapshot = await read(box, { password: 'Fake-Admin-Password-42' });
  assert.equal(snapshot.auth, 'rejected');
  assert.equal(snapshot.wifi, null);
  assert.equal(snapshot.hosts.length, 3);
  assert.equal(snapshot.line.rateDown, 5549);
});

test('a host list behind a token stays unknown without a working password', async () => {
  const box = createFakeBox({ hostsPrivate: true });
  assert.equal((await read(box, { password: '' })).hosts, null);
  assert.equal((await read(box)).hosts.length, 3);
});

test('the connected devices are not read when the configuration says so', async () => {
  const box = createFakeBox();
  assert.equal((await read(box, { discover_hosts: false })).hosts, null);
  assert.equal(box.calls('lan.getHostsList').length, 0);
});

test('an optional method that fails does not fail the reading', async () => {
  const box = createFakeBox({ overrides: { 'dsl.getInfo': null, 'lan.getHostsList': null } });
  const snapshot = await read(box);
  assert.equal(snapshot.line, null);
  assert.equal(snapshot.hosts, null);
  assert.equal(snapshot.wan.up, true);
});

test('an unreachable box fails the reading', async () => {
  const box = createFakeBox();
  box.reachable = false;
  await assert.rejects(read(box), /box unreachable/);
});

test('the box itself is not listed among the connected devices', async () => {
  const hosts = fixture('lan.getHostsList').replace('02:00:5E:00:00:B2', '02:00:5E:10:00:01');
  const snapshot = await read(createFakeBox({ overrides: { 'lan.getHostsList': hosts } }));
  assert.deepEqual(
    snapshot.hosts.map((host) => host.mac),
    ['02005e0000a1', '02005e0000c3'],
  );
});

test('the temperature is read in milli-degrees or degrees, 0 meaning no sensor', () => {
  assert.equal(normalizeTemperature('44699'), 44.7);
  assert.equal(normalizeTemperature('57.5'), 57.5);
  assert.equal(normalizeTemperature('0'), null);
  assert.equal(normalizeTemperature(''), null);
  assert.equal(normalizeTemperature(undefined), null);
});

test('MAC addresses are normalized', () => {
  assert.equal(normalizeMac('02:00:5E:00:00:A1'), '02005e0000a1');
  assert.equal(normalizeMac('02-00-5e-00-00-a1'), '02005e0000a1');
  assert.equal(normalizeMac('6C:61:F4:xxxxxx'), null);
  assert.equal(normalizeMac(undefined), null);
});
