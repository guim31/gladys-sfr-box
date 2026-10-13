// The integration refreshes itself: the devices are published with
// should_poll: false, and the monitor's own timer reads the box every minute.
// Nothing here calls onPoll nor refresh(): only the clock moves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOX_HEARTBEAT_MS, PRESENCE_HEARTBEAT_MS, REFRESH_INTERVAL_MS } from '../src/monitor.js';
import { ALICE, BOX_ID, startSession } from './helpers/session.js';

const HOUR = 60 * 60 * 1000;
const statesOf = (gladys, externalId) =>
  gladys.fake.states.filter((s) => s.device_feature_external_id.startsWith(`${externalId}:`));

test('no device asks the core scheduler to poll it', async (t) => {
  const { gladys } = await startSession(t);
  for (const device of gladys.fake.discoveredDevices) {
    assert.equal(device.should_poll, false, device.name);
  }
});

test('the timer reads the box every minute and publishes the changes, without onPoll', async (t) => {
  const { box, gladys, create, minute } = await startSession(t);
  await create(BOX_ID);
  const readings = () => box.requests.filter((r) => r.method === 'wan.getInfo').length;
  const before = readings();
  for (let i = 1; i <= 3; i += 1) {
    await minute();
    assert.equal(readings(), before + i, `reading ${i}`);
  }
  box.wanStatus = 'down';
  await minute();
  assert.ok(
    statesOf(gladys, BOX_ID).some(
      (s) => s.device_feature_external_id.endsWith(':wan') && s.state === 0,
    ),
    'the dropped connection reaches Gladys through the timer alone',
  );
  assert.ok(!gladys.fake.requests.some((r) => r.path.includes('poll')), 'Gladys never had to poll');
});

test('an unchanged value is re-published well within 12 hours', async (t) => {
  assert.ok(BOX_HEARTBEAT_MS <= 12 * HOUR);
  assert.ok(PRESENCE_HEARTBEAT_MS <= 12 * HOUR);
  const { gladys, create, minute } = await startSession(t);
  await create(BOX_ID);
  await create(ALICE);
  const wan = () =>
    statesOf(gladys, BOX_ID).filter((s) => s.device_feature_external_id.endsWith(':wan')).length;
  const presence = () => statesOf(gladys, ALICE).length;
  const [wanBefore, presenceBefore] = [wan(), presence()];
  for (let elapsed = 0; elapsed < 12 * HOUR; elapsed += REFRESH_INTERVAL_MS) {
    await minute();
  }
  // Nothing changed for 12 hours: only the heartbeats sent these values again.
  assert.ok(wan() - wanBefore >= (12 * HOUR) / BOX_HEARTBEAT_MS - 1, `Internet: ${wan()}`);
  assert.ok(presence() - presenceBefore >= (12 * HOUR) / PRESENCE_HEARTBEAT_MS - 1);
});

test('the fallback onPoll reads the box too', async (t) => {
  const { box, gladys } = await startSession(t);
  const before = box.requests.length;
  const device = gladys.fake.discoveredDevices[0];
  assert.deepEqual(await gladys.fake.poll(device), { success: true });
  assert.ok(box.requests.length > before);
});
