// Quiet logs: a normal reading writes nothing at the info level, a failure
// that repeats writes one line when it starts and one when it ends, and no
// secret of the configuration ever reaches the logs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALICE, BOX_ID, startSession, captureLogs } from './helpers/session.js';
import { fixture, PASSWORD } from './helpers/fake-box.js';

test('a normal reading cycle writes nothing at the info level, and no secret', async (t) => {
  const { lines, at } = captureLogs(t, 'debug');
  const { create, minute } = await startSession(t, { box: { hostsPrivate: true } });
  await create(BOX_ID);
  await create(ALICE);
  const userActions = at('info').length; // one line per device added
  assert.equal(userActions, 2);
  for (let i = 0; i < 40; i += 1) {
    await minute();
  }
  assert.deepEqual(at('info').slice(userActions), [], 'info lines during normal readings');
  assert.deepEqual([...at('warn'), ...at('error')], []);
  assert.ok(
    at('debug').some((line) => line.includes('Reading:')),
    'readings show in debug',
  );
  for (const line of lines) {
    assert.ok(!line.includes(PASSWORD), `the password leaks: ${line}`);
  }
});

test('at the default level, normal readings write nothing at all', async (t) => {
  const { lines } = captureLogs(t);
  const { minute } = await startSession(t);
  for (let i = 0; i < 10; i += 1) {
    await minute();
  }
  assert.deepEqual(lines, []);
});

test('an unreachable box: one warning, then one line on recovery', async (t) => {
  const { at } = captureLogs(t);
  const { box, minute } = await startSession(t);
  box.reachable = false;
  for (let i = 0; i < 5; i += 1) {
    await minute();
  }
  box.reachable = true;
  await minute();
  await minute();
  assert.equal(at('warn').length, 1);
  assert.match(at('warn')[0], /SFR Box unreachable/);
  assert.equal(at('info').length, 1);
  assert.match(at('info')[0], /reachable again/);
});

test('Gladys refusing the states: one warning, then one line on recovery', async (t) => {
  const { at } = captureLogs(t);
  const { box, gladys, create, minute } = await startSession(t);
  await create(BOX_ID);
  const infoBefore = at('info').length;
  const publish = t.mock.method(gladys, 'publishChangedStates', async () => {
    throw new Error('HTTP 503');
  });
  for (let i = 0; i < 5; i += 1) {
    box.wanStatus = i % 2 ? 'up' : 'down'; // something to publish every minute
    await minute();
  }
  assert.equal(at('warn').length, 1);
  assert.match(at('warn')[0], /Publishing states failed: HTTP 503/);
  publish.mock.restore();
  await minute();
  await minute();
  assert.equal(at('warn').length, 1);
  assert.ok(
    at('info')
      .slice(infoBefore)
      .some((line) => /Publishing states works again/.test(line)),
  );
});

test('a failing reading cycle: one error, then one line on recovery', async (t) => {
  const { at } = captureLogs(t);
  const { box, gladys, minute } = await startSession(t);
  const discovery = t.mock.method(gladys, 'publishDiscoveredDevices', async () => {
    throw new Error('HTTP 500');
  });
  // A renamed device: the discovery is published again, and fails every minute.
  box.overrides['lan.getHostsList'] = fixture('lan.getHostsList').replace('laptop', 'laptop-2');
  for (let i = 0; i < 5; i += 1) {
    await minute();
  }
  discovery.mock.restore();
  await minute();
  await minute();
  assert.equal(at('error').length, 1, at('error').join('\n'));
  assert.equal(at('info').filter((line) => /Reading works again/.test(line)).length, 1);
});
