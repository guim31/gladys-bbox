// -----------------------------------------------------------------------------
// Scene triggers: what HAPPENED between two readings of the Bbox.
//
// - `connection_lost` / `connection_restored`: the WAN went down / came back
//   up. Only a change between two successful readings counts: the first
//   reading after a start, and a Bbox that does not answer at all (restart,
//   network cut between Gladys and the box), fire nothing.
// - `missed_call`: the box's count of unanswered calls grew. It can also go
//   down (the count is reset when the calls are consulted): that fires nothing.
//
// Keys are forever: scenes store them.
// -----------------------------------------------------------------------------

export const TRIGGER = {
  CONNECTION_LOST: 'connection_lost',
  CONNECTION_RESTORED: 'connection_restored',
  MISSED_CALL: 'missed_call',
};

/**
 * Compare two snapshots. Resolves the list of `{ key, data }` to publish, and
 * the voice lines whose missed-call count grew (to look the caller up).
 *
 * @param {object|null} previous last successful snapshot
 * @param {object} current new snapshot
 * @param {{ lostAt: number|null, now: number }} context time of the loss
 */
export function detectEvents(previous, current, { lostAt, now }) {
  const events = [];
  if (previous && typeof previous.internet === 'boolean' && typeof current.internet === 'boolean') {
    if (previous.internet && !current.internet) {
      events.push({ key: TRIGGER.CONNECTION_LOST, data: {} });
    } else if (!previous.internet && current.internet) {
      events.push({
        key: TRIGGER.CONNECTION_RESTORED,
        data: {
          downtime_minutes:
            lostAt === null ? null : Math.max(0, Math.round((now - lostAt) / 60000)),
          ipv4: current.ipv4,
        },
      });
    }
  }

  const missedLines = [];
  if (previous) {
    for (const line of current.voipLines ?? []) {
      const before = previous.voipLines?.find((candidate) => candidate.id === line.id);
      if (before && line.notAnswered > before.notAnswered) {
        missedLines.push(line.id);
      }
    }
  }
  return { events, missedLines };
}

/**
 * The caller of the latest unanswered incoming call of a line, from
 * /voip/fullcalllog/<line>. Null when the log is unavailable or has none.
 */
export async function readLastMissedCaller(client, lineId) {
  try {
    const answer = await client.get(`voip/fullcalllog/${lineId}`);
    const parts = Array.isArray(answer) ? answer : [answer];
    const calls = parts.flatMap((part) => part?.calllog ?? []);
    const missed = calls
      // "in" in the recorded answers; other firmwares may qualify it.
      .filter((call) => Number(call?.answered) === 0 && String(call?.type).startsWith('in'))
      .sort((a, b) => Number(b.date) - Number(a.date));
    const number = missed[0]?.number;
    return typeof number === 'string' && number !== '' ? number : null;
  } catch {
    return null;
  }
}
