import { redis } from '../_lib/redis.js';

// GET: opgeslagen wedstrijden ophalen voor een team
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { team } = req.query;
  if (!team) return res.status(400).json({ error: 'team parameter is required' });

  try {
    const key = `history:${team}`;
    const history = await redis.get(key);
    return res.status(200).json(Array.isArray(history) ? history : []);
  } catch (err) {
    console.error('History fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
}
