import { redis } from '../_lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { matchCode, role, subscription } = req.body;

    if (!matchCode || !role || !subscription) {
      return res.status(400).json({ error: 'Missing matchCode, role, or subscription' });
    }

    if (role !== 'coach' && role !== 'viewer') {
      return res.status(400).json({ error: 'Role must be coach or viewer' });
    }

    const code = matchCode.toUpperCase();
    const subsKey = `push:${code}:${role}`;

    // Get existing subscriptions
    const raw = await redis.get(subsKey);
    const subscriptions = raw
      ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
      : [];

    // Dedup: check if this endpoint is already subscribed
    const exists = subscriptions.some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      subscriptions.push(subscription);
      await redis.set(subsKey, JSON.stringify(subscriptions), { ex: 86400 }); // 24h TTL
    }

    return res.status(200).json({ ok: true, count: subscriptions.length });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return res.status(500).json({ error: 'Failed to subscribe' });
  }
}
