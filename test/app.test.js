// End to end: the handlers of src/app.js against the SDK's fake Gladys and a
// fake box. Date is mocked, so the heartbeats and outage durations are exact.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import {
  PRESENCE_HEARTBEAT_MS,
  REBOOT_QUIET_MS,
  REFRESH_INTERVAL_MS,
  SCENE_TRIGGERS,
} from '../src/monitor.js';
import { createFakeBox, fixture } from './helpers/fake-box.js';

const BOX_ID = 'ext:test-integration:box:02005e100001';
const ALICE = 'ext:test-integration:host:02005e0000a1';
const MINUTE = 60 * 1000;

async function setup(t, { box: boxOptions, config, wanStatus = 'up' } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-13T08:00:00Z') });
  const box = createFakeBox(boxOptions);
  box.wanStatus = wanStatus;
  const gladys = createFakeGladys({
    config: { host: '192.168.1.1', password: box.password, language: 'en', ...config },
  });
  const { monitor } = registerHandlers(gladys, { createClient: box.createClient });
  await gladys.connect();
  t.after(() => gladys.disconnect());
  const discovered = (externalId) =>
    gladys.fake.discoveredDevices.find((device) => device.external_id === externalId);
  const create = (externalId) => gladys.fake.deviceCreated(discovered(externalId));
  const tick = async (ms = REFRESH_INTERVAL_MS) => {
    t.mock.timers.tick(ms);
    await monitor.refresh();
  };
  return { box, gladys, monitor, create, tick };
}

const statesOf = (gladys, externalId) =>
  gladys.fake.states.filter((s) => s.device_feature_external_id.startsWith(`${externalId}:`));

test('on connection: the box and its connected devices are discovered, nothing published', async (t) => {
  const { gladys } = await setup(t);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['SFR Box', 'phone-alice', 'laptop', '02:00:5e:00:00:c3'],
  );
  assert.equal(gladys.fake.states.length, 0, 'no state for devices not created');
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('the discovery is re-published only when it changes, and on every scan', async (t) => {
  const { gladys, box, tick } = await setup(t);
  const publications = () =>
    gladys.fake.requests.filter((r) => r.path === '/discovered_device').length;
  await tick();
  assert.equal(publications(), 1);
  box.overrides['lan.getHostsList'] = fixture('lan.getHostsList').replace('laptop', 'laptop-2');
  await tick();
  assert.equal(publications(), 2);
  await gladys.fake.scanRequest();
  assert.equal(publications(), 3);
});

test('a created box gets all its states at once, then only the changes', async (t) => {
  const { gladys, box, create, tick } = await setup(t);
  await create(BOX_ID);
  assert.equal(statesOf(gladys, BOX_ID).length, 16);
  await tick();
  assert.equal(statesOf(gladys, BOX_ID).length, 16, 'nothing changed, nothing sent');

  box.overrides['dsl.getInfo'] = fixture('dsl.getInfo').replace(
    'rate_down="5549"',
    'rate_down="6000"',
  );
  await tick();
  const sent = statesOf(gladys, BOX_ID).slice(16);
  assert.deepEqual(sent, [{ device_feature_external_id: `${BOX_ID}:rate-down`, state: 6000 }]);
});

test('a box updated from the Discovery tab gets the states of its new features', async (t) => {
  const { gladys, create } = await setup(t);
  await create(BOX_ID);
  const sent = statesOf(gladys, BOX_ID).length;
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === BOX_ID);
  await gladys.fake.deviceUpdated(device);
  assert.equal(statesOf(gladys, BOX_ID).length, 2 * sent, 'everything re-sent');
});

test('presence: published on arrival, then every 5 minutes while connected', async (t) => {
  const { gladys, box, create, tick } = await setup(t);
  await create(ALICE);
  assert.equal(statesOf(gladys, ALICE).length, 1);
  assert.equal(gladys.fake.lastState(`${ALICE}:presence`), 1);

  await tick();
  assert.equal(statesOf(gladys, ALICE).length, 1, 'no new state within the heartbeat');
  await tick(PRESENCE_HEARTBEAT_MS);
  assert.equal(statesOf(gladys, ALICE).length, 2, 'heartbeat');

  // Gone, then back one minute later: an arrival, published at once.
  box.overrides['lan.getHostsList'] = fixture('lan.getHostsList').replace(
    'status="online" />',
    'status="offline" />',
  );
  await tick();
  assert.equal(statesOf(gladys, ALICE).length, 2, 'nothing published for an absence');
  delete box.overrides['lan.getHostsList'];
  await tick();
  assert.equal(statesOf(gladys, ALICE).length, 3, 'arrival published without waiting');
});

test('a device not created gets no state, even when connected', async (t) => {
  const { gladys, tick } = await setup(t);
  await tick();
  assert.equal(statesOf(gladys, ALICE).length, 0);
});

test('Internet lost then restored fires both triggers, with the outage duration', async (t) => {
  const { gladys, box, tick } = await setup(t);
  box.wanStatus = 'down';
  await tick();
  assert.deepEqual(gladys.fake.sceneEvents, [
    { key: SCENE_TRIGGERS.CONNECTION_LOST, data: { device: BOX_ID } },
  ]);
  await tick();
  assert.equal(gladys.fake.sceneEvents.length, 1, 'one event per transition');
  await tick(2 * MINUTE);
  box.wanStatus = 'up';
  await tick();
  assert.deepEqual(gladys.fake.sceneEvents[1], {
    key: SCENE_TRIGGERS.CONNECTION_RESTORED,
    data: { device: BOX_ID, outage_seconds: 240 },
  });
});

