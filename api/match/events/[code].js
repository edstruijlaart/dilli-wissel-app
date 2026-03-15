import { redis, MATCH_TTL } from '../../_lib/redis.js';
import { sendPushToAll } from '../../_lib/push.js';
import { validateCoach } from '../../_lib/auth.js';

/**
 * Build push payload for viewer notification based on event type.
 * Returns null for events that don't need a push.
 */
function buildViewerPush(event, score) {
  switch (event.type) {
    case 'goal_home':
    case 'goal_away':
      return {
        title: '⚽ GOAL!',
        body: event.scorer ? `${score} — ${event.scorer}` : score,
        vibrate: [300, 100, 300],
        tag: 'goal',
      };
    case 'sub_auto':
    case 'sub_manual': {
      const out = Array.isArray(event.out) ? event.out[0] : event.out;
      const inn = Array.isArray(event.inn) ? event.inn[0] : event.inn;
      const extra = Array.isArray(event.out) && event.out.length > 1
        ? ` (+${event.out.length - 1} meer)` : '';
      return {
        title: '🔄 Wissel',
        body: `${out || '?'} eruit, ${inn || '?'} erin${extra}`,
        vibrate: [200, 100, 200],
        tag: 'sub',
      };
    }
    case 'half_end':
    case 'half_end_manual':
      return {
        title: '⏸️ Rust',
        body: `Stand: ${score}`,
        vibrate: [200, 100, 200],
        tag: 'half',
      };
    case 'half_start':
      return {
        title: '▶️ 2e helft',
        body: 'De wedstrijd gaat verder!',
        vibrate: [200, 100, 200],
        tag: 'halfstart',
      };
    case 'match_end':
    case 'match_end_manual':
      return {
        title: '🏁 Einde wedstrijd',
        body: `Uitslag: ${score}`,
        vibrate: [300, 100, 300, 100, 300],
        tag: 'end',
      };
    case 'photo':
      return {
        title: '📸 Foto',
        body: event.caption || 'Nieuwe foto van het veld',
        vibrate: [200, 100, 200],
        tag: 'photo',
      };
    default:
      return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  const { code } = req.query;
  const upperCode = code.toUpperCase();
  const key = `match:${upperCode}:events`;

  if (req.method === 'GET') {
    try {
      const data = await redis.get(key);
      if (!data) return res.status(404).json({ error: 'Match not found' });
      const events = typeof data === 'string' ? JSON.parse(data) : data;
      return res.status(200).json(events);
    } catch (err) {
      console.error('Get events error:', err);
      return res.status(500).json({ error: 'Failed to get events' });
    }
  }

  if (req.method === 'POST') {
    try {
      const authorized = await validateCoach(req, code);
      if (!authorized) return res.status(403).json({ error: 'Unauthorized' });

      const existing = await redis.get(key);
      if (!existing) return res.status(404).json({ error: 'Match not found' });
      const events = typeof existing === 'string' ? JSON.parse(existing) : existing;

      const event = { ...req.body, at: new Date().toISOString() };
      events.push(event);
      await redis.set(key, JSON.stringify(events), { ex: MATCH_TTL });

      // Push notification to viewers
      try {
        const matchData = await redis.get(`match:${upperCode}`);
        const match = matchData ? (typeof matchData === 'string' ? JSON.parse(matchData) : matchData) : {};
        const score = `${match.homeScore || 0} - ${match.awayScore || 0}`;
        const payload = buildViewerPush(event, score);
        if (payload) {
          payload.matchCode = upperCode;
          payload.url = `/join/${upperCode}`;
          await sendPushToAll(upperCode, 'viewer', payload);
        }
      } catch (pushErr) {
        console.error('Viewer push error:', pushErr);
      }

      return res.status(201).json(event);
    } catch (err) {
      console.error('Add event error:', err);
      return res.status(500).json({ error: 'Failed to add event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
