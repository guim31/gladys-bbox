// -----------------------------------------------------------------------------
// Credentials never reach the logs nor the disk.
//
// The administrator password lives in the Gladys configuration (a `secret`
// field), the BBOX_ID session cookie and the write token in memory only. The
// test runs readings, failures, commands and actions with every log level on,
// captures everything written to stdout and stderr, and looks for them.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { FEATURE, boxIds } from '../src/devices.js';
import { PASSWORD, loadFixture } from './helpers/fakeBbox.js';
import { connect, discovered, setup } from './helpers/setup.js';

const TOKEN = loadFixture('ftth')['device/token'][0].device.token;

function captureOutput() {
  const chunks = [];
  const originals = { out: process.stdout.write, err: process.stderr.write };
  const capture = (chunk, ...rest) => {
    chunks.push(String(chunk));
    const callback = rest.find((arg) => typeof arg === 'function');
    callback?.();
    return true;
  };
  process.stdout.write = capture;
  process.stderr.write = capture;
  return {
    restore() {
      process.stdout.write = originals.out;
      process.stderr.write = originals.err;
    },
    text: () => chunks.join(''),
  };
}

test('the password, the session cookie and the token are never logged', async () => {
  const output = captureOutput();
  let dataDir;
  try {
    const context = await setup({ logger: createLogger({ name: 'bbox', level: 'debug' }) });
    dataDir = context.dataDir;
    const { gladys, app, bbox } = await connect(context);
    const ids = boxIds(gladys, 'testserial0001');
    const box = discovered(gladys, ids.device);
    // A command and both actions: they log, and they send the token.
    const wifi = box.features.find((f) => f.external_id === ids.feature(FEATURE.WIFI_24));
    await gladys.fake.setValue(box, wifi, 0);
    await gladys.fake.action('test_connection');
    await gladys.fake.action('reboot', { confirm: true });
    // Failures: an API error on a write, an expired session, a lost box.
    bbox.routeStatus['device/reboot'] = 500;
    await gladys.fake.action('reboot', { confirm: true });
    bbox.expireSessions();
    await app.refresh();
    bbox.networkError = 'ECONNRESET';
    await app.refresh();
    // A wrong password (a new configuration).
    bbox.networkError = null;
    await gladys.fake.configUpdated({ password: `${PASSWORD}-typo` });
    app.stop();
  } finally {
    output.restore();
  }
  const logs = output.text();
  assert.ok(logs.length > 0, 'the integration logged something');
  assert.ok(!logs.includes(PASSWORD), 'the password appears in the logs');
  assert.ok(!/session-\d/.test(logs), 'a session cookie appears in the logs');
  assert.ok(!logs.includes(TOKEN), 'the write token appears in the logs');

  // What the integration wrote in /data holds no credential either.
  for (const file of await readdir(dataDir)) {
    const content = await readFile(path.join(dataDir, file), 'utf8');
    assert.ok(!content.includes(PASSWORD), `${file} holds the password`);
    assert.ok(!/session-\d/.test(content), `${file} holds a session cookie`);
    assert.ok(!content.includes(TOKEN), `${file} holds the token`);
  }
});

test('the source never logs the configuration nor a request body', async () => {
  const sourceDir = new URL('../src/', import.meta.url);
  const files = (await readdir(sourceDir, { recursive: true })).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const source = await readFile(new URL(file, sourceDir), 'utf8');
    for (const line of source.split('\n').filter((l) => /logger\.\w+\(/.test(l))) {
      assert.doesNotMatch(
        line,
        /password|config\b|cookie|token|body|headers/i,
        `${file}: ${line.trim()}`,
      );
    }
  }
});
