import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BboxError, RATE_LIMIT_BACKOFF_MS, createBboxClient } from '../src/bbox/client.js';
import { PASSWORD, createFakeBbox } from './helpers/fakeBbox.js';

function clientFor(fake, options = {}) {
  return createBboxClient({ transport: fake.transport, password: PASSWORD, ...options });
}

test('logs in once, then reads with the session cookie', async () => {
  const fake = createFakeBbox();
  const client = clientFor(fake);
  const device = await client.get('device');
  assert.equal(device[0].device.modelname, 'F@st5688b');
  await client.get('wan/ip');
  assert.equal(fake.logins, 1);
  const login = fake.requests[0];
  assert.equal(login.method, 'POST');
  assert.equal(login.path, '/api/v1/login');
  assert.equal(new URLSearchParams(login.body).get('remember'), '1');
  assert.match(fake.requests[1].headers.Cookie, /^BBOX_ID=session-1$/);
});

test('logs in again once when the session expired', async () => {
  const fake = createFakeBbox();
  const client = clientFor(fake);
  await client.get('device');
  fake.expireSessions();
  await client.get('device');
  assert.equal(fake.logins, 2);
});

test('a refused password is never retried until the configuration changes', async () => {
  const fake = createFakeBbox('ftth', { password: 'another-one' });
  const client = clientFor(fake);
  await assert.rejects(client.get('device'), { kind: 'wrong_password' });
  await assert.rejects(client.get('device'), { kind: 'wrong_password' });
  // Each new attempt would extend the lock of the Bbox.
  assert.equal(fake.logins, 1);
});

test('a login lock (HTTP 429) waits 15 minutes before a new attempt', async () => {
  const fake = createFakeBbox();
  fake.loginStatus = 429;
  let clock = 1_000_000;
  const client = clientFor(fake, { now: () => clock });
  await assert.rejects(client.get('device'), { kind: 'rate_limited' });
  clock += RATE_LIMIT_BACKOFF_MS - 1;
  await assert.rejects(client.get('device'), { kind: 'rate_limited' });
  assert.equal(fake.logins, 1);
  fake.loginStatus = null;
  clock += 2;
  await client.get('device');
  assert.equal(fake.logins, 2);
});

test('no password configured: no login attempt at all', async () => {
  const fake = createFakeBbox();
  const client = createBboxClient({ transport: fake.transport, password: '' });
  await assert.rejects(client.get('device'), { kind: 'missing_password' });
  assert.equal(fake.requests.length, 0);
});

test('a write carries the device token and a form body', async () => {
  const fake = createFakeBbox();
  const client = clientFor(fake);
  await client.write('PUT', 'wireless/24', { 'radio.enable': 0 });
  assert.deepEqual(fake.writes, [
    { method: 'PUT', route: 'wireless/24', form: { 'radio.enable': '0' } },
  ]);
  const put = fake.requests.find((request) => request.method === 'PUT');
  assert.match(put.path, /^\/api\/v1\/wireless\/24\?btoken=/);
  assert.match(put.headers['Content-Type'], /^application\/x-www-form-urlencoded/);
  // The token is cached until it nears its expiry.
  await client.write('PUT', 'wireless/5', { 'radio.enable': 1 });
  assert.equal(
    fake.requests.filter((request) => request.path === '/api/v1/device/token').length,
    1,
  );
});

test('an HTTP error names the route and the status, never the token', async () => {
  const fake = createFakeBbox();
  fake.routeStatus['device/reboot'] = 500;
  const client = clientFor(fake);
  const err = await client.write('POST', 'device/reboot').catch((e) => e);
  assert.ok(err instanceof BboxError);
  assert.equal(err.kind, 'api_error');
  assert.equal(err.message, 'POST /api/v1/device/reboot: HTTP 500');
});

test('certificate and network failures are told apart', async () => {
  const fake = createFakeBbox();
  const client = clientFor(fake);
  fake.networkError = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
  await assert.rejects(client.get('device'), { kind: 'tls' });
  fake.networkError = 'ERR_TLS_CERT_ALTNAME_INVALID';
  await assert.rejects(client.get('device'), { kind: 'tls' });
  fake.networkError = 'EHOSTUNREACH';
  await assert.rejects(client.get('device'), { kind: 'unreachable' });
});
