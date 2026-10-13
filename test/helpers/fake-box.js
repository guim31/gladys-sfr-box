// A fake SFR Box behind an injectable `fetch`: it serves the fixtures of
// test/fixtures/sfr, checks the token authentication like the box, and records
// every request. No network involved.

import { readFileSync } from 'node:fs';
import { computeHash, SfrBoxClient } from '../../src/sfr/client.js';

export const fixture = (name) =>
  readFileSync(new URL(`../fixtures/sfr/${name}.xml`, import.meta.url), 'utf8');

export const TOKEN = 'afd1baa4cb261bfc08ec2dc0ade3b4';
// Fake credentials, only ever used against this fake box.
export const PASSWORD = 'Fake-Admin-Password-42';

const PRIVATE = new Set(['wlan.getInfo', 'system.reboot', 'wlan.getClientList']);

/**
 * @param {object} [options]
 * @param {string} [options.system] fixture of system.getInfo
 * @param {string} [options.password] the box's admin password
 * @param {string} [options.authMethod] `all`, `passwd` or `button`
 * @param {boolean} [options.hostsPrivate] lan.getHostsList asks for a token
 * @param {Record<string, string | null>} [options.overrides] method → raw XML (null: HTTP 404)
 */
export function createFakeBox(options = {}) {
  const box = {
    system: options.system ?? 'system.getInfo.nb6vac',
    password: options.password ?? PASSWORD,
    authMethod: options.authMethod ?? 'all',
    hostsPrivate: options.hostsPrivate ?? false,
    overrides: { ...options.overrides },
    reachable: true,
    wanStatus: 'up',
    requests: [],
  };

  const answers = () => ({
    'system.getInfo': fixture(box.system),
    'wan.getInfo': fixture('wan.getInfo').replace('status="up"', `status="${box.wanStatus}"`),
    'dsl.getInfo': fixture('dsl.getInfo'),
    'ftth.getInfo': fixture('ftth.getInfo'),
    'auth.getToken': fixture('auth.getToken').replace('"all"', `"${box.authMethod}"`),
    'wlan.getInfo': fixture('wlan.getInfo'),
    'lan.getHostsList': fixture('lan.getHostsList'),
    'system.reboot': fixture('ok'),
    ...box.overrides,
  });

  box.fetch = async (url, init = {}) => {
    const { searchParams } = new URL(url);
    const method = searchParams.get('method');
    box.requests.push({ url, method, httpMethod: init.method ?? 'GET' });
    if (!box.reachable) {
      throw new TypeError('fetch failed', { cause: { code: 'EHOSTUNREACH' } });
    }
    const respond = (body, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    });
    if (method === 'auth.checkToken') {
      const expected = computeHash(TOKEN, 'admin', box.password);
      return searchParams.get('token') === TOKEN && searchParams.get('hash') === expected
        ? respond(fixture('auth.checkToken'))
        : respond(fixture('fail.204'));
    }
    const needsToken = PRIVATE.has(method) || (method === 'lan.getHostsList' && box.hostsPrivate);
    if (needsToken && searchParams.get('token') !== TOKEN) {
      return respond(fixture('fail.115'));
    }
    const body = answers()[method];
    if (body === null || body === undefined) {
      return respond('Not found', 404);
    }
    return respond(body);
  };

  box.createClient = (config) =>
    new SfrBoxClient({
      host: config.host,
      username: config.username,
      password: config.password,
      fetch: box.fetch,
    });

  box.calls = (method) => box.requests.filter((request) => request.method === method);
  return box;
}
