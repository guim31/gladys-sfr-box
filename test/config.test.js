import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('an empty configuration gets the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig({ host: '  ', username: '' }), DEFAULT_CONFIG);
});

test('the values are normalized', () => {
  const config = normalizeConfig({
    host: ' 192.168.1.254 ',
    password: ' spaced ',
    discover_hosts: 'false',
    language: 'es-ES',
  });
  assert.equal(config.host, '192.168.1.254');
  assert.equal(config.password, ' spaced ', 'a password is never trimmed');
  assert.equal(config.discover_hosts, false);
  assert.equal(config.language, 'es');
  assert.equal(normalizeConfig({ language: 'it' }).language, 'en');
});
