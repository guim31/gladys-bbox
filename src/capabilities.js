// -----------------------------------------------------------------------------
// What the Bbox model exposes, remembered in /data.
//
// The features of the Bbox device depend on the model (temperature, guest
// Wi-Fi, telephony). Gladys offers "Update" in the Discovery tab whenever the
// published structure changes, so a feature must not come and go with an
// optional route that timed out once: a capability seen once is kept, across
// restarts too. The file holds no secret.
// -----------------------------------------------------------------------------

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CAPABILITY_KEYS = ['temperature', 'wifiGuest', 'voip'];

/** Capabilities a snapshot shows. */
export function capabilitiesOf(snapshot) {
  return {
    temperature: snapshot.temperature !== null,
    wifiGuest: snapshot.wifiGuest !== null,
    voip: snapshot.missedCalls !== null,
  };
}

/**
 * @param {string} dataDir the writable volume (/data in the container)
 */
export function createCapabilityStore(dataDir) {
  const file = path.join(dataDir, 'capabilities.json');
  let known = Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, false]));

  return {
    get() {
      return { ...known };
    },

    async load() {
      try {
        const saved = JSON.parse(await readFile(file, 'utf8'));
        for (const key of CAPABILITY_KEYS) {
          known[key] = saved[key] === true;
        }
      } catch {
        // First start, or an unreadable file: detection starts over.
      }
      return this.get();
    },

    /** Add what a snapshot shows; resolves true when something was new. */
    async merge(snapshot) {
      const seen = capabilitiesOf(snapshot);
      const added = CAPABILITY_KEYS.filter((key) => seen[key] && !known[key]);
      if (added.length === 0) {
        return false;
      }
      known = { ...known, ...Object.fromEntries(added.map((key) => [key, true])) };
      try {
        await mkdir(dataDir, { recursive: true });
        await writeFile(file, `${JSON.stringify(known, null, 2)}\n`);
      } catch {
        // Not fatal: the capability is still known until the next restart.
      }
      return true;
    },
  };
}
