import { redis } from '../_lib/redis.js';
import { checkCoachPush } from '../_lib/push.js';

/**
 * Cron job: elke minuut checken of er push notificaties verstuurd moeten worden.
 * Leest actieve wedstrijden uit Redis set 'active_matches' en draait checkCoachPush.
 * Dit lost het probleem op dat pushes alleen werkten als er actief gepolled werd.
 */
export default async function handler(req, res) {
  try {
    const codes = await redis.smembers('active_matches');
    if (!codes || codes.length === 0) {
      return res.status(200).json({ checked: 0, active: 0 });
    }

    let checked = 0;
    for (const code of codes) {
      const data = await redis.get(`match:${code}`);
      if (!data) {
        // Match expired uit Redis, opruimen
        await redis.srem('active_matches', code);
        continue;
      }
      const match = typeof data === 'string' ? JSON.parse(data) : data;

      // Match niet meer actief? Opruimen uit set
      if (!match.timerStartedAt || match.isPaused || match.halfBreak ||
          match.status === 'ended' || match.status === 'setup') {
        await redis.srem('active_matches', code);
        continue;
      }

      await checkCoachPush(code, match);
      checked++;
    }

    return res.status(200).json({ checked, active: codes.length });
  } catch (err) {
    console.error('Cron check-push error:', err);
    return res.status(500).json({ error: err.message });
  }
}
