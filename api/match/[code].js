import { redis, MATCH_TTL } from '../_lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  const { code } = req.query;
  const key = `match:${code.toUpperCase()}`;

  if (req.method === 'GET') {
    try {
      const data = await redis.get(key);
      if (!data) return res.status(404).json({ error: 'Match not found' });
      const match = typeof data === 'string' ? JSON.parse(data) : data;
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

      return res.status(200).json(match);
    } catch (err) {
      console.error('Update match error:', err);
      return res.status(500).json({ error: 'Failed to update match' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
