import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiBaseUrl,
  computeHash,
  SfrBoxApiError,
  SfrBoxAuthError,
  SfrBoxClient,
  SfrBoxError,
  TOKEN_LIFETIME_MS,
} from '../src/sfr/client.js';
import { parseResponse } from '../src/sfr/xml.js';
import { createFakeBox, fixture, PASSWORD, TOKEN } from './helpers/fake-box.js';

const client = (box, password = PASSWORD, extra = {}) =>
  new SfrBoxClient({ host: '192.168.1.1', password, fetch: box.fetch, ...extra });

test('the XML reader keeps the attributes, decodes entities and skips comments', () => {
  const parsed = parseResponse(
    '<?xml version="1.0"?><!-- <fake a="1"/> --><rsp stat="ok"><host name="Tom &amp; Jerry&#39;s" mac=\'02:00:00:00:00:01\'/></rsp>',
  );
  assert.equal(parsed.stat, 'ok');
  assert.deepEqual(parsed.elements, [
    { name: 'host', attributes: { name: "Tom & Jerry's", mac: '02:00:00:00:00:01' } },
  ]);
  assert.equal(parseResponse('<html><body>Login</body></html>'), null);
  assert.equal(parseResponse(''), null);
});

test('the XML reader repairs the dsl.getInfo answer of firmware 3DCM020200r015', () => {
  const dsl = parseResponse(fixture('dsl.getInfo.3dcm')).elements.find((e) => e.name === 'dsl');
  assert.equal(dsl.attributes.rate_down, '8000');
  assert.equal(dsl.attributes.noise_up, '4.2');
});

test('the XML reader reads the error of a failed call', () => {
  assert.deepEqual(parseResponse(fixture('fail.115')).error, {
    code: '115',
    msg: 'Authentication needed',
  });
});

test('computeHash matches the test vector of hacf-fr/sfrbox-api', () => {
  // tests/test_bridge.py::test_authenticate (MIT): token, "admin", "password".
  assert.equal(
    computeHash('afd1baa4cb261bfc08ec2dc0ade3b4', 'admin', 'password'),
    '3e89f9170f9e64e5132aa6f72a520ffd45f952f259872a60e9acde5dba45ff64' +
      '88cc72099f52b8414e5b182b8e1c2b4b87863bd67b0134904adfe00ae6c6499e',
  );
});

test('the API URL accepts an address, a name or a full URL', () => {
  assert.equal(apiBaseUrl('192.168.1.1'), 'http://192.168.1.1/api/1.0/');
  assert.equal(apiBaseUrl(' sfrbox.home '), 'http://sfrbox.home/api/1.0/');
  assert.equal(apiBaseUrl('https://box.example.com/sfr/'), 'https://box.example.com/sfr/api/1.0/');
});

test('the public methods need no token', async () => {
  const box = createFakeBox();
  const sfr = client(box, '');
  const system = await sfr.systemGetInfo();
  assert.equal(system.product_id, 'NB6VAC-FXC-r0');
  assert.equal((await sfr.wanGetInfo()).status, 'up');
  assert.equal((await sfr.dslGetInfo()).linemode, 'ADSL2+');
  assert.equal(box.calls('auth.getToken').length, 0);
});

test('an empty ftth.getInfo answer reads as null', async () => {
  const box = createFakeBox({ overrides: { 'ftth.getInfo': fixture('ftth.getInfo.empty') } });
  assert.equal(await client(box).ftthGetInfo(), null);
});

test('the token is obtained once, then renewed after 5 minutes', async () => {
  let now = 1_000_000;
  const box = createFakeBox();
  const sfr = client(box, PASSWORD, { now: () => now });
  assert.deepEqual(await sfr.wlanGetInfo(), { active: 'on' });
  await sfr.wlanGetInfo();
  assert.equal(box.calls('auth.getToken').length, 1);
  now += TOKEN_LIFETIME_MS + 1;
  await sfr.wlanGetInfo();
  assert.equal(box.calls('auth.getToken').length, 2);
});

test('wlanGetInfo never returns the Wi-Fi keys', async () => {
  const wlan = await client(createFakeBox()).wlanGetInfo();
  assert.deepEqual(Object.keys(wlan), ['active']);
});

test('a refused password is not tried again by the same client', async () => {
  const box = createFakeBox({ password: 'another-one' });
  const sfr = client(box);
  await assert.rejects(sfr.wlanGetInfo(), (err) => err.reason === 'rejected');
  await assert.rejects(sfr.wlanGetInfo(), (err) => err.reason === 'rejected');
  assert.equal(box.calls('auth.checkToken').length, 1, 'no second attempt');
});

test('a box that only allows the button is reported as such', async () => {
  const box = createFakeBox({ authMethod: 'button' });
  await assert.rejects(client(box).systemReboot(), (err) => err.reason === 'button_only');
  assert.equal(box.calls('auth.checkToken').length, 0);
});

test('without a password, a private method fails without calling the box', async () => {
  const box = createFakeBox();
  await assert.rejects(client(box, '').systemReboot(), (err) => err.reason === 'no_credentials');
  assert.equal(box.requests.length, 0);
});

test('a token the box forgot is renewed once', async () => {
  const box = createFakeBox();
  const sfr = client(box);
  sfr.token = 'stale';
  sfr.tokenTime = Date.now();
  assert.deepEqual(await sfr.wlanGetInfo(), { active: 'on' });
  assert.equal(box.calls('wlan.getInfo').length, 2);
});

test('the reboot is a POST carrying the token', async () => {
  const box = createFakeBox();
  await client(box).systemReboot();
  const [reboot] = box.calls('system.reboot');
  assert.equal(reboot.httpMethod, 'POST');
  assert.equal(new URL(reboot.url).searchParams.get('token'), TOKEN);
});

test('the host list is read publicly, or with a token when the box asks for one', async () => {
  const open = createFakeBox();
  assert.equal((await client(open, '').lanGetHostsList()).length, 4);

  const locked = createFakeBox({ hostsPrivate: true });
  assert.equal((await client(locked).lanGetHostsList()).length, 4);
  await assert.rejects(client(locked, '').lanGetHostsList(), SfrBoxAuthError);
});

test('errors name the method, never the password, token or hash', async () => {
  const box = createFakeBox({ overrides: { 'system.reboot': fixture('fail.115') } });
  const sfr = client(box);
  const err = await sfr.systemReboot().catch((e) => e);
  assert.ok(err instanceof SfrBoxAuthError);
  const hash = computeHash(TOKEN, 'admin', PASSWORD);
  for (const secret of [PASSWORD, TOKEN, hash]) {
    assert.ok(!err.message.includes(secret), `"${err.message}" leaks a secret`);
  }

  box.reachable = false;
  const unreachable = await sfr.systemGetInfo().catch((e) => e);
  assert.ok(unreachable instanceof SfrBoxError);
  assert.match(unreachable.message, /system\.getInfo: box unreachable/);
});

test('an unknown API error and a non-API answer are reported', async () => {
  const box = createFakeBox({
    overrides: {
      'wan.getInfo': '<rsp stat="fail"><err code="0" msg="Unknown error"/></rsp>',
      'dsl.getInfo': '<html>Login page</html>',
      'ftth.getInfo': null,
    },
  });
  const sfr = client(box);
  await assert.rejects(sfr.wanGetInfo(), SfrBoxApiError);
  await assert.rejects(sfr.dslGetInfo(), /not an SFR Box API answer/);
  await assert.rejects(sfr.ftthGetInfo(), /HTTP 404/);
});
