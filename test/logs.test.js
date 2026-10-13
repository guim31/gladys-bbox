// -----------------------------------------------------------------------------
// Calm logs and self-refreshing readings.
//
// A normal reading writes nothing at info level: info keeps the lifecycle
// (connection, loss and return, user actions). A failure that repeats writes
// one line when it starts and one when it ends. And the integration reads the
// Bbox on its own timer: Gladys does not poll it (should_poll: false).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE, boxIds } from '../src/devices.js';
import { PASSWORD, loadFixture } from './helpers/fakeBbox.js';
import { connect, setup } from './helpers/setup.js';

const TOKEN = loadFixture('ftth')['device/token'][0].device.token;
const SERIAL = 'testserial0001';
const HOUR = 60 * 60 * 1000;

function recordingLogger() {
  const lines = [];
  const record =
    (level) =>
    (...args) =>
      lines.push({ level, text: args.map((arg) => String(arg?.stack ?? arg)).join(' ') });
  return {
    lines,
    at: (level) => lines.filter((line) => line.level === level),
    clear: () => lines.splice(0),
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
}

// Let the timer callback and the reading it starts settle.
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('a normal reading writes nothing at info level, and no secret', async () => {
  const logger = recordingLogger();
  const { app, bbox } = await connect(await setup({ logger }));
  // The first reading announces the connection, once.
  assert.equal(logger.at('info').length, 1);
  assert.match(logger.at('info')[0].text, /Connected to the Bbox/);
  logger.clear();
  await app.refresh();
  bbox.routes['wan/ip/stats'][0].wan.ip.stats.rx.bandwidth = 40000;
  await app.refresh();
  await app.refresh();
  assert.deepEqual(
    logger.lines.filter((line) => line.level !== 'debug'),
    [],
  );
  const all = logger.lines.map((line) => line.text).join('\n');
  assert.ok(!all.includes(PASSWORD), 'the password appears in the logs');
  assert.ok(!all.includes(TOKEN), 'the write token appears in the logs');
  assert.ok(!/session-\d/.test(all), 'a session cookie appears in the logs');
});

test('a repeated failure: one line when it starts, one when it ends', async () => {
  const logger = recordingLogger();
  const { app, bbox } = await connect(await setup({ logger }));
  logger.clear();
  bbox.networkError = 'ECONNREFUSED';
  await app.refresh();
  await app.refresh();
  await app.refresh();
  assert.equal(logger.at('warn').length, 1);
  assert.match(logger.at('warn')[0].text, /Reading the Bbox failed/);
  assert.equal(logger.at('info').length, 0);
  bbox.networkError = null;
  await app.refresh();
  await app.refresh();
  assert.equal(logger.at('warn').length, 1);
  assert.deepEqual(
    logger.at('info').map((line) => line.text),
    ['Reading the Bbox works again'],
  );
});

test('the loss and the return of Internet are logged once each', async () => {
  const logger = recordingLogger();
  const { app, bbox } = await connect(await setup({ logger }));
  logger.clear();
  bbox.routes['wan/ip'][0].wan.ip.state = 'Down';
  await app.refresh();
  await app.refresh();
  bbox.routes['wan/ip'][0].wan.ip.state = 'Up';
  await app.refresh();
  await app.refresh();
  assert.deepEqual(
    logger.at('info').map((line) => line.text),
    ['Internet connection of the Bbox lost', 'Internet connection of the Bbox restored'],
  );
});

test('the integration reads the Bbox on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_700_000_000_000 });
  const context = await setup();
  const { gladys, bbox, app } = context;
  await gladys.connect();
  try {
    const internet = boxIds(gladys, SERIAL).feature(FEATURE.INTERNET);
    // The first reading ran at the connection; the next one is the timer's.
    const requests = bbox.requests.length;
    t.mock.timers.tick(60 * 1000);
    await settle();
    assert.ok(bbox.requests.length > requests, 'no reading after the refresh interval');

    // An unchanged value is sent again well within 12 hours, so the front
    // never shows it as stale (48 hours).
    const sent = () =>
      gladys.fake.states.filter((s) => s.device_feature_external_id === internet).length;
    const sentAt = [Date.now()];
    let count = sent();
    for (let minute = 0; minute < 13 * 60; minute += 1) {
      t.mock.timers.tick(60 * 1000);
      await settle();
      if (sent() > count) {
        sentAt.push(Date.now());
        count = sent();
      }
    }
    const gaps = sentAt.slice(1).map((at, i) => at - sentAt[i]);
    assert.ok(gaps.length > 0, 'the unchanged value was never sent again');
    assert.ok(Math.max(...gaps) <= 12 * HOUR, `largest gap ${Math.max(...gaps)} ms`);
  } finally {
    app.stop();
  }
});
