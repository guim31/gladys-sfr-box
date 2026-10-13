// -----------------------------------------------------------------------------
// Client of the local SFR Box API (`http://<box>/api/1.0/?method=ns.method`),
// the historical "neufbox" REST API.
//
// Ported from hacf-fr/sfrbox-api (MIT, © 2022 HACF Home Assistant Communauté
// Francophone), the library behind the Home Assistant "SFR Box" integration:
// same token authentication, same error codes, same firmware workarounds.
//
// Secrets: the password, the token and the hash travel in the query string of
// the box requests. None of them ever appears in an error message or a log
// line: errors name the API method, never the URL.
// -----------------------------------------------------------------------------

import { createHmac, createHash } from 'node:crypto';
import { parseResponse } from './xml.js';

// The box seems to keep a token about 10 minutes: renew it after 5, like
// sfrbox-api does.
export const TOKEN_LIFETIME_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

// API error codes meaning "authentication needed or refused" (sfrbox-api).
const AUTH_ERROR_CODES = new Set(['115', '204', '901']);
// The credentials themselves were refused: retrying would only hammer the box.
const BAD_CREDENTIALS_CODE = '204';

/** The box could not be reached or answered something unreadable. */
export class SfrBoxError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SfrBoxError';
  }
}

/** The box answered `stat="fail"`. */
export class SfrBoxApiError extends SfrBoxError {
  constructor(method, code, msg) {
    super(`${method} failed: [${code}] ${msg}`);
    this.name = 'SfrBoxApiError';
    this.code = code;
  }
}

/**
 * Authentication impossible. `reason`: `no_credentials`, `button_only` (the box
 * only accepts the physical button), `rejected` (wrong login or password) or
 * `needed` (token missing or expired).
 */
export class SfrBoxAuthError extends SfrBoxError {
  constructor(reason, message) {
    super(message);
    this.name = 'SfrBoxAuthError';
    this.reason = reason;
  }
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Hash proving the credentials for a token: HMAC-SHA256(token, SHA256(value))
 * in hex, for the login then the password, concatenated.
 */
export function computeHash(token, username, password) {
  const hmac = (value) => createHmac('sha256', token).update(sha256Hex(value)).digest('hex');
  return `${hmac(username)}${hmac(password)}`;
}

/** Base URL of the API from the configured host (`192.168.1.1`, a name or a full URL). */
export function apiBaseUrl(host) {
  const trimmed = String(host ?? '')
    .trim()
    .replace(/\/+$/, '');
  const base = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return `${base}/api/1.0/`;
}

const findElement = (response, name) =>
  response.elements.find((element) => element.name === name)?.attributes ?? null;

export class SfrBoxClient {
  /**
   * @param {object} options
   * @param {string} options.host box address
   * @param {string} [options.username] login, `admin` on every known firmware
   * @param {string} [options.password] administrator password (optional)
   * @param {typeof fetch} [options.fetch] injectable for the tests
   * @param {() => number} [options.now]
   */
  constructor({ host, username = 'admin', password = '', fetch: fetchImpl, now = Date.now }) {
    this.baseUrl = apiBaseUrl(host);
    this.username = username || 'admin';
    this.password = password || '';
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.now = now;
    this.token = null;
    this.tokenTime = 0;
    // Set once the box refused the credentials: no further attempt until the
    // configuration changes (a new client is built then).
    this.credentialsRejected = false;
  }

  get hasCredentials() {
    return this.password !== '';
  }