test('a connection down at startup fires no "lost", and "restored" without a duration', async (t) => {
  const { gladys, box, tick } = await setup(t, { wanStatus: 'down' });
  assert.equal(gladys.fake.sceneEvents.length, 0);
  box.wanStatus = 'up';
  await tick();
  assert.deepEqual(gladys.fake.sceneEvents, [
    { key: SCENE_TRIGGERS.CONNECTION_RESTORED, data: { device: BOX_ID, outage_seconds: null } },
  ]);
});

test('a reboot asked through Gladys mutes the triggers, then the box is watched again', async (t) => {
  const { gladys, box, tick } = await setup(t);
  const ack = await gladys.fake.sceneAction('reboot_box', {});
  assert.equal(ack.success, true);
  assert.equal(box.calls('system.reboot').length, 1);

  box.reachable = false;
  await tick();
  box.reachable = true;
  box.wanStatus = 'down';
  await tick();
  box.wanStatus = 'up';
  await tick();
  assert.equal(gladys.fake.sceneEvents.length, 0, 'no trigger during the reboot');

  await tick(REBOOT_QUIET_MS);
  box.wanStatus = 'down';
  await tick();
  assert.equal(gladys.fake.sceneEvents.length, 1, 'watched again after the reboot');
});

test('an unreachable box shows in the Configuration screen and the widget', async (t) => {
  const { gladys, box, tick } = await setup(t);
  box.reachable = false;
  await tick();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /unreachable at 192\.168\.1\.1/);
  const { data } = await gladys.fake.widgetGet('sfr_box', { language: 'fr' });
  assert.equal(data.content.components[0].items[0].value, 'Box injoignable');

  box.reachable = true;
  await tick();
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('a refused password is reported, and retried once the configuration changes', async (t) => {
  const { gladys, box, monitor } = await setup(t, { config: { password: 'wrong-one' } });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.en, /Password refused/);
  await monitor.refresh();
  assert.equal(box.calls('auth.checkToken').length, 1, 'not hammered');

  await gladys.fake.configUpdated({ host: '192.168.1.1', password: box.password });
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  assert.equal(monitor.snapshot.wifi.active, true);
});

test('the connection test reports the box, the devices and the password', async (t) => {
  const { gladys } = await setup(t);
  const ack = await gladys.fake.action('test_connection', {});
  assert.equal(ack.success, true);
  const message = JSON.stringify(ack.data);
  assert.match(message, /NB6VAC-FXC-r0/);
  assert.match(message, /Password accepted/);
  assert.match(message, /Appareils sur le réseau : 3/);
});

test('the reboot action needs the confirmation box', async (t) => {
  const { gladys, box } = await setup(t);
  const refused = await gladys.fake.action('reboot', {});
  assert.match(JSON.stringify(refused.data), /Tick the confirmation box/);
  assert.equal(box.calls('system.reboot').length, 0);

  const done = await gladys.fake.action('reboot', { confirm: true });
  assert.match(JSON.stringify(done.data), /Reboot requested/);
  assert.equal(box.calls('system.reboot').length, 1);
});

test('without password, the reboot is refused with an explanation', async (t) => {
  const { gladys, box } = await setup(t, { config: { password: '' } });
  const action = await gladys.fake.action('reboot', { confirm: true });
  assert.match(JSON.stringify(action.data), /needs the administrator password/);
  const scene = await gladys.fake.sceneAction('reboot_box', {});
  assert.equal(scene.success, false);
  assert.equal(box.calls('system.reboot').length, 0);
});

test('the widget content fits the core vocabulary, in every language', async (t) => {
  const { gladys } = await setup(t);
  for (const language of ['en', 'fr', 'de', 'es', 'it']) {
    for (const settings of [{}, { reboot_button: true }]) {
      const { data } = await gladys.fake.widgetGet('sfr_box', { language, settings });
      assert.deepEqual(validateWidgetContent(data.content), [], `${language}`);
    }
  }
  const { data } = await gladys.fake.widgetGet('sfr_box', { language: 'en' });
  assert.deepEqual(
    data.content.components.filter((c) => c.type === 'value').map((c) => [c.label, c.value]),
    [
      ['Download', 5.5],
      ['Upload', 0.2],
      ['Uptime', '27 d 5 h'],
      ['Temperature', 27.6],
    ],
  );
  assert.ok(!data.content.components.some((c) => c.type === 'button'), 'no button by default');
});

test('the widget reboot button asks for a confirmation and reboots', async (t) => {
  const { gladys, box } = await setup(t);
  const { data } = await gladys.fake.widgetGet('sfr_box', { settings: { reboot_button: true } });
  const button = data.content.components.find((c) => c.type === 'button');
  assert.equal(button.action.confirm, true);
  const ack = await gladys.fake.widgetAction('sfr_box', button.action.key, {});
  assert.equal(ack.success, true);
  assert.equal(box.calls('system.reboot').length, 1);
});

test('the widget is nudged when what it shows changes', async (t) => {
  const { gladys, box, tick } = await setup(t);
  const nudges = () => gladys.fake.widgetRefreshes.length;
  const before = nudges();
  await tick();
  assert.equal(nudges(), before, 'nothing changed');
  box.wanStatus = 'down';
  await tick();
  assert.equal(nudges(), before + 1);
});
