import { redis, MATCH_TTL } from '../_lib/redis.js';
import { checkCoachPush } from '../_lib/push.js';
import { validateCoach } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  const { code } = req.query;
  const key = `match:${code.toUpperCase()}`;

  if (req.method === 'GET') {
    try {
      const data = await redis.get(key);
      if (!data) return res.status(404).json({ error: 'Match not found' });
      const match = typeof data === 'string' ? JSON.parse(data) : data;

      // Track viewer: gebruik IP + forwarded header als unieke ID
      const viewersKey = `viewers:${code.toUpperCase()}`;
      const viewerId = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
      // Voeg viewer toe aan sorted set met timestamp als score
      const now = Date.now();
      await redis.zadd(viewersKey, { score: now, member: viewerId });
      // Verwijder viewers die langer dan 15 seconden niet gepolld hebben
      await redis.zremrangebyscore(viewersKey, 0, now - 15000);
      await redis.expire(viewersKey, 300); // cleanup na 5 min inactiviteit
      const viewerCount = await redis.zcard(viewersKey);

      match.viewers = viewerCount;

      // Push checks for coach (fire alongside response)
      await checkCoachPush(code.toUpperCase(), match);

      // Coach reconnect: als request een geldige coach-code meestuurt, stuur coachSecret mee
      // Viewers krijgen de secret NOOIT te zien
      const coachCode = req.headers['x-coach-code'];
      let includeSecret = false;
      if (coachCode && match.coachSecret) {
        // Valideer coach-code tegen team registry
        try {
          const { redis: r } = await import('../_lib/redis.js');
          const teams = await r.get('coach_teams');
          const parsed = typeof teams === 'string' ? JSON.parse(teams) : teams;
          if (parsed) {
            const entry = Object.entries(parsed).find(([k]) => k.toUpperCase() === coachCode.toUpperCase());
            if (entry) includeSecret = true;
          }
        } catch { /* ignore, don't include secret */ }
      }

      if (includeSecret) {
        return res.status(200).json(match);
      }
      const { coachSecret: _, ...safeMatch } = match;
      return res.status(200).json(safeMatch);
    } catch (err) {
      console.error('Get match error:', err);
      return res.status(500).json({ error: 'Failed to get match' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const authorized = await validateCoach(req, code);
      if (!authorized) return res.status(403).json({ error: 'Unauthorized' });

      const existing = await redis.get(key);
      if (!existing) return res.status(404).json({ error: 'Match not found' });
      const existingMatch = typeof existing === 'string' ? JSON.parse(existing) : existing;

      const match = req.body;
      match.code = code.toUpperCase();
      // Behoud coachSecret (client stuurt dit niet mee)
      if (existingMatch.coachSecret) match.coachSecret = existingMatch.coachSecret;
      await redis.set(key, JSON.stringify(match), { ex: MATCH_TTL });

      // Track active matches voor cron-based push checks
      const upperCode = code.toUpperCase();
      if (match.timerStartedAt && !match.isPaused && !match.halfBreak &&
          match.status !== 'ended' && match.status !== 'setup') {
        await redis.sadd('active_matches', upperCode);
      } else {
        await redis.srem('active_matches', upperCode);
      }

      // Push checks on coach sync — ensures push fires even without active viewers
      await checkCoachPush(upperCode, match);

      return res.status(200).json(match);
    } catch (err) {
      console.error('Update match error:', err);
      return res.status(500).json({ error: 'Failed to update match' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
