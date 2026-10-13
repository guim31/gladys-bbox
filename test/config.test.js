import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';
import { createCapabilityStore } from '../src/capabilities.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('the refresh interval stays between one minute and one hour', () => {
  assert.equal(normalizeConfig({ refresh_interval: '120' }).refresh_interval, 120);
  assert.equal(normalizeConfig({ refresh_interval: 10 }).refresh_interval, 60);
  assert.equal(normalizeConfig({ refresh_interval: 99999 }).refresh_interval, 3600);
  assert.equal(normalizeConfig({ refresh_interval: 'abc' }).refresh_interval, 60);
});

test('the address accepts what users paste', () => {
  assert.equal(normalizeConfig({ host: ' https://MaBbox.Bytel.fr/ ' }).host, 'mabbox.bytel.fr');
  assert.equal(normalizeConfig({ host: '192.168.1.254:443' }).host, '192.168.1.254');
  assert.equal(normalizeConfig({ host: '' }).host, '192.168.1.254');
});

test('only an explicit choice turns the certificate check off', () => {
  assert.equal(normalizeConfig({}).tls_verify, 'verify');
  assert.equal(normalizeConfig({ tls_verify: 'whatever' }).tls_verify, 'verify');
  assert.equal(normalizeConfig({ tls_verify: 'insecure' }).tls_verify, 'insecure');
});

test('an unknown language falls back to French', () => {
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
  assert.equal(normalizeConfig({ language: 'es' }).language, 'es');
});

test('host tracking is on unless explicitly turned off', () => {
  assert.equal(normalizeConfig({}).track_hosts, true);
  assert.equal(normalizeConfig({ track_hosts: false }).track_hosts, false);
});

test('a capability seen once is kept, across restarts too', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'gladys-bbox-'));
  const store = createCapabilityStore(dataDir);
  await store.load();
  const seen = { temperature: 40, wifiGuest: true, missedCalls: null };
  assert.equal(await store.merge(seen), true);
  // An optional route that failed once does not remove the feature.
  assert.equal(await store.merge({ temperature: null, wifiGuest: null, missedCalls: null }), false);
  const restarted = createCapabilityStore(dataDir);
  assert.deepEqual(await restarted.load(), { temperature: true, wifiGuest: true, voip: false });
  const saved = JSON.parse(await readFile(path.join(dataDir, 'capabilities.json'), 'utf8'));
  assert.deepEqual(Object.keys(saved).sort(), ['temperature', 'voip', 'wifiGuest']);
});
