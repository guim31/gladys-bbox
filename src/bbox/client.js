// -----------------------------------------------------------------------------
// Client of the Bbox local API ("API Bbox", /api/v1).
//
// - Reads: GET /api/v1/<route>, with the BBOX_ID session cookie. A few routes
//   answer without a session on the LAN, most need it: the client always logs
//   in, with the administrator password.
// - Writes: PUT/POST /api/v1/<route>?btoken=<token>, form-encoded, the token
//   coming from GET /api/v1/device/token (short-lived, cached until it nears
//   expiry).
// - Login: POST /api/v1/login with `password` and `remember=1`. The Bbox locks
//   the login after a few failures (HTTP 429), and every new attempt extends
//   the lock: a refused password is never retried until the configuration
//   changes, and a 429 waits 15 minutes.
//
// Never log the password, the cookie or the token: error messages carry the
// route without its query string, and the status code.
// -----------------------------------------------------------------------------

import { BBOX_HOSTNAME } from '../config.js';

export const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;
const TOKEN_MARGIN_MS = 30 * 1000;
const TOKEN_FALLBACK_TTL_MS = 5 * 60 * 1000;

// Node's codes for a certificate it could not validate.
const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_UNTRUSTED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export class BboxError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.name = 'BboxError';
    // 'missing_password' | 'wrong_password' | 'rate_limited' | 'tls' |
    // 'unreachable' | 'api_error': the key of the status message (src/i18n.js).
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @param {{ transport: Function, password: string, now?: () => number }} options
 */
export function createBboxClient({ transport, password, now = Date.now }) {
  let cookie = null;
  let token = null;
  let loginPromise = null;
  // A refused password stays refused until the configuration changes (a new
  // client); a 429 is retried once the lock had time to expire.
  let passwordRefused = false;
  let lockedUntil = 0;

  async function send(method, path, { body, auth = true } = {}) {
    const headers = {
      Accept: 'application/json',
      // The web interface sends these; some firmwares refuse writes without.
      'X-Requested-With': 'XMLHttpRequest',
      Origin: `https://${BBOX_HOSTNAME}`,
      Referer: `https://${BBOX_HOSTNAME}/`,
    };
    if (auth && cookie) {
      headers.Cookie = `BBOX_ID=${cookie}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    try {
      return await transport({ method, path, headers, body });
    } catch (err) {
      throw toNetworkError(err, path);
    }
  }

  async function login() {
    if (!password) {
      throw new BboxError('missing_password', 'No administrator password configured');
    }
    if (passwordRefused) {
      throw new BboxError('wrong_password', 'The Bbox refused the password', 401);
    }
    if (now() < lockedUntil) {
      throw new BboxError('rate_limited', 'Bbox login locked, waiting before a new attempt', 429);
    }
    const body = new URLSearchParams({ password, remember: '1' }).toString();
    const response = await send('POST', '/api/v1/login', { body, auth: false });
    if (response.status === 429) {
      lockedUntil = now() + RATE_LIMIT_BACKOFF_MS;
      throw new BboxError('rate_limited', 'Bbox login locked (HTTP 429)', 429);
    }
    if (response.status === 401 || response.status === 403) {
      passwordRefused = true;
      throw new BboxError(
        'wrong_password',
        `The Bbox refused the password (HTTP ${response.status})`,
        response.status,
      );
    }
    if (response.status < 200 || response.status >= 300) {
      throw new BboxError(
        'api_error',
        `POST /api/v1/login: HTTP ${response.status}`,
        response.status,
      );
    }
    const value = readCookie(response.headers, 'BBOX_ID');
    if (!value) {
      throw new BboxError('api_error', 'POST /api/v1/login: no session cookie in the answer');
    }
    cookie = value;
    token = null;
  }

  // One login at a time: the reading cycle and an action may both need one.
  async function ensureSession() {
    if (cookie) {
      return;
    }
    loginPromise ??= login().finally(() => {
      loginPromise = null;
    });
    await loginPromise;
  }

  // Send a request, logging in first, and once more if the session expired.
  async function authenticated(method, buildPath, body) {
    await ensureSession();
    let response = await send(method, await buildPath(), { body });
    if (response.status === 401) {
      cookie = null;
      token = null;
      await ensureSession();
      response = await send(method, await buildPath(), { body });
    }
    return response;
  }

  async function get(route) {
    const path = `/api/v1/${route}`;
    const response = await authenticated('GET', () => path);
    if (response.status !== 200) {
      throw new BboxError('api_error', `GET ${path}: HTTP ${response.status}`, response.status);
    }
    try {
      return response.body ? JSON.parse(response.body) : null;
    } catch {
      throw new BboxError('api_error', `GET ${path}: the answer is not JSON`);
    }
  }

  async function getToken() {
    if (token && now() < token.expiresAt - TOKEN_MARGIN_MS) {
      return token.value;
    }
    const answer = await get('device/token');
    const device = first(answer)?.device ?? {};
    if (typeof device.token !== 'string' || device.token === '') {
      throw new BboxError('api_error', 'GET /api/v1/device/token: no token in the answer');
    }
    const expiresAt = Date.parse(device.expires);
    token = {
      value: device.token,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : now() + TOKEN_FALLBACK_TTL_MS,
    };
    return token.value;
  }

  async function write(method, route, form = {}) {
    const path = `/api/v1/${route}`;
    const body = new URLSearchParams(
      Object.entries(form).map(([key, value]) => [key, String(value)]),
    ).toString();
    const response = await authenticated(
      method,
      async () => `${path}?btoken=${encodeURIComponent(await getToken())}`,
      body,
    );
    if (response.status < 200 || response.status >= 300) {
      throw new BboxError(
        'api_error',
        `${method} ${path}: HTTP ${response.status}`,
        response.status,
      );
    }
  }

  return { get, write };
}

/** The Bbox wraps nearly every answer in a one-element array. */
export function first(answer) {
  if (Array.isArray(answer)) {
    return answer[0] ?? {};
  }
  return answer ?? {};
}

function readCookie(headers, name) {
  const raw = headers?.['set-cookie'];
  const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const line of lines) {
    const match = line.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function toNetworkError(err, path) {
  const route = path.split('?')[0];
  if (TLS_ERROR_CODES.has(err.code)) {
    return new BboxError('tls', `${route}: certificate not verified (${err.code})`);
  }
  return new BboxError('unreachable', `${route}: ${err.code ?? 'network error'}`);
}
