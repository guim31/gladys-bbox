// -----------------------------------------------------------------------------
// Conformity of the published devices with what the Gladys core accepts and
// renders, against test/fixtures/gladys-feature-table.json (extracted from the
// core: categories, types, units, poll frequencies, and the category/type
// couples the front can label and draw).
//
// Every device the integration can publish is checked: the Bbox with all its
// optional features, and a host presence device.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildBoxDevice, buildHostDevice } from '../src/devices.js';
import { LANGUAGES } from '../src/i18n.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const gladys = createFakeGladys();
const snapshot = { serial: 'TESTSERIAL0001', model: 'F@st5688b' };
const allCapabilities = { temperature: true, wifiGuest: true, voip: true };
const host = { mac: '02:00:00:00:10:01', name: 'phone', ip: '192.0.2.10', active: true };

const devices = LANGUAGES.flatMap((language) => [
  buildBoxDevice(gladys, { snapshot, capabilities: allCapabilities, language }),
  buildHostDevice(gladys, host, language),
]);
const features = devices.flatMap((device) => device.features);

test('every category/type couple is one the Gladys front can render', () => {
  for (const feature of features) {
    const pair = `${feature.category}/${feature.type}`;
    assert.ok(table.pairs[pair], `${feature.external_id}: unknown couple ${pair}`);
  }
});

test('categories and types are known to the core', () => {
  for (const feature of features) {
    assert.ok(table.categories.includes(feature.category), feature.category);
    assert.ok(table.types.includes(feature.type), feature.type);
  }
});

test('should_poll and poll_frequency: in milliseconds, from the core list', () => {
  for (const device of devices) {
    assert.equal(typeof device.should_poll, 'boolean', `${device.external_id}: should_poll`);
    if (device.should_poll) {
      assert.ok(
        table.poll_frequencies_ms.includes(device.poll_frequency),
        `${device.external_id}: poll_frequency ${device.poll_frequency}`,
      );
    } else if (device.poll_frequency !== undefined) {
      assert.ok(table.poll_frequencies_ms.includes(device.poll_frequency));
    }
  }
});

test('min and max are numbers on every feature (NOT NULL in the core)', () => {
  for (const feature of features) {
    assert.equal(typeof feature.min, 'number', `${feature.external_id}: min`);
    assert.equal(typeof feature.max, 'number', `${feature.external_id}: max`);
    assert.ok(Number.isFinite(feature.min) && Number.isFinite(feature.max));
    assert.ok(feature.min <= feature.max, `${feature.external_id}: min > max`);
  }
});

test('read_only and has_feedback are booleans', () => {
  for (const feature of features) {
    assert.equal(typeof feature.read_only, 'boolean', `${feature.external_id}: read_only`);
    assert.equal(typeof feature.has_feedback, 'boolean', `${feature.external_id}: has_feedback`);
  }
});

test('units are known, and allowed for their category', () => {
  for (const feature of features.filter((f) => f.unit !== undefined)) {
    assert.ok(table.units.includes(feature.unit), `${feature.external_id}: unit ${feature.unit}`);
    const allowed = table.units_by_category[feature.category];
    if (allowed) {
      assert.ok(allowed.includes(feature.unit), `${feature.external_id}: ${feature.unit}`);
    }
  }
});

test('external ids are unique, devices and features together', () => {
  // One language: the other languages publish the same ids by design.
  const oneLanguage = [
    buildBoxDevice(gladys, { snapshot, capabilities: allCapabilities, language: 'fr' }),
    buildHostDevice(gladys, host, 'fr'),
  ];
  const ids = oneLanguage.flatMap((device) => [
    device.external_id,
    ...device.features.map((feature) => feature.external_id),
  ]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate external_id');
});

test('external ids do not depend on the language', () => {
  const idsOf = (language) =>
    buildBoxDevice(gladys, { snapshot, capabilities: allCapabilities, language }).features.map(
      (feature) => feature.external_id,
    );
  for (const language of LANGUAGES) {
    assert.deepEqual(idsOf(language), idsOf('en'));
  }
});

test('Gladys accepts the discovery payload', async () => {
  const fresh = createFakeGladys();
  await fresh.publishDiscoveredDevices([
    buildBoxDevice(fresh, { snapshot, capabilities: allCapabilities, language: 'fr' }),
    buildHostDevice(fresh, host, 'fr'),
  ]);
  assert.equal(fresh.fake.discoveredDevices.length, 2);
});
