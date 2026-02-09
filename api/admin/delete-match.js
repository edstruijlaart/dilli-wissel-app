import { redis } from '../_lib/redis.js';

function checkAdmin(req) {
  const auth = req.headers['x-admin-code'] || '';
  const adminCode = process.env.ADMIN_CODE || '';
  return adminCode && auth.trim() === adminCode.trim();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code is required' });

  try {
    const upper = code.toUpperCase();
    await redis.del(`match:${upper}`);
    await redis.del(`match:${upper}:events`);
    await redis.del(`viewers:${upper}`);
    return res.status(200).json({ deleted: upper });
  } catch (err) {
    console.error('Delete match error:', err);
    return res.status(500).json({ error: 'Failed to delete match' });
  }
}
