// An in-memory Bbox: a transport (src/bbox/transport.js) answering from the
// recorded answers of test/fixtures/bbox/, with the session and token rules of
// the real API. No network.

import { readFileSync } from 'node:fs';

export const PASSWORD = 'correct-horse-battery';

export function loadFixture(name) {
  const raw = JSON.parse(
    readFileSync(new URL(`../fixtures/bbox/${name}.json`, import.meta.url), 'utf8'),
  );
  delete raw.$comment;
  return raw;
}

export function createFakeBbox(fixture = 'ftth', { password = PASSWORD } = {}) {
  const routes = structuredClone(loadFixture(fixture));
  const token = routes['device/token']?.[0]?.device?.token;
  const sessions = new Set();
  const fake = {
    routes,
    requests: [],
    writes: [],
    logins: 0,
    // Set to make the next requests fail: { code } (network) or a status.
    networkError: null,
    loginStatus: null,
    routeStatus: {},

    async transport({ method, path, headers = {}, body }) {
      fake.requests.push({ method, path, headers, body });
      if (fake.networkError) {
        throw Object.assign(new Error(fake.networkError), { code: fake.networkError });
      }
      const [pathname, query = ''] = path.split('?');
      const route = pathname.replace(/^\/api\/v1\//, '');

      if (method === 'POST' && route === 'login') {
        fake.logins += 1;
        if (fake.loginStatus) {
          return { status: fake.loginStatus, headers: {}, body: '' };
        }
        if (new URLSearchParams(body).get('password') !== password) {
          return { status: 401, headers: {}, body: '{"exception":{"code":"401"}}' };
        }
        const session = `session-${fake.logins}`;
        sessions.add(session);
        return {
          status: 200,
          headers: { 'set-cookie': [`BBOX_ID=${session}; Path=/; Secure; HttpOnly`] },
          body: '',
        };
      }

      const session = /BBOX_ID=([^;]+)/.exec(headers.Cookie ?? '')?.[1];
      if (!sessions.has(session)) {
        return { status: 401, headers: {}, body: '' };
      }
      if (fake.routeStatus[route]) {
        return { status: fake.routeStatus[route], headers: {}, body: '' };
      }
      if (method === 'GET') {
        if (!(route in routes)) {
          return { status: 404, headers: {}, body: '' };
        }
        return { status: 200, headers: {}, body: JSON.stringify(routes[route]) };
      }
      if (new URLSearchParams(query).get('btoken') !== token) {
        return { status: 401, headers: {}, body: '' };
      }
      fake.writes.push({ method, route, form: Object.fromEntries(new URLSearchParams(body)) });
      return { status: 200, headers: {}, body: '' };
    },

    /** Forget every session, as the box does after a restart. */
    expireSessions() {
      sessions.clear();
    },
  };
  return fake;
}
