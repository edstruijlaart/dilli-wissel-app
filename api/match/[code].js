import { redis, MATCH_TTL } from '../_lib/redis.js';
import { sendPushToAll, checkDedup } from '../_lib/push.js';

/**
 * Server-side push checks for coach notifications.
 * Piggybacks on existing polling — detects timer milestones
 * even when coach's phone screen is off.
 */
async function checkCoachPush(code, match) {
  try {
    // Only check when timer is actively running
    if (!match.timerStartedAt || match.isPaused || match.halfBreak) return;
    if (match.status === 'ended' || match.status === 'setup') return;

    const now = Date.now();
    const halfElapsed = Math.floor((now - new Date(match.timerStartedAt).getTime()) / 1000);
    const halfDurationSec = (match.halfDuration || 10) * 60;
    const subIntervalSec = (match.subInterval || 4) * 60;
    const currentHalf = match.currentHalf || 1;
    const totalHalves = match.halves || 2;
    const score = `${match.homeScore || 0} - ${match.awayScore || 0}`;

    // 1. Wisseladvies — autoSubs aan + subInterval overdue
    if (match.autoSubs && match.subInterval > 0 && match.subTimerStartedAt) {
      const subElapsed = Math.floor((now - new Date(match.subTimerStartedAt).getTime()) / 1000);
      if (subElapsed >= subIntervalSec) {
        const slotId = Math.floor(halfElapsed / subIntervalSec);
        const dedupKey = `push:sub:${code}:${currentHalf}:${slotId}`;
        const alreadySent = await checkDedup(dedupKey, 300);
        if (!alreadySent) {
          await sendPushToAll(code, 'coach', {
            title: '🔄 Tijd om te wisselen!',
            body: 'Wisselmoment bereikt — open de app',
            vibrate: [200, 100, 200, 100, 200],
            tag: `sub-${code}`,
            matchCode: code,
            url: '/',
          });
        }
      }
    }

    // 2. Helft voorbij / einde wedstrijd
    if (halfElapsed >= halfDurationSec) {
      if (currentHalf >= totalHalves) {
        // Einde wedstrijd
        const endDedupKey = `push:end:${code}`;
        const endAlreadySent = await checkDedup(endDedupKey, 3600);
        if (!endAlreadySent) {
          await sendPushToAll(code, 'coach', {
            title: '🏁 Einde wedstrijd!',
            body: `Uitslag: ${score}`,
            vibrate: [300, 100, 300, 100, 300],
            tag: `end-${code}`,
            matchCode: code,
            url: '/',
          });
        }

        // Blessuretijd voorbij (als ingesteld)
        const injuryTimeSec = (match.injuryTime || 0) * 60;
        if (injuryTimeSec > 0 && halfElapsed >= halfDurationSec + injuryTimeSec) {
          const injuryDedupKey = `push:injury:${code}`;
          const injuryAlreadySent = await checkDedup(injuryDedupKey, 3600);
          if (!injuryAlreadySent) {
            await sendPushToAll(code, 'coach', {
              title: '⏱️ Blessuretijd voorbij!',
              body: `Stand: ${score}`,
              vibrate: [300, 100, 300],
              tag: `injury-${code}`,
              matchCode: code,
              url: '/',
            });
          }
        }
      } else {
        // Rust — helft voorbij, niet de laatste
        const halfDedupKey = `push:half:${code}:${currentHalf}`;
        const halfAlreadySent = await checkDedup(halfDedupKey, 3600);
        if (!halfAlreadySent) {
          await sendPushToAll(code, 'coach', {
            title: `⏸️ Rust! Helft ${currentHalf} is voorbij`,
            body: `Stand: ${score}`,
            vibrate: [200, 100, 200],
            tag: `half-${code}`,
            matchCode: code,
            url: '/',
          });
        }
      }
    }
  } catch (err) {
    console.error('checkCoachPush error:', err);
  }
}

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

      return res.status(200).json(match);
    } catch (err) {
      console.error('Get match error:', err);
      return res.status(500).json({ error: 'Failed to get match' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const existing = await redis.get(key);
      if (!existing) return res.status(404).json({ error: 'Match not found' });

      const match = req.body;
      match.code = code.toUpperCase();
      await redis.set(key, JSON.stringify(match), { ex: MATCH_TTL });

      // Push checks on coach sync — ensures push fires even without active viewers
      await checkCoachPush(code.toUpperCase(), match);

      return res.status(200).json(match);
    } catch (err) {
      console.error('Update match error:', err);
      return res.status(500).json({ error: 'Failed to update match' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