  async request(httpMethod, method, params = {}) {
    const url = `${this.baseUrl}?${new URLSearchParams({ method, ...params })}`;
    let response;
    let text;
    try {
      response = await this.fetch(url, {
        method: httpMethod,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      text = await response.text();
    } catch (err) {
      // `err.message` never carries the URL with Node's fetch ("fetch failed",
      // "The operation was aborted due to timeout").
      throw new SfrBoxError(`${method}: box unreachable (${err.cause?.code ?? err.message})`);
    }
    if (!response.ok) {
      throw new SfrBoxError(`${method}: HTTP ${response.status}`);
    }
    const parsed = parseResponse(text);
    if (!parsed) {
      throw new SfrBoxError(`${method}: not an SFR Box API answer`);
    }
    if (parsed.stat === 'fail' && parsed.error) {
      if (AUTH_ERROR_CODES.has(parsed.error.code)) {
        this.token = null;
        if (parsed.error.code === BAD_CREDENTIALS_CODE) {
          this.credentialsRejected = true;
          throw new SfrBoxAuthError('rejected', `${method}: login or password refused`);
        }
        throw new SfrBoxAuthError('needed', `${method}: authentication needed`);
      }
      throw new SfrBoxApiError(method, parsed.error.code, parsed.error.msg);
    }
    if (parsed.stat !== 'ok') {
      throw new SfrBoxError(`${method}: unexpected answer`);
    }
    return parsed;
  }

  async ensureToken() {
    if (!this.hasCredentials) {
      throw new SfrBoxAuthError('no_credentials', 'No administrator password configured');
    }
    if (this.credentialsRejected) {
      throw new SfrBoxAuthError('rejected', 'Login or password refused by the box');
    }
    if (this.token && this.now() - this.tokenTime <= TOKEN_LIFETIME_MS) {
      return this.token;
    }
    const challenge = findElement(await this.request('GET', 'auth.getToken'), 'auth');
    if (!challenge?.token) {
      throw new SfrBoxError('auth.getToken: no token in the answer');
    }
    if (!['passwd', 'all'].includes(challenge.method)) {
      throw new SfrBoxAuthError(
        'button_only',
        `Password authentication is disabled on the box (allowed: ${challenge.method ?? 'unknown'})`,
      );
    }
    const checked = findElement(
      await this.request('GET', 'auth.checkToken', {
        token: challenge.token,
        hash: computeHash(challenge.token, this.username, this.password),
      }),
      'auth',
    );
    if (!checked?.token) {
      throw new SfrBoxError('auth.checkToken: no token in the answer');
    }
    this.token = checked.token;
    this.tokenTime = this.now();
    return this.token;
  }

  async getAuthenticated(method) {
    try {
      return await this.request('GET', method, { token: await this.ensureToken() });
    } catch (err) {
      // A token the box already forgot (rebooted box): one retry with a new one.
      if (err instanceof SfrBoxAuthError && err.reason === 'needed') {
        return this.request('GET', method, { token: await this.ensureToken() });
      }
      throw err;
    }
  }

  /** System information (public). */
  async systemGetInfo() {
    return findElement(await this.request('GET', 'system.getInfo'), 'system');
  }

  /** Internet connection (public). */
  async wanGetInfo() {
    return findElement(await this.request('GET', 'wan.getInfo'), 'wan');
  }

  /** DSL line (public). `null` on a box without DSL information. */
  async dslGetInfo() {
    return findElement(await this.request('GET', 'dsl.getInfo'), 'dsl');
  }

  /** Fibre line (public). `null` when the firmware answers an empty envelope. */
  async ftthGetInfo() {
    return findElement(await this.request('GET', 'ftth.getInfo'), 'ftth');
  }

  /**
   * Wi-Fi (private). Only `active` is kept: the answer also carries the Wi-Fi
   * keys (`wpakey`, `wepkey`), which must never leave this function.
   */
  async wlanGetInfo() {
    const wlan = findElement(await this.getAuthenticated('wlan.getInfo'), 'wlan');
    return wlan ? { active: wlan.active } : null;
  }

  /**
   * Devices known on the LAN. Documented as public, but some firmwares ask
   * for a token: retry authenticated when the box says so and a password is
   * configured.
   */
  async lanGetHostsList() {
    let response;
    try {
      response = await this.request('GET', 'lan.getHostsList');
    } catch (err) {
      if (!(err instanceof SfrBoxAuthError) || !this.hasCredentials) {
        throw err;
      }
      response = await this.getAuthenticated('lan.getHostsList');
    }
    return response.elements
      .filter((element) => element.name === 'host')
      .map((element) => element.attributes);
  }

  /** Reboot the box (private, POST). */
  async systemReboot() {
    const token = await this.ensureToken();
    await this.request('POST', 'system.reboot', { token });
  }
}
