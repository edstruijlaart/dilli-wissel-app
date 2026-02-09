import { redis } from '../_lib/redis.js';

function checkAdmin(req) {
  const auth = req.headers['x-admin-code'] || '';
  const adminCode = process.env.ADMIN_CODE || '';
  return adminCode && auth.trim() === adminCode.trim();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      // Upstash scan: retourneert [cursor, keys]
      const keys = [];
      let cursor = 0;
      do {
        const [nextCursor, results] = await redis.scan(cursor, { match: 'match:*', count: 100 });
        cursor = nextCursor;
        const matchKeys = results.filter(k => !k.includes(':events'));
        keys.push(...matchKeys);
      } while (cursor && cursor !== 0 && cursor !== '0');

      // Haal alle matches op
      const matches = [];
      for (const key of keys) {
        try {
          const data = await redis.get(key);
          if (data) {
            const match = typeof data === 'string' ? JSON.parse(data) : data;
            const code = key.replace('match:', '');
            // Viewer count
            const viewersKey = `viewers:${code}`;
            const now = Date.now();
            try {
              await redis.zremrangebyscore(viewersKey, 0, now - 15000);
              const viewers = await redis.zcard(viewersKey);
              match.viewers = viewers;
            } catch { match.viewers = 0; }
            matches.push({ ...match, code });
          }
        } catch { /* skip broken entries */ }
      }

      // Sorteer: actieve wedstrijden eerst, dan op createdAt desc
      matches.sort((a, b) => {
        const statusOrder = { live: 0, paused: 1, halftime: 2, setup: 3, ended: 4 };
        const aOrder = statusOrder[a.status] ?? 5;
        const bOrder = statusOrder[b.status] ?? 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });

      return res.status(200).json({ matches });
    } catch (err) {
      console.error('Admin matches error:', err);
      return res.status(500).json({ error: 'Failed to get matches', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
