import { redis, MATCH_TTL } from '../../_lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  const { code } = req.query;
  const key = `match:${code.toUpperCase()}:events`;

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
      const existing = await redis.get(key);
      if (!existing) return res.status(404).json({ error: 'Match not found' });
      const events = typeof existing === 'string' ? JSON.parse(existing) : existing;

      const event = { ...req.body, at: new Date().toISOString() };
      events.push(event);
      await redis.set(key, JSON.stringify(events), { ex: MATCH_TTL });

      return res.status(201).json(event);
    } catch (err) {
      console.error('Add event error:', err);
      return res.status(500).json({ error: 'Failed to add event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
